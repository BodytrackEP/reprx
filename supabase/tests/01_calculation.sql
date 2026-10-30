-- The §5 calculation cases.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep');

insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz-One', 'Test', true),
  (1002, 'Zz-Two', 'Test', true);

insert into public.exercises (id, name) overriding system value values
  (2001, 'Zz Press'), (2002, 'Zz Row'), (2003, 'Zz Curl'), (2004, 'Zz Plank');

insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values
  (3001, 'Zz Class A', 'GENERAL', 1, '09:00', '10:00'),
  (3002, 'Zz Class B', 'GENERAL', 2, '09:00', '10:00');

insert into public.programs (id, class_id, name) overriding system value values
  (4001, 3001, 'Program A'), (4002, 3002, 'Program B');

insert into public.program_exercises
  (program_id, exercise_id, order_index, sets, reps, rm_percentage, fallback_weight_kg) values
  (4001, 2001, 1, 3, 10, 0.700, null),
  (4001, 2002, 2, 3, 10, 0.600, 20),
  (4001, 2003, 3, 3, 10, 0.600, null),
  (4001, 2004, 4, 3, 10, null,  null),
  (4002, 2001, 1, 3, 10, 0.500, null);

insert into public.class_members (class_id, client_id) values
  (3001, 1001), (3001, 1002), (3002, 1001);

-- Epley
insert into public.rm_tests (client_id, exercise_id, test_date, reps, weight_kg) values
  (1002, 2003, '2026-01-01', 3, 30),
  (1002, 2004, '2026-01-01', 1, 50);

select is((select estimated_1rm_kg from public.rm_tests where client_id = 1002 and exercise_id = 2003),
  33.00::numeric, '3RM at 30 kg gives a 1RM of 33.00 kg');
select is((select estimated_1rm_kg from public.rm_tests where client_id = 1002 and exercise_id = 2004),
  50.00::numeric, '1RM at 50 kg gives 50 kg, not raw Epley');

-- Rounding
select is(public.round_to_increment(40.25, 2.5), 40.0::numeric, '40.25 rounds down to 40.0');
select is(public.round_to_increment(41.25, 2.5), 42.5::numeric, 'half rounds up');
select is(public.round_to_increment(-41.25, 2.5), -42.5::numeric, 'half rounds away from zero');

-- Calculated
insert into public.rm_tests (client_id, exercise_id, test_date, reps, weight_kg) values
  (1001, 2001, '2026-01-01', 1, 57.5);

select results_eq(
  $$ select effective_kg, weight_source, latest_1rm_kg, calculated_kg
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2001 $$,
  $$ values (40.0::numeric, 'calculated'::text, 57.50::numeric, 40.0::numeric) $$,
  '70% of a 57.5 kg 1RM is 40.25, which rounds to 40.0');

-- Override beats calculated, and follows the client into the other class
select lives_ok(
  $$ select public.set_override(1001, 2001, 25, 'L shoulder rehab', '2026-01-01') $$,
  'set_override succeeds');

select results_eq(
  $$ select effective_kg, weight_source, override_reason, calculated_kg
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2001 $$,
  $$ values (25.00::numeric, 'override'::text, 'L shoulder rehab'::text, 40.0::numeric) $$,
  'an override beats the calculated weight');

select is(
  (select weight_source from public.effective_weights(3002) where client_id = 1001 and exercise_id = 2001),
  'override', 'the override applies in every class with that exercise');

-- Ending reverts
select lives_ok(
  $$ select public.end_override(id) from public.weight_overrides
     where client_id = 1001 and exercise_id = 2001 and ended_at is null $$,
  'end_override succeeds');

select results_eq(
  $$ select effective_kg, weight_source
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2001 $$,
  $$ values (40.0::numeric, 'calculated'::text) $$,
  'ending an override reverts to the calculated weight');

-- Voided tests
insert into public.rm_tests (client_id, exercise_id, test_date, reps, weight_kg) values
  (1001, 2001, '2026-06-01', 1, 200);

select is(
  (select effective_kg from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2001),
  140.0::numeric, 'the latest test by date is used');

update public.rm_tests set voided_at = now(), voided_reason = 'Entered in error'
where client_id = 1001 and exercise_id = 2001 and test_date = '2026-06-01';

select results_eq(
  $$ select effective_kg, latest_test_date
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2001 $$,
  $$ values (40.0::numeric, '2026-01-01'::date) $$,
  'a voided test is ignored');

-- Fallback only without a test
select results_eq(
  $$ select effective_kg, weight_source
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2002 $$,
  $$ values (20.00::numeric, 'fallback'::text) $$,
  'the fallback is used when there is no test');

insert into public.rm_tests (client_id, exercise_id, test_date, reps, weight_kg) values
  (1001, 2002, '2026-01-01', 1, 50);

select results_eq(
  $$ select effective_kg, weight_source
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2002 $$,
  $$ values (30.0::numeric, 'calculated'::text) $$,
  'the fallback is not used once a test exists');

-- No load information
select results_eq(
  $$ select effective_kg, weight_source
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2003 $$,
  $$ values (null::numeric, 'not_tested'::text) $$,
  'no test and no fallback is not_tested');

select results_eq(
  $$ select effective_kg, weight_source
     from public.effective_weights(3001) where client_id = 1001 and exercise_id = 2004 $$,
  $$ values (null::numeric, 'bodyweight'::text) $$,
  'no percentage means bodyweight');

-- The rounding increment comes from settings
update public.app_settings set rounding_increment_kg = 1.25;
select is(
  (select effective_kg from public.effective_weights(3002) where client_id = 1001 and exercise_id = 2001),
  28.75::numeric, 'the configured increment drives the rounding');
update public.app_settings set rounding_increment_kg = 2.5;

-- For-client variant, and soft-deleted clients
select is(
  (select count(*)::int from public.effective_weights_for_client(1001)), 5,
  'effective_weights_for_client spans all of the client''s classes');

update public.clients set deleted_at = now() where id = 1002;

select is(
  (select count(*)::int from public.effective_weights(3001) where client_id = 1002), 0,
  'soft-deleted clients leave the session view');

select * from finish();
rollback;
