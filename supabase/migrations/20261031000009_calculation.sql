-- numeric round() rounds half away from zero; a pgTAP test pins this.
create function public.round_to_increment(p_kg numeric, p_increment numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(p_kg / p_increment) * p_increment;
$$;

-- Precedence (BUILD_PROMPT §5): override > calculated > fallback > bodyweight / not_tested.
-- security_invoker keeps RLS in force for whoever reads the view.
create view public.effective_weights_v
with (security_invoker = true)
as
select
  m.class_id,
  m.client_id,
  pe.exercise_id,
  pe.order_index,
  pe.sets,
  pe.reps,
  pe.rm_percentage,
  rm.estimated_1rm_kg as latest_1rm_kg,
  rm.test_date as latest_test_date,
  calc.calculated_kg,
  o.override_weight_kg as override_kg,
  o.reason as override_reason,
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
join public.programs p on p.class_id = m.class_id
join public.program_exercises pe on pe.program_id = p.id
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
  client_id bigint,
  exercise_id bigint,
  order_index int,
  sets int,
  reps int,
  rm_percentage numeric,
  latest_1rm_kg numeric,
  latest_test_date date,
  calculated_kg numeric,
  override_kg numeric,
  override_reason text,
  override_review_date date,
  fallback_kg numeric,
  effective_kg numeric,
  weight_source text
)
language sql
stable
set search_path = ''
as $$
  select v.client_id, v.exercise_id, v.order_index, v.sets, v.reps, v.rm_percentage,
         v.latest_1rm_kg, v.latest_test_date, v.calculated_kg, v.override_kg,
         v.override_reason, v.override_review_date, v.fallback_kg, v.effective_kg,
         v.weight_source
  from public.effective_weights_v v
  where v.class_id = p_class_id
  order by v.client_id, v.order_index;
$$;

-- Includes class_id: the client screens show one client across several classes.
create function public.effective_weights_for_client(p_client_id bigint)
returns table (
  class_id bigint,
  exercise_id bigint,
  order_index int,
  sets int,
  reps int,
  rm_percentage numeric,
  latest_1rm_kg numeric,
  latest_test_date date,
  calculated_kg numeric,
  override_kg numeric,
  override_reason text,
  override_review_date date,
  fallback_kg numeric,
  effective_kg numeric,
  weight_source text
)
language sql
stable
set search_path = ''
as $$
  select v.class_id, v.exercise_id, v.order_index, v.sets, v.reps, v.rm_percentage,
         v.latest_1rm_kg, v.latest_test_date, v.calculated_kg, v.override_kg,
         v.override_reason, v.override_review_date, v.fallback_kg, v.effective_kg,
         v.weight_source
  from public.effective_weights_v v
  where v.client_id = p_client_id
  order by v.class_id, v.order_index;
$$;
