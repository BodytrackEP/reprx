-- Weights now come from the latest valid testing-session result (update spec, Phase 6),
-- by test date, then session number. Precedence and rounding are unchanged. The result
-- used is exposed so session snapshots (Phase 5) can record it.

drop function public.effective_weights(bigint);
drop function public.effective_weights_for_client(bigint);
drop view public.effective_weights_v;

create view public.effective_weights_v
with (security_invoker = true)
as
select
  m.class_id,
  m.client_id,
  a.id as assignment_id,
  pe.id as item_id,
  pe.item_key,
  pe.exercise_id,
  pe.position as order_index,
  pe.sets,
  pe.reps,
  pe.rm_percentage,
  pe.superset_group,
  rm.id as rm_result_id,
  rm.estimated_1rm_kg as latest_1rm_kg,
  rm.test_date as latest_test_date,
  calc.calculated_kg,
  o.override_weight_kg as override_kg,
  o.note as override_note,
  o.review_date as override_review_date,
  pe.fallback_weight_kg as fallback_kg,
  case
    when o.id is not null then o.override_weight_kg
    when calc.calculated_kg is not null then calc.calculated_kg
    else pe.fallback_weight_kg
  end as effective_kg,
  case
    when o.id is not null then 'override'
    when calc.calculated_kg is not null then 'calculated'
    when pe.fallback_weight_kg is not null then 'fallback'
    when pe.rm_percentage is null then 'bodyweight'
    else 'not_tested'
  end as weight_source
from public.class_members m
join public.clients c on c.id = m.client_id and c.deleted_at is null
join public.class_program_assignments a
  on a.class_id = m.class_id
 and public.practice_today() between a.start_date and coalesce(a.end_date, 'infinity'::date)
join public.class_program_items pe on pe.assignment_id = a.id and not pe.is_removed
cross join public.app_settings s
left join public.weight_overrides o
  on o.client_id = m.client_id
 and o.exercise_id = pe.exercise_id
 and o.ended_at is null
left join lateral (
  select r.id, r.estimated_1rm_kg, ts.test_date
  from public.rm_results r
  join public.rm_testing_sessions ts on ts.id = r.session_id
  where ts.client_id = m.client_id
    and r.exercise_id = pe.exercise_id
    and r.voided_at is null
  order by ts.test_date desc, ts.session_no desc
  limit 1
) rm on true
cross join lateral (
  select public.round_to_increment(
    rm.estimated_1rm_kg * pe.rm_percentage,
    s.rounding_increment_kg
  ) as calculated_kg
) calc;

create function public.effective_weights(p_class_id bigint)
returns table (
  client_id bigint, item_id bigint, item_key uuid, exercise_id bigint, order_index int,
  sets int, reps text, rm_percentage numeric, superset_group int, rm_result_id bigint,
  latest_1rm_kg numeric, latest_test_date date, calculated_kg numeric, override_kg numeric,
  override_note text, override_review_date date, fallback_kg numeric, effective_kg numeric,
  weight_source text
)
language sql
stable
set search_path = ''
as $$
  select v.client_id, v.item_id, v.item_key, v.exercise_id, v.order_index, v.sets, v.reps,
         v.rm_percentage, v.superset_group, v.rm_result_id, v.latest_1rm_kg,
         v.latest_test_date, v.calculated_kg, v.override_kg, v.override_note,
         v.override_review_date, v.fallback_kg, v.effective_kg, v.weight_source
  from public.effective_weights_v v
  where v.class_id = p_class_id
  order by v.client_id, v.order_index;
$$;

create function public.effective_weights_for_client(p_client_id bigint)
returns table (
  class_id bigint, item_id bigint, item_key uuid, exercise_id bigint, order_index int,
  sets int, reps text, rm_percentage numeric, superset_group int, rm_result_id bigint,
  latest_1rm_kg numeric, latest_test_date date, calculated_kg numeric, override_kg numeric,
  override_note text, override_review_date date, fallback_kg numeric, effective_kg numeric,
  weight_source text
)
language sql
stable
set search_path = ''
as $$
  select v.class_id, v.item_id, v.item_key, v.exercise_id, v.order_index, v.sets, v.reps,
         v.rm_percentage, v.superset_group, v.rm_result_id, v.latest_1rm_kg,
         v.latest_test_date, v.calculated_kg, v.override_kg, v.override_note,
         v.override_review_date, v.fallback_kg, v.effective_kg, v.weight_source
  from public.effective_weights_v v
  where v.client_id = p_client_id
  order by v.class_id, v.order_index;
$$;

revoke all on function public.effective_weights(bigint) from public, anon;
revoke all on function public.effective_weights_for_client(bigint) from public, anon;
grant execute on function public.effective_weights(bigint) to authenticated;
grant execute on function public.effective_weights_for_client(bigint) to authenticated;
grant select on public.effective_weights_v to authenticated;

-- Purge removes test clients' sessions and results by cascade, and reports them.
create or replace function public.purge_test_data()
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
    'rm_sessions', (
      select count(*) from public.rm_testing_sessions s
      join public.clients c on c.id = s.client_id where c.is_test),
    'rm_results', (
      select count(*) from public.rm_results r
      join public.rm_testing_sessions s on s.id = r.session_id
      join public.clients c on c.id = s.client_id where c.is_test),
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
