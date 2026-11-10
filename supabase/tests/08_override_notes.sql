-- Override notes and dormant overrides (update spec, Phase 4).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep');
insert into public.exercises (id, name) overriding system value values
  (2001, 'Zz Squat'), (2002, 'Zz Press');
insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz', 'One', true);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values (3001, 'Zz Class', 'GENERAL', 1, '09:00', '10:00');

select public.create_program('Zz Notes') as p \gset
select public.save_program_version(:p, 'Zz Notes', '[
  {"exercise_id": 2001, "sets": 3, "reps": "10", "rm_percentage": 0.7},
  {"exercise_id": 2002, "sets": 3, "reps": "10", "rm_percentage": 0.7}]');
select public.assign_program(3001, :p, public.practice_today()) as a \gset
insert into public.class_members (class_id, client_id) values (3001, 1001);

-- Notes are optional and short.
select lives_ok($$ select public.set_override(1001, 2001, 40) $$, 'an override needs no note');
select is(
  (select override_note from public.effective_weights(3001) where exercise_id = 2001), null,
  'with no note, the cell has only the weight');

select lives_ok($$ select public.set_override(1001, 2001, 40, 'Trap bar instead') $$,
  'a note describes the exercise change');
select results_eq(
  $$ select effective_kg, weight_source, override_note
     from public.effective_weights(3001) where exercise_id = 2001 $$,
  $$ values (40.00::numeric, 'override'::text, 'Trap bar instead'::text) $$,
  'the note reaches the session grid');
select throws_ok($$ select public.set_override(1001, 2001, 40, repeat('x', 201)) $$,
  '23514', null, 'notes are limited to 200 characters');

select isnt_empty(
  $$ select 1 from public.audit_log
     where table_name = 'weight_overrides' and new_row ->> 'note' = 'Trap bar instead' $$,
  'the audit log records the note');

-- Dormancy is derived: removing the exercise hides the override without deleting it.
select ok(not (select is_dormant from public.client_overrides_v where client_id = 1001),
  'an override is live while the exercise is in the program');

select public.remove_class_item(
  (select id from public.class_program_items where assignment_id = :a and exercise_id = 2001));
select ok((select is_dormant from public.client_overrides_v where client_id = 1001),
  'it goes dormant when the exercise leaves the client''s program');
select is_empty(
  $$ select 1 from public.effective_weights(3001) where exercise_id = 2001 $$,
  'a dormant override isn''t shown');
select is((select count(*)::int from public.weight_overrides where client_id = 1001 and ended_at is null),
  1, 'the dormant override is kept');

select public.reset_class_item(
  (select id from public.class_program_items where assignment_id = :a and exercise_id = 2001));
select results_eq(
  $$ select effective_kg, override_note from public.effective_weights(3001) where exercise_id = 2001 $$,
  $$ values (40.00::numeric, 'Trap bar instead'::text) $$,
  'it applies again automatically when the exercise returns');

select * from finish();
rollback;
