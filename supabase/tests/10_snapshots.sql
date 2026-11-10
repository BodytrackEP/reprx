-- Session occurrences and snapshots (update spec, Phase 5).
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

create schema test_helpers;
create function test_helpers.login(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;
grant usage on schema test_helpers to authenticated;
grant execute on function test_helpers.login(text) to authenticated;

select test_helpers.login('00000000-0000-0000-0000-00000000000a');

insert into public.exercises (id, name) overriding system value values (2001, 'Zz Squat');
insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz', 'One', true);
-- One class runs today, one tomorrow.
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time)
overriding system value values
  (3001, 'Zz Today', 'GENERAL', extract(dow from public.practice_today())::int, '00:00', '01:00'),
  (3002, 'Zz Tomorrow', 'GENERAL', extract(dow from public.practice_today() + 1)::int, '09:00', '10:00');

select public.create_program('Zz Snap') as p \gset
select public.save_program_version(:p, 'Zz Snap',
  '[{"exercise_id": 2001, "sets": 3, "reps": "10", "rm_percentage": 0.5}]');
select public.assign_program(3001, :p, public.practice_today() - 30);
insert into public.class_members (class_id, client_id, added_at)
values (3001, 1001, now() - interval '30 days');

insert into public.rm_testing_sessions (client_id, test_date) values (1001, public.practice_today() - 10)
returning id as s \gset
insert into public.rm_results (session_id, exercise_id, reps, weight_kg) values (:s, 2001, 1, 100)
returning id as result \gset

-- Opening today's session takes the snapshot.
set local role authenticated;
select public.snapshot_today(3001) as occ \gset
select is(public.snapshot_today(3002), null, 'no snapshot on a day the class doesn''t run');
reset role;

select results_eq(
  format($$ select effective_kg, weight_source, rm_result_id, program_version_id is not null
            from public.session_snapshot_rows where occurrence_id = %s $$, :occ),
  format($$ values (50.0::numeric, 'calculated'::text, %s::bigint, true) $$, :result),
  'the snapshot records the weight, the RM result used and the program version');

select isnt_empty(
  format($$ select 1 from public.audit_log where actor_label = 'snapshot:open' and row_pk = '%s' $$, :occ),
  'taking a snapshot is audited in one summary row');
select is_empty(
  $$ select 1 from public.audit_log where table_name = 'session_snapshot_rows' $$,
  'snapshot rows aren''t audited one by one');

-- Until the end of the day it refreshes.
select public.set_override(1001, 2001, 30, 'Box squat');
set local role authenticated;
select is(public.snapshot_today(3001), :occ::bigint, 'reopening refreshes the same occurrence');
reset role;
select results_eq(
  format($$ select effective_kg, is_override, override_note
            from public.session_snapshot_rows where occurrence_id = %s $$, :occ),
  $$ values (30.00::numeric, true, 'Box squat'::text) $$,
  'an open snapshot picks up today''s override and note');

-- Corrections are for locked sessions only, and admins only.
select test_helpers.login('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok(format('select public.edit_snapshot_row(%s, 40, null)',
  (select id from public.session_snapshot_rows where occurrence_id = :occ)),
  'RX011', null, 'today''s open session can''t be hand-edited');
reset role;

-- End of day: lock.
select private.lock_sessions(public.practice_today());
select is((select status from public.session_occurrences where id = :occ), 'locked',
  'the end-of-day job locks the session');

select public.set_override(1001, 2001, 99, 'Changed later');
insert into public.rm_results (session_id, exercise_id, reps, weight_kg)
values (:s, 2001, 1, 200) on conflict do nothing;
set local role authenticated;
select is(public.snapshot_today(3001), :occ::bigint, 'opening a locked session changes nothing');
reset role;
select results_eq(
  format($$ select effective_kg, override_note from public.session_snapshot_rows where occurrence_id = %s $$, :occ),
  $$ values (30.00::numeric, 'Box squat'::text) $$,
  'past performance is never recalculated');

select throws_ok(
  format('update public.session_snapshot_rows set effective_kg = 1 where occurrence_id = %s', :occ),
  'RX011', null, 'a locked snapshot can''t be changed directly, even by the owner');

select test_helpers.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok(format('select public.edit_snapshot_row(%s, 40, null)',
  (select id from public.session_snapshot_rows where occurrence_id = :occ)),
  '42501', null, 'an EP can''t correct a past session');
reset role;

select test_helpers.login('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select lives_ok(format($$ select public.edit_snapshot_row(%s, 32.5, 'Box squat, 45 cm') $$,
  (select id from public.session_snapshot_rows where occurrence_id = :occ)),
  'an admin corrects a locked session');
reset role;
select results_eq(
  $$ select old_row ->> 'effective_kg', new_row ->> 'effective_kg', new_row ->> 'override_note', actor::text
     from public.audit_log where table_name = 'session_snapshot_rows' and action = 'UPDATE' $$,
  $$ values ('30.00', '32.5', 'Box squat, 45 cm', '00000000-0000-0000-0000-00000000000b') $$,
  'the correction is audited with old and new values');

-- The start-time job creates a missing snapshot for a session that has started.
delete from public.session_occurrences where id = :occ;
select is(private.snapshot_started_sessions(), 1, 'a started session without a snapshot gets one');
select is(private.snapshot_started_sessions(), 0, 'and only once');

-- The lock job creates missing snapshots for a past date from enrolments.
select is(
  (select count(*)::int from public.effective_weights_at(3001, public.practice_today() - 7)), 1,
  'a past date uses who was enrolled then');
select is(
  (select count(*)::int from public.effective_weights_at(3001, public.practice_today() - 60)), 0,
  'before the client enrolled, they aren''t in the session');

-- A future date with a queued program uses that program.
select public.duplicate_program(:p, 'Zz Next') as next \gset
update public.class_program_assignments set end_date = public.practice_today() + 6 where class_id = 3001;
select public.assign_program(3001, :next, public.practice_today() + 7);
select public.save_program_version(:next, 'Zz Next',
  '[{"exercise_id": 2001, "sets": 5, "reps": "5", "rm_percentage": 0.8}]');
select is(
  (select sets from public.effective_weights_at(3001, public.practice_today() + 7)), 5,
  'a future date shows the queued program');

-- The test-data purge still removes a fake client's locked snapshots.
select test_helpers.login('00000000-0000-0000-0000-00000000000b');
select private.lock_sessions(public.practice_today());
set local role authenticated;
select lives_ok('select public.purge_test_data()', 'purge works with locked snapshots');
reset role;
select is_empty('select 1 from public.session_snapshot_rows where client_id = 1001',
  'the fake client''s snapshot rows are gone');

select * from finish();
rollback;
