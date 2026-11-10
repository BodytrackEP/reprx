-- Override notes and dormant overrides (update spec, Phase 4).
-- The optional note replaces the required reason. Existing reasons are copied into notes
-- (owner decision, test data only). The reason column stays, unused and nullable, until
-- the owner confirms the final cleanup: nothing is dropped or renamed here.

alter table public.weight_overrides
  add column note text check (char_length(note) between 1 and 200);

-- The guard trigger refuses any edit to an override, so it's paused for this one copy.
-- The audit trigger stays on and labels each row as the migration.
select set_config('reprx.actor_label', 'migration:override-notes', true);
alter table public.weight_overrides disable trigger guard_override_update;
update public.weight_overrides set note = reason where note is null and reason is not null;
alter table public.weight_overrides enable trigger guard_override_update;

alter table public.weight_overrides alter column reason drop not null;

-- The note is part of the override, so the update guard keeps it fixed like the weight.
-- (to_jsonb comparison in guard_override_update already covers new columns.)

drop function public.set_override(bigint, bigint, numeric, text, date);

-- Replaces any active override in one transaction. The note describes the exercise change
-- only, e.g. 'Trap bar instead'.
create function public.set_override(
  p_client_id bigint,
  p_exercise_id bigint,
  p_weight_kg numeric,
  p_note text default null,
  p_review_date date default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
begin
  update public.weight_overrides
  set ended_at = now(), ended_by = auth.uid()
  where client_id = p_client_id
    and exercise_id = p_exercise_id
    and ended_at is null;

  insert into public.weight_overrides
    (client_id, exercise_id, override_weight_kg, note, review_date)
  values
    (p_client_id, p_exercise_id, p_weight_kg, nullif(trim(p_note), ''), p_review_date)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.set_override(bigint, bigint, numeric, text, date) from public, anon;
grant execute on function public.set_override(bigint, bigint, numeric, text, date) to authenticated;

-- The calculation exposes the note instead of the reason.
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
  select t.estimated_1rm_kg, t.test_date
  from public.rm_tests t
  where t.client_id = m.client_id
    and t.exercise_id = pe.exercise_id
    and t.voided_at is null
  order by t.test_date desc, t.created_at desc
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
  sets int, reps text, rm_percentage numeric, superset_group int, latest_1rm_kg numeric,
  latest_test_date date, calculated_kg numeric, override_kg numeric, override_note text,
  override_review_date date, fallback_kg numeric, effective_kg numeric, weight_source text
)
language sql
stable
set search_path = ''
as $$
  select v.client_id, v.item_id, v.item_key, v.exercise_id, v.order_index, v.sets, v.reps,
         v.rm_percentage, v.superset_group, v.latest_1rm_kg, v.latest_test_date,
         v.calculated_kg, v.override_kg, v.override_note, v.override_review_date,
         v.fallback_kg, v.effective_kg, v.weight_source
  from public.effective_weights_v v
  where v.class_id = p_class_id
  order by v.client_id, v.order_index;
$$;

create function public.effective_weights_for_client(p_client_id bigint)
returns table (
  class_id bigint, item_id bigint, item_key uuid, exercise_id bigint, order_index int,
  sets int, reps text, rm_percentage numeric, superset_group int, latest_1rm_kg numeric,
  latest_test_date date, calculated_kg numeric, override_kg numeric, override_note text,
  override_review_date date, fallback_kg numeric, effective_kg numeric, weight_source text
)
language sql
stable
set search_path = ''
as $$
  select v.class_id, v.item_id, v.item_key, v.exercise_id, v.order_index, v.sets, v.reps,
         v.rm_percentage, v.superset_group, v.latest_1rm_kg, v.latest_test_date,
         v.calculated_kg, v.override_kg, v.override_note, v.override_review_date,
         v.fallback_kg, v.effective_kg, v.weight_source
  from public.effective_weights_v v
  where v.client_id = p_client_id
  order by v.class_id, v.order_index;
$$;

revoke all on function public.effective_weights(bigint) from public, anon;
revoke all on function public.effective_weights_for_client(bigint) from public, anon;
grant execute on function public.effective_weights(bigint) to authenticated;
grant execute on function public.effective_weights_for_client(bigint) to authenticated;
grant select on public.effective_weights_v to authenticated;

-- Dormant overrides: kept, not shown, and live again if the exercise returns. Derived from
-- whether any of the client's current class programs still has the exercise.
create view public.client_overrides_v
with (security_invoker = true)
as
select o.id, o.client_id, o.exercise_id, e.name as exercise_name, o.override_weight_kg,
       o.note, o.review_date, o.set_at,
       not exists (
         select 1
         from public.class_members m
         join public.class_program_assignments a
           on a.class_id = m.class_id
          and public.practice_today() between a.start_date and coalesce(a.end_date, 'infinity'::date)
         join public.class_program_items i
           on i.assignment_id = a.id and not i.is_removed and i.exercise_id = o.exercise_id
         where m.client_id = o.client_id
       ) as is_dormant
from public.weight_overrides o
join public.exercises e on e.id = o.exercise_id
where o.ended_at is null;

grant select on public.client_overrides_v to authenticated;
