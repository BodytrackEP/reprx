-- Structural guarantees: the privacy stance (§3) and the security baseline (§10).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select columns_are('public', 'clients', array[
  'id', 'first_name', 'last_name', 'preferred_name', 'source', 'is_test',
  'cliniko_shard', 'cliniko_patient_id', 'cliniko_linked_at', 'cliniko_linked_by',
  'cliniko_archived_at', 'cliniko_last_synced_at', 'auth_user_id', 'is_active',
  'deleted_at', 'created_at', 'updated_at'
], 'clients holds exactly the permitted columns');

select is_empty($$
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('clients', 'class_members')
    and (column_name ~* '(dob|birth|gender|address|phone|email|medicare|ndis|referral|referring|emergency|medical|doctor)'
         or data_type in ('json', 'jsonb'))
$$, 'no forbidden field or jsonb catch-all on client tables');

select is_empty($$
  select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity
$$, 'RLS is enabled on every table');

select is_empty($$
  select tablename, policyname
  from pg_policies
  where schemaname = 'public'
    and (qual = 'true' or with_check = 'true')
$$, 'no using (true) policies');

select is_empty($$
  select tablename, policyname
  from pg_policies
  where schemaname = 'public'
    and coalesce(qual, '') || coalesce(with_check, '') !~ 'is_(staff|admin)\(\)'
$$, 'every policy goes through is_staff() or is_admin(), which require aal2');

select is_empty($$
  select tablename, policyname, roles
  from pg_policies
  where schemaname = 'public'
    and roles <> '{authenticated}'
$$, 'every policy applies to authenticated only');

select is_empty($$
  select table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'PUBLIC')
$$, 'anon has no table privileges');

select is_empty($$
  select p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon can execute no function');

select is_empty($$
  select p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
$$, 'every function has a locked search_path');

select set_eq($$
  select p.proname::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
$$, array[
  'is_staff', 'is_admin', 'audit_row', 'purge_test_data',
  'record_authenticator_reset', 'record_invite_link'
],
'security definer is limited to the functions that need it');

select * from finish();
rollback;
