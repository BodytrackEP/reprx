-- Access: anon, AAL1, AAL2 EP, AAL2 admin, deactivated staff.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'admin@test.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'gone@test.invalid');
insert into public.staff (id, display_name, role, is_active) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep', true),
  ('00000000-0000-0000-0000-00000000000b', 'Test Admin', 'admin', true),
  ('00000000-0000-0000-0000-00000000000c', 'Former EP', 'ep', false);

insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz-One', 'Test', true);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values (3001, 'Zz Class', 'GENERAL', 1, '09:00', '10:00');
insert into public.programs (id, class_id, name) overriding system value values (4001, 3001, 'P');
insert into public.exercises (id, name) overriding system value values (2001, 'Zz Press');
insert into public.program_exercises (program_id, exercise_id, order_index, sets, reps)
  values (4001, 2001, 1, 3, 10);
insert into public.class_members (class_id, client_id, added_by)
  values (3001, 1001, '00000000-0000-0000-0000-00000000000a');

create schema test_helpers;
create function test_helpers.login(p_sub text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;
grant usage on schema test_helpers to anon, authenticated;
grant execute on function test_helpers.login(text, text) to anon, authenticated;

-- Anonymous: every table refuses, as does every RPC.
select test_helpers.login('', 'aal1');
set local role anon;

select throws_ok(format('select * from public.%I', t), '42501', null, 'anon cannot read ' || t)
from unnest(array[
  'staff', 'clients', 'class_categories', 'classes', 'class_members', 'exercises',
  'programs', 'program_exercises', 'rm_tests', 'weight_overrides', 'app_settings',
  'audit_log', 'effective_weights_v'
]) t;

select throws_ok('select * from public.effective_weights(3001)', '42501', null,
  'anon cannot call effective_weights');
select throws_ok('select public.purge_test_data()', '42501', null,
  'anon cannot call purge_test_data');

reset role;

-- Password-only session (AAL1): a real staff member, but no data without TOTP.
select test_helpers.login('00000000-0000-0000-0000-00000000000b', 'aal1');
set local role authenticated;

select is_empty('select * from public.clients', 'AAL1 reads no clients');
select is_empty('select * from public.staff', 'AAL1 reads no staff');
select is_empty('select * from public.effective_weights_v', 'AAL1 reads no weights');
select is_empty('select * from public.effective_weights(3001)', 'AAL1 gets nothing from the RPC');
select is_empty('select * from public.app_settings', 'AAL1 reads no settings');
select throws_ok(
  $$ insert into public.clients (first_name, last_name) values ('Zz', 'Blocked') $$,
  '42501', null, 'AAL1 cannot create a client');
select throws_ok('select public.purge_test_data()', '42501', null, 'AAL1 admin cannot purge');

reset role;

-- Deactivated staff: MFA is valid, access is gone.
select test_helpers.login('00000000-0000-0000-0000-00000000000c', 'aal2');
set local role authenticated;

select is_empty('select * from public.clients', 'deactivated staff read no clients');

reset role;

-- EP
select test_helpers.login('00000000-0000-0000-0000-00000000000a', 'aal2');
set local role authenticated;

select isnt_empty('select * from public.clients', 'an EP reads clients');
select isnt_empty('select * from public.effective_weights(3001)', 'an EP reads weights');
select lives_ok(
  $$ insert into public.clients (first_name, last_name, preferred_name) values ('Zz', 'New', 'Zed') $$,
  'an EP creates a client');
select throws_ok(
  $$ insert into public.clients (first_name, last_name, cliniko_shard, cliniko_patient_id)
     values ('Zz', 'Linked', 'au1', 1) $$,
  '42501', null, 'an EP cannot write Cliniko link fields directly');
select throws_ok(
  $$ update public.clients set auth_user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'an EP cannot set auth_user_id');
select throws_ok('delete from public.clients', '42501', null, 'an EP cannot hard-delete clients');
select throws_ok('delete from public.rm_tests', '42501', null, 'an EP cannot delete RM tests');
select throws_ok('delete from public.weight_overrides', '42501', null, 'an EP cannot delete overrides');
select is_empty('select * from public.audit_log', 'an EP cannot read the audit log');
select throws_ok('select public.purge_test_data()', '42501', null, 'an EP cannot purge');
select isnt_empty('select * from public.app_settings', 'an EP reads settings');

update public.app_settings set rm_warn_above_reps = 3;
update public.staff set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

select throws_ok(
  $$ insert into public.rm_tests (client_id, exercise_id, reps, weight_kg, recorded_by)
     values (1001, 2001, 1, 50, '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'an RM test cannot be attributed to someone else');
select throws_ok('insert into private.purge_context values (''1'')', '42501', null,
  'the audit bypass cannot be set by a caller');

reset role;

select is((select rm_warn_above_reps from public.app_settings), 6, 'an EP cannot change settings');
select is(
  (select role from public.staff where id = '00000000-0000-0000-0000-00000000000a'), 'ep',
  'an EP cannot promote themselves');

-- Admin
select test_helpers.login('00000000-0000-0000-0000-00000000000b', 'aal2');
set local role authenticated;

select isnt_empty('select * from public.audit_log', 'an admin reads the audit log');

update public.app_settings set rm_warn_above_reps = 5;

select throws_ok($$ update public.app_settings set environment = 'test' $$, '42501', null,
  'not even an admin can relabel the environment');
select throws_ok($$ update public.audit_log set actor_label = 'x' $$, '42501', null,
  'an admin cannot update the audit log');
select throws_ok('delete from public.audit_log', '42501', null,
  'an admin cannot delete from the audit log');

reset role;

select is((select rm_warn_above_reps from public.app_settings), 5, 'an admin changes settings');

select * from finish();
rollback;
