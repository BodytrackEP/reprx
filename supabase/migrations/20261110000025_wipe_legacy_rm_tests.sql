-- Wipes the old RM test data (update spec, Phase 6). Confirmed by the owner on 2026-11-10:
-- 213 tests on the hosted test project, all on fake test clients. The seed replaces them
-- with multi-session data. The empty rm_tests table stays until the final cleanup.
-- Per-row auditing is paused through the purge context and replaced by one summary row,
-- as the test-data purge does.
do $$
declare
  v_counts jsonb;
begin
  select jsonb_build_object(
    'rm_tests', count(*),
    'on_real_clients', count(*) filter (where not c.is_test)
  ) into v_counts
  from public.rm_tests t
  join public.clients c on c.id = t.client_id;

  if (v_counts ->> 'on_real_clients')::int > 0 then
    raise exception 'Refusing to wipe: % RM tests belong to real clients.',
      v_counts ->> 'on_real_clients';
  end if;

  insert into private.purge_context (xact) values (pg_current_xact_id()::text);
  delete from public.rm_tests;
  delete from private.purge_context where xact = pg_current_xact_id()::text;

  insert into public.audit_log (actor, actor_label, table_name, row_pk, action, new_row)
  values (null, 'rm:wipe', 'rm_tests', '*', 'DELETE', v_counts);
end;
$$;
