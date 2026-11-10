-- Supersets (update spec, Phase 2).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep');
insert into public.exercises (id, name) overriding system value values
  (2001, 'Zz A'), (2002, 'Zz B'), (2003, 'Zz C'), (2004, 'Zz D');
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values (3001, 'Zz Class', 'GENERAL', 1, '09:00', '10:00');

select public.create_program('Zz Supersets') as p \gset

-- Library rules
select throws_ok(format($$ select public.save_program_version(%s, 'x', '[
    {"exercise_id": 2001, "sets": 3, "reps": "10", "superset_group": 1},
    {"exercise_id": 2002, "sets": 3, "reps": "10"},
    {"exercise_id": 2003, "sets": 3, "reps": "10", "superset_group": 1}]') $$, :p),
  'RX010', null, 'a superset must be adjacent');
select throws_ok(format($$ select public.save_program_version(%s, 'x', '[
    {"exercise_id": 2001, "sets": 3, "reps": "10", "superset_group": 1},
    {"exercise_id": 2002, "sets": 3, "reps": "10"}]') $$, :p),
  'RX010', null, 'a superset needs at least 2 exercises');

select lives_ok(format($$ select public.save_program_version(%s, 'Zz Supersets', '[
    {"exercise_id": 2001, "sets": 3, "reps": "10", "superset_group": 1},
    {"exercise_id": 2002, "sets": 4, "reps": "8", "superset_group": 1},
    {"exercise_id": 2003, "sets": 3, "reps": "10", "superset_group": 1},
    {"exercise_id": 2004, "sets": 3, "reps": "10"}]') $$, :p),
  'a superset of 3 adjacent exercises is valid, each with its own sets and reps');

-- The class copy takes the grouping with the version.
select public.assign_program(3001, :p, public.practice_today()) as a \gset
select is(
  (select array_agg(coalesce(superset_group, 0) order by position)
   from public.class_program_items where assignment_id = :a),
  array[1, 1, 1, 0], 'superset membership reaches the class');

-- Removing the middle of a group of 3 leaves a valid pair.
select public.remove_class_item(
  (select id from public.class_program_items where assignment_id = :a and position = 2));
select is(
  (select array_agg(coalesce(superset_group, 0) order by position)
   from public.class_program_items where assignment_id = :a and not is_removed),
  array[1, 1, 0], 'the rest of the group stays together');

-- Removing another leaves one exercise, which can't be a superset.
select public.remove_class_item(
  (select id from public.class_program_items
   where assignment_id = :a and not is_removed and position = 3));
select is(
  (select count(*)::int from public.class_program_items
   where assignment_id = :a and not is_removed and superset_group is not null),
  0, 'a lone exercise is ungrouped');

-- Class grouping
select public.reset_class_item(id) from public.class_program_items where assignment_id = :a and is_removed;
select throws_ok(format($$ select public.set_class_superset(array(
    select id from public.class_program_items
    where assignment_id = %s and exercise_id in (2001, 2003))) $$, :a),
  'RX010', null, 'a class can only group adjacent exercises');

select public.clear_class_superset(array(
  select id from public.class_program_items where assignment_id = :a));
select lives_ok(format($$ select public.set_class_superset(array(
    select id from public.class_program_items
    where assignment_id = %s and exercise_id in (2003, 2004))) $$, :a),
  'a class groups two adjacent exercises');
select ok(
  (select bool_and(is_customised) from public.class_program_items
   where assignment_id = :a and exercise_id in (2003, 2004)),
  'regrouping in the class makes those rows the class''s own');

-- Dragging marks only the dragged row.
select public.reset_class_item(id) from public.class_program_items where assignment_id = :a;
select public.move_class_item_to(
  (select id from public.class_program_items where assignment_id = :a and exercise_id = 2004), 1);
select is(
  (select array_agg(exercise_id order by position) from public.class_program_items
   where assignment_id = :a and not is_removed),
  array[2004, 2001, 2002, 2003]::bigint[], 'a dragged row lands where it was dropped');
select is(
  (select array_agg(exercise_id order by exercise_id) from public.class_program_items
   where assignment_id = :a and is_customised),
  array[2004]::bigint[], 'only the dragged row becomes customised');

-- A customised row now sits just before the library group; a library change that groups the
-- first two rows keeps the class valid.
select public.save_program_version(:p, 'Zz Supersets', (
  select jsonb_agg(jsonb_build_object(
    'item_key', i.item_key, 'exercise_id', i.exercise_id, 'sets', i.sets, 'reps', i.reps,
    'superset_group', case when i.position <= 2 then 1 end) order by i.position)
  from public.program_version_items i
  join public.library_programs l on l.current_version_id = i.version_id
  where l.id = :p));
select is_empty(format($$
  with visible as (
    select superset_group, row_number() over (order by position) as rn
    from public.class_program_items where assignment_id = %s and not is_removed)
  select superset_group from visible where superset_group is not null
  group by superset_group
  having count(*) < 2 or max(rn) - min(rn) + 1 <> count(*) $$, :a),
  'after a push every class superset is still adjacent and 2+');

select * from finish();
rollback;
