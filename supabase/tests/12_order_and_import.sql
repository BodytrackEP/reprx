-- Client order per class, and the all-or-nothing CSV import.
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

insert into public.clients (id, first_name, last_name, is_test) overriding system value values
  (1001, 'Zz', 'One', true), (1002, 'Zz', 'Two', true), (1003, 'Zz', 'Three', true);
insert into public.classes (id, name, category_code, day_of_week, start_time, end_time, max_capacity)
overriding system value values
  (3001, 'Zz A', 'GENERAL', 1, '09:00', '10:00', null),
  (3002, 'Zz Small', 'GENERAL', 2, '09:00', '10:00', 1);
insert into public.class_members (class_id, client_id, added_by) values
  (3001, 1001, '00000000-0000-0000-0000-00000000000a'),
  (3001, 1002, '00000000-0000-0000-0000-00000000000a'),
  (3001, 1003, '00000000-0000-0000-0000-00000000000a');

set local role authenticated;

-- Order.
select lives_ok($$ select public.set_member_order(3001, array[1003, 1001, 1002]::bigint[]) $$,
  'staff set a class''s client order');
select results_eq(
  $$ select client_id from public.class_members where class_id = 3001 order by position $$,
  $$ values (1003::bigint), (1001), (1002) $$,
  'members take the given positions');
select throws_ok($$ select public.set_member_order(3001, array[1003, 1001]::bigint[]) $$,
  'RX002', null, 'a list missing a member is refused');
select throws_ok($$ select public.set_member_order(3001, array[1003, 1001, 1001]::bigint[]) $$,
  'RX002', null, 'a list with a repeat is refused');
select throws_ok($$ update public.class_members set added_at = now() where class_id = 3001 $$,
  '42501', null, 'staff can change only the position of a membership');

-- Import.
select is(
  public.import_clients(
    '[{"first_name": " Imp ", "last_name": "New", "preferred_name": "", "class_ids": [3001]},
      {"first_name": "Imp", "last_name": "Solo", "class_ids": []}]',
    '[{"client_id": 1001, "class_ids": [3001, 3002]}]'),
  '{"created": 2, "memberships": 2}'::jsonb,
  'import creates clients and adds memberships, skipping existing ones');
select results_eq(
  $$ select first_name, preferred_name, is_test from public.clients where last_name = 'New' $$,
  $$ values ('Imp'::text, null::text, true) $$,
  'imported names are trimmed and test-flagged outside prod');
select is(
  (select position from public.class_members m join public.clients c on c.id = m.client_id
   where m.class_id = 3001 and c.last_name = 'New'),
  null, 'an imported member has no place yet, so sorts last');

select throws_ok(
  $$ select public.import_clients(
       '[{"first_name": "Imp", "last_name": "Over", "class_ids": [3002]}]', '[]') $$,
  'RX001', null, 'an over-full class fails the import');
select is((select count(*)::int from public.clients where last_name = 'Over'), 0,
  'and nothing from it is kept');

reset role;
update public.app_settings set environment = 'unset';
set local role authenticated;
select throws_ok(
  $$ select public.import_clients('[{"first_name": "A", "last_name": "B"}]', '[]') $$,
  'RX012', null, 'an unconfigured environment refuses the import');

select * from finish();
rollback;
