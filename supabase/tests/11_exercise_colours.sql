-- Exercise colours: part of a version, pushed like any other value, kept in snapshots.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep');
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
                    'aal', 'aal2')::text, true);

insert into public.exercises (id, name) overriding system value values
  (2001, 'Zz Squat'), (2002, 'Zz Row');
insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz', 'One', true);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values
  (3001, 'Zz A', 'GENERAL', extract(dow from public.practice_today())::int, '00:00', '01:00'),
  (3002, 'Zz B', 'GENERAL', 1, '09:00', '10:00');

set local role authenticated;

select public.create_program('Zz Colour') as p \gset
select public.save_program_version(:p, 'Zz Colour',
  '[{"exercise_id": 2001, "sets": 3, "reps": "10", "rm_percentage": 0.5, "colour": "orange"},
    {"exercise_id": 2002, "sets": 3, "reps": "10", "rm_percentage": 0.5}]');
select public.assign_program(3001, :p, public.practice_today() - 1);
select public.assign_program(3002, :p, public.practice_today() - 1);

select results_eq(
  $$ select i.colour from public.class_program_items i
     join public.class_program_assignments a on a.id = i.assignment_id
     where a.class_id = 3001 order by i.position $$,
  $$ values ('orange'::text), (null) $$,
  'assigning copies each row''s colour');

select throws_ok(
  format($$ select public.save_program_version(%s, 'Zz Colour',
    '[{"exercise_id": 2001, "sets": 3, "reps": "10", "colour": "magenta"}]') $$, :p),
  '23514', null, 'only palette colours are accepted');

-- Class A recolours its Row; a library change of both colours then reaches class B fully
-- and class A only on the uncustomised row.
update public.class_program_items i set colour = 'grey'
from public.class_program_assignments a
where a.id = i.assignment_id and a.class_id = 3001 and i.exercise_id = 2002;

select is(
  (select i.is_customised from public.class_program_items i
   join public.class_program_assignments a on a.id = i.assignment_id
   where a.class_id = 3001 and i.exercise_id = 2002),
  true, 'a colour change on a class copy marks the row customised');

select public.save_program_version(:p, 'Zz Colour', (
  select jsonb_agg(jsonb_build_object(
    'item_key', item_key, 'exercise_id', exercise_id, 'sets', sets, 'reps', reps,
    'rm_percentage', rm_percentage, 'colour', 'blue') order by position)
  from public.program_version_items i
  join public.library_programs lp on lp.current_version_id = i.version_id
  where lp.id = :p));

select results_eq(
  $$ select a.class_id, i.exercise_id, i.colour from public.class_program_items i
     join public.class_program_assignments a on a.id = i.assignment_id
     where a.class_id in (3001, 3002) order by 1, 2 $$,
  $$ values (3001::bigint, 2001::bigint, 'blue'::text), (3001, 2002, 'grey'),
            (3002, 2001, 'blue'), (3002, 2002, 'blue') $$,
  'a library colour change follows the push rule');

select public.reset_class_item(i.id)
from public.class_program_items i
join public.class_program_assignments a on a.id = i.assignment_id
where a.class_id = 3001 and i.exercise_id = 2002;

select is(
  (select i.colour from public.class_program_items i
   join public.class_program_assignments a on a.id = i.assignment_id
   where a.class_id = 3001 and i.exercise_id = 2002),
  'blue', 'reset restores the library colour');

-- Snapshots keep the colour of the day.
reset role;
insert into public.class_members (class_id, client_id, added_at)
values (3001, 1001, now() - interval '2 days');
set local role authenticated;
select public.snapshot_today(3001) as occ \gset

select results_eq(
  format($$ select exercise_id, colour from public.session_snapshot_rows
            where occurrence_id = %s order by position $$, :occ),
  $$ values (2001::bigint, 'blue'::text), (2002, 'blue') $$,
  'the snapshot records each exercise''s colour');

select * from finish();
rollback;
