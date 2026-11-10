-- Enrolments and program history (update spec, Phase 3).
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
insert into public.exercises (id, name) overriding system value values (2001, 'Zz Press');
insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz', 'One', true);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values
  (3001, 'Zz From', 'GENERAL', 1, '09:00', '10:00'),
  (3002, 'Zz To', 'GENERAL', 2, '09:00', '10:00');

select public.create_program('Zz History') as p \gset
select public.save_program_version(:p, 'Zz History',
  '[{"exercise_id": 2001, "sets": 3, "reps": "10", "rm_percentage": 0.7}]');
select public.assign_program(3001, :p, public.practice_today() - 60) as a \gset
select public.assign_program(3002, :p, public.practice_today() - 60);

-- Joining opens an enrolment from the day the client was added.
insert into public.class_members (class_id, client_id, added_at)
values (3001, 1001, now() - interval '30 days');
select results_eq(
  $$ select start_date, end_date from public.enrolments where client_id = 1001 $$,
  $$ values (public.practice_today() - 30, null::date) $$,
  'adding a member opens an enrolment');

-- A move closes one enrolment and opens another; nothing is overwritten.
set local role authenticated;
select public.move_client(1001, 3001, 3002);
reset role;
select results_eq(
  $$ select class_id, start_date, end_date from public.enrolments
     where client_id = 1001 order by class_id $$,
  $$ values (3001::bigint, public.practice_today() - 30, public.practice_today()),
            (3002::bigint, public.practice_today(), null::date) $$,
  'a move closes the old enrolment and opens a new one');

-- Staff can't edit history.
set local role authenticated;
select throws_ok($$ update public.enrolments set end_date = null $$, '42501', null,
  'staff can''t change enrolments');
select throws_ok(
  $$ insert into public.enrolments (class_id, client_id, start_date) values (3001, 1001, '2020-01-01') $$,
  '42501', null, 'staff can''t create enrolments by hand');
reset role;

-- A version pushed 10 days ago splits the history into two versions.
update public.class_program_pushes
set applied_at = (public.practice_today() - 60)::timestamp at time zone 'Australia/Brisbane'
where assignment_id = :a;
insert into public.program_versions (program_id, version_no)
values (:p, 99) returning id as v99 \gset
insert into public.class_program_pushes (assignment_id, version_id, applied_at)
values (:a, :v99, (public.practice_today() - 10)::timestamp at time zone 'Australia/Brisbane');

select results_eq(
  $$ select class_name, version_no, from_date, to_date
     from public.client_program_history(1001) where class_id = 3001 order by from_date $$,
  $$ values ('Zz From'::text, 2, public.practice_today() - 30, public.practice_today() - 11),
            ('Zz From'::text, 99, public.practice_today() - 10, public.practice_today()) $$,
  'history names the version in effect on each date');

select results_eq(
  $$ select class_name, to_date from public.client_program_history(1001) where class_id = 3002 $$,
  $$ values ('Zz To'::text, null::date) $$,
  'the current enrolment is ongoing');

select is(
  (select count(distinct client_id)::int from public.program_client_history(:p)), 1,
  'the program lists the clients who have done it');

-- Only past and current periods are history.
select is_empty(
  $$ select 1 from public.client_program_history(1001) where from_date > public.practice_today() $$,
  'nothing in the future appears in history');

-- Purging a test client removes their enrolments too.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'admin@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000b', 'Test Admin', 'admin');
set local role authenticated;
select public.purge_test_data();
reset role;
select is_empty('select 1 from public.enrolments where client_id = 1001',
  'purging a test client removes their enrolments');

select * from finish();
rollback;
