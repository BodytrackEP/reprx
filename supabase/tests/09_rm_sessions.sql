-- RM testing sessions (update spec, Phase 6).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep');
insert into public.exercises (id, name) overriding system value values
  (2001, 'Zz Squat'), (2002, 'Zz Press');
insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz', 'One', true), (1002, 'Zz', 'Two', true);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values (3001, 'Zz Class', 'GENERAL', 1, '09:00', '10:00');
select public.create_program('Zz RM') as p \gset
select public.save_program_version(:p, 'Zz RM',
  '[{"exercise_id": 2001, "sets": 3, "reps": "10", "rm_percentage": 0.7}]');
select public.assign_program(3001, :p, public.practice_today());
insert into public.class_members (class_id, client_id) values (3001, 1001);

-- Staff do all of this through their own session.
set local role authenticated;

insert into public.rm_testing_sessions (client_id, test_date, notes)
values (1001, public.practice_today() - 60, 'Baseline') returning id as s1 \gset
insert into public.rm_testing_sessions (client_id, test_date)
values (1001, public.practice_today() - 30) returning id as s2 \gset
insert into public.rm_testing_sessions (client_id, test_date)
values (1002, public.practice_today() - 30) returning id as other \gset

select results_eq(
  $$ select client_id, session_no from public.rm_testing_sessions
     where client_id in (1001, 1002) order by id $$,
  $$ values (1001::bigint, 1), (1001::bigint, 2), (1002::bigint, 1) $$,
  'sessions are numbered per client');
select is(
  (select conducted_by::text from public.rm_testing_sessions where id = :s1),
  '00000000-0000-0000-0000-00000000000a', 'a session records who ran it');

-- One result per exercise per session
insert into public.rm_results (session_id, exercise_id, reps, weight_kg)
values (:s1, 2001, 3, 30) returning id as first \gset
select is((select estimated_1rm_kg from public.rm_results where id = :first), 33.00::numeric,
  'the Epley estimate is unchanged: 3RM at 30 kg gives 33.00');
select throws_ok(format(
  'insert into public.rm_results (session_id, exercise_id, reps, weight_kg) values (%s, 2001, 1, 40)', :s1),
  '23505', null, 'an exercise can appear only once per session');
select lives_ok(format(
  'insert into public.rm_results (session_id, exercise_id, reps, weight_kg) values (%s, 2002, 1, 40)', :s1),
  'a different exercise can join the same session');

select lives_ok(format($$ update public.rm_results set voided_at = now(), voided_reason = 'Wrong weight'
  where id = %s $$, :first), 'a result can be voided');
select is((select voided_by::text from public.rm_results where id = :first),
  '00000000-0000-0000-0000-00000000000a', 'voiding records who did it');
select lives_ok(format(
  'insert into public.rm_results (session_id, exercise_id, reps, weight_kg) values (%s, 2001, 1, 50)', :s1),
  'after a void the exercise can be recorded again in that session');

-- Weights use the latest valid result, by test date.
insert into public.rm_results (session_id, exercise_id, reps, weight_kg)
values (:s2, 2001, 1, 60) returning id as latest \gset
select results_eq(
  $$ select latest_1rm_kg, effective_kg from public.effective_weights(3001) where exercise_id = 2001 $$,
  $$ values (60.00::numeric, 42.5::numeric) $$, 'weights use the most recent session');
select is((select rm_result_id from public.effective_weights(3001) where exercise_id = 2001), :latest::bigint,
  'the result used is exposed for snapshots');

update public.rm_results set voided_at = now(), voided_reason = 'Entered in error' where id = :latest;
select results_eq(
  $$ select latest_1rm_kg, effective_kg from public.effective_weights(3001) where exercise_id = 2001 $$,
  $$ values (50.00::numeric, 35.0::numeric) $$, 'a voided result is skipped');

reset role;

select * from finish();
rollback;
