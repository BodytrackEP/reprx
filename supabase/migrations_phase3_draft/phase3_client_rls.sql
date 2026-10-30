-- PHASE 3 DRAFT. NOT APPLIED. The Supabase CLI only reads supabase/migrations/.
-- To adopt: pick a login option (docs/PHASE3_AUTH_OPTIONS.md), review this file against
-- the schema of the day, move it into supabase/migrations/ with a new timestamp, and add
-- pgTAP tests proving one client can't see another.
--
-- Clients and staff both connect as the `authenticated` role, so a column grant can't hide
-- weight_overrides.reason from clients without hiding it from staff too. Clients therefore
-- get no policy on weight_overrides. They read overrides through my_overrides(), which
-- leaves the reason out, and their weights through my_effective_weights().

create function public.current_client_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.clients c
  where c.auth_user_id = auth.uid()
    and c.is_active
    and c.deleted_at is null;
$$;

create policy clients_select_own on public.clients for select to authenticated
  using (id = (select public.current_client_id()));

create policy class_members_select_own on public.class_members for select to authenticated
  using (client_id = (select public.current_client_id()));

create policy classes_select_own on public.classes for select to authenticated
  using (
    id in (
      select m.class_id from public.class_members m
      where m.client_id = (select public.current_client_id())
    )
  );

create policy programs_select_own on public.programs for select to authenticated
  using (
    class_id in (
      select m.class_id from public.class_members m
      where m.client_id = (select public.current_client_id())
    )
  );

create policy program_exercises_select_own on public.program_exercises for select to authenticated
  using (
    program_id in (
      select p.id
      from public.programs p
      join public.class_members m on m.class_id = p.class_id
      where m.client_id = (select public.current_client_id())
    )
  );

-- Exercise names are shown on the client's program.
create policy exercises_select_client on public.exercises for select to authenticated
  using ((select public.current_client_id()) is not null);

create policy rm_tests_select_own on public.rm_tests for select to authenticated
  using (
    client_id = (select public.current_client_id())
    and voided_at is null
  );

-- Definer, because clients have no policy on weight_overrides. The reason is deliberately
-- absent: the client sees "Adjusted by your EP", never the clinical wording.
create function public.my_overrides()
returns table (
  exercise_id bigint,
  override_weight_kg numeric,
  label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.exercise_id, o.override_weight_kg, 'Adjusted by your EP'
  from public.weight_overrides o
  where o.client_id = public.current_client_id()
    and o.ended_at is null;
$$;

-- Definer for the same reason. Takes no client id, so it can only ever return the caller's rows.
create function public.my_effective_weights()
returns table (
  class_id bigint,
  exercise_id bigint,
  order_index int,
  sets int,
  reps int,
  effective_kg numeric,
  is_adjusted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.class_id, v.exercise_id, v.order_index, v.sets, v.reps, v.effective_kg,
         v.weight_source = 'override'
  from public.effective_weights_v v
  where v.client_id = public.current_client_id()
  order by v.class_id, v.order_index;
$$;

revoke all on function public.current_client_id() from public, anon;
revoke all on function public.my_overrides() from public, anon;
revoke all on function public.my_effective_weights() from public, anon;
grant execute on function public.current_client_id() to authenticated;
grant execute on function public.my_overrides() to authenticated;
grant execute on function public.my_effective_weights() to authenticated;
