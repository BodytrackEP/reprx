-- Business rules: capacity, moves, append-only RM tests, override history, audit.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ep@test.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'admin@test.invalid');
insert into public.staff (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test EP', 'ep'),
  ('00000000-0000-0000-0000-00000000000b', 'Test Admin', 'admin');

insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz-One', 'Test', true),
  (1002, 'Zz-Two', 'Test', true),
  (1003, 'Zz-Three', 'Test', true);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time, max_capacity)
overriding system value values
  (3001, 'Zz Source', 'GENERAL', 1, '09:00', '10:00', 5),
  (3002, 'Zz Small', 'GENERAL', 2, '09:00', '10:00', 1);
insert into public.exercises (id, name) overriding system value values (2001, 'Zz Press');

create schema test_helpers;
create function test_helpers.login(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;
grant usage on schema test_helpers to authenticated;
grant execute on function test_helpers.login(text) to authenticated;

select test_helpers.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select lives_ok('select public.add_class_members(3001, array[1001, 1002, 1003]::bigint[])',
  'members are added');
select lives_ok('select public.add_class_members(3001, array[1001]::bigint[])',
  'adding an existing member is a no-op');
select lives_ok('select public.add_class_members(3002, array[1001]::bigint[])',
  'the last place is taken');

-- Capacity
select throws_ok('select public.add_class_members(3002, array[1002]::bigint[])',
  'RX001', 'Zz Small is full (1 of 1 places taken).', 'the error names the class');
select throws_ok('select public.add_class_members(3002, array[1002]::bigint[], true)',
  'RX001', null, 'an EP cannot use the capacity override');

-- Assigning classes is all-or-nothing
select throws_ok('select public.set_client_classes(1003, array[3002]::bigint[])',
  'RX001', null, 'assigning a full class fails');
select is(
  (select array_agg(class_id) from public.class_members where client_id = 1003),
  array[3001]::bigint[], 'a failed assignment keeps the existing classes');

-- A failed move changes nothing
select throws_ok('select public.move_client(1002, 3001, 3002)', 'RX001', null,
  'a move into a full class fails');
select is(
  (select count(*)::int from public.class_members where client_id = 1002 and class_id = 3001), 1,
  'a failed move leaves the client in the source class');

select throws_ok('select public.move_client(1002, 3002, 3001)', 'RX006', null,
  'a client can only be moved from a class they belong to');
select throws_ok('select public.move_client(1002, 3001, 3001)', 'RX006', null,
  'a move needs a different target');

-- A successful move, with an override and a test in place
select lives_ok(
  $$ select public.set_override(1002, 2001, 20, 'L knee rehab') $$, 'override set');
select lives_ok(
  $$ insert into public.rm_tests (client_id, exercise_id, reps, weight_kg) values (1002, 2001, 1, 60) $$,
  'test recorded');

update public.classes set max_capacity = 2 where id = 3002;

select lives_ok('select public.move_client(1002, 3001, 3002)', 'the move succeeds');
select is(
  (select array_agg(class_id order by class_id) from public.class_members where client_id = 1002),
  array[3002]::bigint[], 'the client is in the target class only');
select is(
  (select count(*)::int from public.weight_overrides where client_id = 1002 and ended_at is null), 1,
  'the override survives the move');
select is(
  (select count(*)::int from public.rm_tests where client_id = 1002), 1,
  'the RM test survives the move');

-- Admin capacity override
reset role;
select test_helpers.login('00000000-0000-0000-0000-00000000000b');
set local role authenticated;

select lives_ok('select public.add_class_members(3002, array[1003]::bigint[], true)',
  'an admin can exceed capacity');
select set_config('reprx.allow_over_capacity', 'off', true);

reset role;

select results_eq(
  $$ select action, actor::text from public.audit_log
     where table_name = 'class_members' and row_pk = '3001:1002' and action = 'DELETE' $$,
  $$ values ('DELETE'::text, '00000000-0000-0000-0000-00000000000a'::text) $$,
  'the move is audited with its actor');
select isnt_empty(
  $$ select 1 from public.audit_log where table_name = 'class_members'
     and row_pk = '3002:1002' and action = 'INSERT' $$,
  'the arrival is audited');

select test_helpers.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

-- RM tests are append-only
select throws_ok('update public.rm_tests set weight_kg = 99 where client_id = 1002',
  'RX003', null, 'an RM test cannot be edited');
select throws_ok(
  $$ update public.rm_tests set weight_kg = 99, voided_at = now(), voided_reason = 'sneaky'
     where client_id = 1002 $$,
  'RX003', null, 'voiding cannot smuggle in an edit');
select throws_ok(
  $$ update public.rm_tests set voided_at = now() where client_id = 1002 $$,
  '23514', null, 'voiding needs a reason');
select lives_ok(
  $$ update public.rm_tests set voided_at = now(), voided_reason = 'Wrong client'
     where client_id = 1002 $$,
  'a test can be voided');
select throws_ok(
  $$ update public.rm_tests set voided_at = now(), voided_reason = 'Again please'
     where client_id = 1002 $$,
  'RX003', null, 'a test can only be voided once');

-- Overrides keep their history
select lives_ok(
  $$ select public.set_override(1002, 2001, 25, 'Knee improving') $$, 'override replaced');
select results_eq(
  $$ select count(*)::int, count(*) filter (where ended_at is null)::int
     from public.weight_overrides where client_id = 1002 and exercise_id = 2001 $$,
  $$ values (2, 1) $$,
  'replacing keeps the old row and one active override');
select throws_ok(
  $$ update public.weight_overrides set override_weight_kg = 5
     where client_id = 1002 and ended_at is null $$,
  'RX004', null, 'an active override cannot be edited in place');
select throws_ok(
  $$ update public.weight_overrides set ended_at = null, ended_by = null
     where client_id = 1002 and ended_at is not null $$,
  'RX004', null, 'an ended override cannot be reopened');
select throws_ok(
  $$ insert into public.weight_overrides (client_id, exercise_id, override_weight_kg, reason)
     values (1002, 2001, 5, 'Second active') $$,
  '23505', null, 'only one override can be active');
select throws_ok(
  $$ select public.set_override(1002, 2001, 5, repeat('x', 201)) $$,
  '23514', null, 'the reason is limited to 200 characters');

reset role;

-- Audit immutability holds even for the table owner
select throws_ok($$ update public.audit_log set actor_label = 'x' $$, 'RX005', null,
  'the audit log cannot be updated');
select throws_ok('delete from public.audit_log', 'RX005', null,
  'the audit log cannot be deleted from');
select throws_ok('truncate public.audit_log', 'RX005', null,
  'the audit log cannot be truncated');

-- Authenticator resets: admins only, never your own, always audited
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a');

select test_helpers.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok(
  $$ select public.record_authenticator_reset('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'an EP cannot reset an authenticator');
reset role;

select test_helpers.login('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok(
  $$ select public.record_authenticator_reset('00000000-0000-0000-0000-00000000000b') $$,
  'RX007', 'You can''t reset your own authenticator. Ask another admin.',
  'an admin cannot reset their own authenticator');
select throws_ok(
  $$ select public.record_authenticator_reset('00000000-0000-0000-0000-0000000000ff') $$,
  'RX007', null, 'the target must be a staff member');
select lives_ok(
  $$ select public.record_authenticator_reset('00000000-0000-0000-0000-00000000000a') $$,
  'an admin resets another staff member');
reset role;

select is_empty(
  $$ select 1 from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'the reset ends that person''s sessions');
select results_eq(
  $$ select actor::text, actor_label, row_pk from public.audit_log
     where actor_label = 'mfa:reset' $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::text, 'mfa:reset'::text,
             '00000000-0000-0000-0000-00000000000a'::text) $$,
  'the reset is audited with the admin and the target');

-- Invite links: admins only, always audited, and the link is never stored
select test_helpers.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok(
  $$ select public.record_invite_link('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'an EP cannot create an invite link');
reset role;

select test_helpers.login('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok(
  $$ select public.record_invite_link('00000000-0000-0000-0000-0000000000ff') $$,
  'RX007', null, 'an invite link needs an active staff member');
select lives_ok(
  $$ select public.record_invite_link('00000000-0000-0000-0000-00000000000a') $$,
  'an admin records an invite link');
reset role;

select results_eq(
  $$ select actor::text, row_pk, new_row from public.audit_log
     where actor_label = 'invite:link' $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::text,
             '00000000-0000-0000-0000-00000000000a'::text,
             '{"event": "invite_link_created"}'::jsonb) $$,
  'the audit row names the admin and the person, and holds no link');

-- Jobs label themselves
select set_config('reprx.actor_label', 'sync:cliniko', true);
select set_config('request.jwt.claims', '', true);
update public.clients set first_name = 'Zz-Synced' where id = 1003;
select results_eq(
  $$ select actor_label, actor from public.audit_log
     where table_name = 'clients' and row_pk = '1003' and action = 'UPDATE' $$,
  $$ values ('sync:cliniko'::text, null::uuid) $$,
  'sync jobs are recorded by label');

select * from finish();
rollback;
