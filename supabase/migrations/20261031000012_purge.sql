-- Hard-deletes is_test clients; memberships, RM tests and overrides cascade.
-- security definer because clients has no DELETE grant for any API role.
-- The purge_context row silences per-row auditing for this transaction only,
-- leaving the single summary row below (owner decision, CLAUDE.md).
create function public.purge_test_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can purge test data.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'clients', (select count(*) from public.clients where is_test),
    'class_members', (
      select count(*) from public.class_members m
      join public.clients c on c.id = m.client_id where c.is_test),
    'rm_tests', (
      select count(*) from public.rm_tests t
      join public.clients c on c.id = t.client_id where c.is_test),
    'weight_overrides', (
      select count(*) from public.weight_overrides o
      join public.clients c on c.id = o.client_id where c.is_test)
  ) into v_counts;

  insert into private.purge_context (xact) values (pg_current_xact_id()::text);

  delete from public.clients where is_test;

  delete from private.purge_context where xact = pg_current_xact_id()::text;

  insert into public.audit_log (actor, actor_label, table_name, row_pk, action, new_row)
  values (auth.uid(), 'purge:test-data', 'clients', '*', 'DELETE', v_counts);

  return v_counts;
end;
$$;

revoke all on function public.purge_test_data() from public, anon;
grant execute on function public.purge_test_data() to authenticated;
