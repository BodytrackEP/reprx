-- Purge removes every is_test record and nothing else (§6.5).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

-- Clients start empty so the counts below are exact. Classes and exercises are compared
-- before and after, since programs reference them. All of this rolls back.
delete from public.clients;
create temp table shared_before on commit drop as
  select (select count(*)::int from public.classes) as classes,
         (select count(*)::int from public.exercises) + 1 as exercises;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'admin@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000b', 'Test Admin', 'admin');

insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz-Fake', 'Test', true),
  (1002, 'Zz-Fake2', 'Test', true),
  (1003, 'Zz-Real', 'Person', false);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values (3001, 'Zz Class', 'GENERAL', 1, '09:00', '10:00');
insert into public.exercises (id, name) overriding system value values (2001, 'Zz Press');

insert into public.class_members (class_id, client_id, added_by)
select 3001, c, '00000000-0000-0000-0000-00000000000b' from unnest(array[1001, 1002, 1003]) c;
with s as (
  insert into public.rm_testing_sessions (client_id, conducted_by)
  select c, '00000000-0000-0000-0000-00000000000b' from unnest(array[1001, 1002, 1003]) c
  returning id
)
insert into public.rm_results (session_id, exercise_id, reps, weight_kg, recorded_by)
select id, 2001, 1, 50, '00000000-0000-0000-0000-00000000000b' from s;
insert into public.weight_overrides (client_id, exercise_id, override_weight_kg, reason, set_by)
select c, 2001, 20, 'Zz reason', '00000000-0000-0000-0000-00000000000b' from unnest(array[1001, 1003]) c;

create temp table audit_before on commit drop as select count(*)::int n from public.audit_log;
grant select on audit_before to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is(
  public.purge_test_data(),
  '{"clients": 2, "class_members": 2, "rm_sessions": 2, "rm_results": 2, "weight_overrides": 1}'::jsonb,
  'purge reports what it removed');

reset role;

select results_eq('select id from public.clients order by id', 'values (1003::bigint)',
  'only the real client remains');
select results_eq('select client_id from public.class_members', 'values (1003::bigint)',
  'the real client''s membership remains');
select results_eq('select client_id from public.rm_results_v', 'values (1003::bigint)',
  'the real client''s test remains');
select results_eq('select client_id from public.weight_overrides', 'values (1003::bigint)',
  'the real client''s override remains');
select is((select count(*)::int from public.classes), (select classes + 1 from shared_before),
  'classes are untouched');
select is((select count(*)::int from public.exercises), (select exercises from shared_before),
  'exercises are untouched');

select is(
  (select count(*)::int from public.audit_log) - (select n from audit_before), 1,
  'purge writes exactly one audit row');
select results_eq(
  $$ select actor::text, actor_label, table_name, row_pk, action from public.audit_log
     order by id desc limit 1 $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::text, 'purge:test-data'::text,
             'clients'::text, '*'::text, 'DELETE'::text) $$,
  'the summary row names the admin');

select is_empty('select * from private.purge_context', 'no bypass is left behind');

update public.clients set first_name = 'Zz-Real2' where id = 1003;
select isnt_empty(
  $$ select 1 from public.audit_log where table_name = 'clients' and row_pk = '1003'
     and action = 'UPDATE' $$,
  'per-row auditing resumes after a purge');

select * from finish();
rollback;
