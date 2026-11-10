-- Program library, versioning and the push rule (update spec, Phase 1).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep');

insert into public.exercises (id, name) overriding system value values
  (2001, 'Zz Press'), (2002, 'Zz Row'), (2003, 'Zz Curl'), (2004, 'Zz Squat');

insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values
  (3001, 'Zz Class A', 'GENERAL', 1, '09:00', '10:00'),
  (3002, 'Zz Class B', 'GENERAL', 2, '09:00', '10:00'),
  (3003, 'Zz Class C', 'GENERAL', 3, '09:00', '10:00');

-- Codes and versions
select public.create_program('Zz Shared') as shared \gset
select matches((select code from public.library_programs where id = :shared),
  '^PRG-\d{4}$', 'codes look like PRG-0001');
select is((select version_no from public.program_versions
           where id = (select current_version_id from public.library_programs where id = :shared)),
  1, 'a new program starts at version 1');

select public.save_program_version(:shared, 'Zz Shared', '[
  {"exercise_id": 2001, "sets": 3, "reps": "10 SL", "rm_percentage": 0.700},
  {"exercise_id": 2002, "sets": 3, "reps": "8 each side", "rm_percentage": 0.600},
  {"exercise_id": 2003, "sets": 2, "reps": "12"}
]');

select is((select count(*)::int from public.program_versions where program_id = :shared), 2,
  'every save creates a version');

select throws_ok($$ update public.program_version_items set sets = 9 $$, 'RX008', null,
  'versions are immutable');
select throws_ok(
  format('update public.library_programs set code = %L where id = %s', 'PRG-9999', :shared),
  'RX008', null, 'codes can''t be changed');

select throws_ok($$ select public.save_program_version(
    (select id from public.library_programs order by id desc limit 1), 'x',
    '[{"exercise_id": 2001, "sets": 3, "reps": "123456789012345678901"}]') $$,
  '23514', null, 'reps longer than 20 characters are refused');

-- Two classes share the program
select public.assign_program(3001, :shared, public.practice_today()) as assign_a \gset
select public.assign_program(3002, :shared, public.practice_today()) as assign_b \gset

select is(
  (select array_agg(reps order by position) from public.class_program_items
   where assignment_id = :assign_a),
  array['10 SL', '8 each side', '12'], 'the class copy matches the library');

select throws_ok(
  format('select public.assign_program(3001, %s, public.practice_today() + 10)', :shared),
  '23P01', null, 'a class can''t have two programs at once');

-- Class B customises row 2 and adds its own row after row 1.
update public.class_program_items set sets = 5
where assignment_id = :assign_b and position = 2;
select public.add_class_item(:assign_b, 2004, 2, '15') as class_row \gset
select public.move_class_item(:class_row, 'up');
select public.move_class_item(:class_row, 'up');

select ok((select is_customised from public.class_program_items
           where assignment_id = :assign_b and position = 3 and exercise_id = 2002),
  'an edited row is flagged as customised');

-- The library changes sets on every row, swaps the third exercise and adds a fourth.
select public.save_program_version(:shared, 'Zz Shared', (
  select jsonb_agg(item order by position)
  from (
    select i.position, jsonb_build_object(
      'item_key', i.item_key,
      'exercise_id', case when i.position = 3 then 2001 else i.exercise_id end,
      'sets', 4, 'reps', i.reps, 'rm_percentage', i.rm_percentage) as item
    from public.program_version_items i
    join public.library_programs p on p.current_version_id = i.version_id
    where p.id = :shared
    union all
    select 4, jsonb_build_object('exercise_id', 2004, 'sets', 1, 'reps', '20')
  ) rows
));

select is(
  (select array_agg(sets order by position) from public.class_program_items
   where assignment_id = :assign_a),
  array[4, 4, 4, 1], 'class A takes every library change');
select is(
  (select array_agg(exercise_id order by position) from public.class_program_items
   where assignment_id = :assign_a),
  array[2001, 2002, 2001, 2004]::bigint[], 'exercise swaps and additions reach the class');

select is(
  (select array_agg(exercise_id || ':' || sets order by position) from public.class_program_items
   where assignment_id = :assign_b and not is_removed),
  array['2001:4', '2004:2', '2002:5', '2001:4', '2004:1'],
  'class B keeps its customised and added rows, in place');

select is(
  (select count(*)::int from public.class_program_pushes p
   join public.class_program_assignments a on a.id = p.assignment_id
   where a.program_id = :shared),
  4, 'every push is logged: one per assignment, then one per class per save');

select isnt_empty(
  $$ select 1 from public.audit_log where table_name = 'class_program_pushes' $$,
  'pushes are audited');

-- Reset a customised row
select public.reset_class_item(
  (select id from public.class_program_items
   where assignment_id = :assign_b and exercise_id = 2002));
select results_eq(
  format($$ select sets, is_customised from public.class_program_items
            where assignment_id = %s and exercise_id = 2002 $$, :assign_b),
  $$ values (4, false) $$, 'reset puts the row back to the library');

select throws_ok(format('select public.reset_class_item(%s)', :class_row), 'RX009', null,
  'a class-only row can''t be reset, only removed');

-- Removing a library row in the class sticks across pushes.
select public.remove_class_item(
  (select id from public.class_program_items where assignment_id = :assign_a and position = 4));
select public.save_program_version(:shared, 'Zz Shared', (
  select jsonb_agg(to_jsonb(i) - array['id', 'version_id', 'position', 'created_at']
                   order by i.position)
  from public.program_version_items i
  join public.library_programs p on p.current_version_id = i.version_id
  where p.id = :shared));
select is(
  (select count(*)::int from public.class_program_items
   where assignment_id = :assign_a and not is_removed),
  3, 'a row removed in the class stays removed after a push');

-- Archive
select public.set_program_archived(:shared, true);
select throws_ok(format('select public.assign_program(3003, %s, public.practice_today())', :shared),
  'RX009', null, 'an archived program can''t be assigned');
select throws_ok(format($$ select public.save_program_version(%s, 'x', '[]') $$, :shared),
  'RX009', null, 'an archived program can''t be edited');
select public.set_program_archived(:shared, false);

-- Duplicate
select public.duplicate_program(:shared, 'Zz Copy') as copy \gset
select isnt(
  (select code from public.library_programs where id = :copy),
  (select code from public.library_programs where id = :shared), 'a duplicate gets its own code');
select is(
  (select count(*)::int from public.program_version_items i
   join public.library_programs p on p.current_version_id = i.version_id where p.id = :copy),
  4, 'a duplicate copies the current version');
select is_empty(format($$
  select item_key from public.program_version_items i
  join public.library_programs p on p.current_version_id = i.version_id where p.id = %s
  intersect
  select item_key from public.program_version_items i
  join public.library_programs p on p.current_version_id = i.version_id where p.id = %s $$,
  :copy, :shared), 'a duplicate has its own item identities');

select throws_ok(format($$ select public.push_version_to_assignment(%s,
    (select current_version_id from public.library_programs where id = %s)) $$, :assign_a, :copy),
  'RX009', null, 'a version can only be pushed to its own program''s classes');

-- Only today's assignment counts
insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz', 'One', true);
insert into public.class_members (class_id, client_id) values (3003, 1001);
select public.assign_program(3003, :copy, public.practice_today() + 7);
select is((select count(*)::int from public.effective_weights(3003)), 0,
  'a queued program doesn''t apply yet');

-- Legacy conversion: two identical programs merge; a different one stays separate.
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values
  (3004, 'Zz Old A', 'GENERAL', 1, '09:00', '10:00'),
  (3005, 'Zz Old B', 'GENERAL', 2, '09:00', '10:00'),
  (3006, 'Zz Old C', 'GENERAL', 3, '09:00', '10:00');
insert into public.programs (id, class_id, name) overriding system value values
  (5004, 3004, 'Old A'), (5005, 3005, 'Old B'), (5006, 3006, 'Old C');
insert into public.program_exercises
  (program_id, exercise_id, order_index, sets, reps, rm_percentage, fallback_weight_kg) values
  (5004, 2001, 1, 3, 10, 0.7, null), (5004, 2002, 2, 3, 12, 0.6, null),
  (5005, 2001, 1, 3, 10, 0.7, 15),   (5005, 2002, 2, 3, 12, 0.6, null),
  (5006, 2001, 1, 3, 8, 0.7, null);

select is(private.convert_legacy_programs(), 3, 'three classes are converted');
select is(
  (select count(distinct a.program_id)::int from public.class_program_assignments a
   where a.class_id in (3004, 3005)), 1, 'identical programs merge into one');
select isnt(
  (select program_id from public.class_program_assignments where class_id = 3006),
  (select program_id from public.class_program_assignments where class_id = 3004),
  'a different program stays separate');
select results_eq(
  $$ select reps, fallback_weight_kg, is_customised from public.class_program_items i
     join public.class_program_assignments a on a.id = i.assignment_id
     where a.class_id = 3005 and i.position = 1 $$,
  $$ values ('10'::text, 15.00::numeric, true) $$,
  'numeric reps become text, and a differing starting weight is kept as customised');
select is(private.convert_legacy_programs(), 0, 'the conversion is safe to re-run');

-- Staff run all of this through their own session, under RLS and their grants.
set local role authenticated;
select lives_ok($$ select public.create_program('Zz Staff Program') $$,
  'an EP creates a program');
select lives_ok($$
  select public.save_program_version(
    (select id from public.library_programs where name = 'Zz Staff Program'), 'Zz Staff Program',
    '[{"exercise_id": 2001, "sets": 3, "reps": "10", "rm_percentage": 0.7}]') $$,
  'an EP saves a version');
select lives_ok($$
  select public.duplicate_program(
    (select id from public.library_programs where name = 'Zz Staff Program'), 'Zz Staff Copy') $$,
  'an EP duplicates a program');
reset role;

-- Access
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty('select * from public.library_programs', 'AAL1 reads no programs');
reset role;

select * from finish();
rollback;
