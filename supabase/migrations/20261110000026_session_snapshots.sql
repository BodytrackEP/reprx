-- Session occurrences and frozen snapshots (update spec, Phase 5).
-- A snapshot is taken when staff first open (or print) today's session, or by pg_cron at
-- the session's start time, whichever comes first. It refreshes until the end of the day
-- (Australia/Brisbane), then locks. Past sessions are never recalculated; an admin can
-- correct a locked snapshot, and each correction is audited with old and new values.

-- The calculation for a given date. Today and later use current membership; a past date
-- uses enrolments (a client moved on a day belongs to the new class that day). The RM
-- result and overrides are the current ones: past dates are only calculated at lock time.
create function public.effective_weights_at(p_class_id bigint, p_date date)
returns table (
  client_id bigint, item_id bigint, item_key uuid, exercise_id bigint, exercise_name text,
  order_index int, sets int, reps text, rm_percentage numeric, superset_group int,
  program_version_id bigint, rm_result_id bigint, latest_1rm_kg numeric,
  latest_test_date date, calculated_kg numeric, override_kg numeric, override_note text,
  override_review_date date, fallback_kg numeric, effective_kg numeric, weight_source text
)
language sql
stable
set search_path = ''
as $$
  with members as (
    select m.client_id
    from public.class_members m
    where m.class_id = p_class_id and p_date >= public.practice_today()
    union
    select en.client_id
    from public.enrolments en
    where en.class_id = p_class_id
      and p_date < public.practice_today()
      and en.start_date <= p_date
      and (en.end_date is null or en.end_date > p_date)
  ),
  assignment as (
    select a.id
    from public.class_program_assignments a
    where a.class_id = p_class_id
      and p_date between a.start_date and coalesce(a.end_date, 'infinity'::date)
  ),
  version as (
    select p.version_id
    from public.class_program_pushes p
    join assignment a on a.id = p.assignment_id
    where (p.applied_at at time zone 'Australia/Brisbane')::date <= greatest(p_date, public.practice_today())
    order by p.applied_at desc
    limit 1
  )
  select mem.client_id, pe.id, pe.item_key, pe.exercise_id, x.name, pe.position, pe.sets,
         pe.reps, pe.rm_percentage, pe.superset_group, (select version_id from version),
         rm.id, rm.estimated_1rm_kg, rm.test_date, calc.calculated_kg,
         o.override_weight_kg, o.note, o.review_date, pe.fallback_weight_kg,
         case
           when o.id is not null then o.override_weight_kg
           when calc.calculated_kg is not null then calc.calculated_kg
           else pe.fallback_weight_kg
         end,
         case
           when o.id is not null then 'override'
           when calc.calculated_kg is not null then 'calculated'
           when pe.fallback_weight_kg is not null then 'fallback'
           when pe.rm_percentage is null then 'bodyweight'
           else 'not_tested'
         end
  from members mem
  join public.clients c on c.id = mem.client_id and c.deleted_at is null
  cross join assignment a
  join public.class_program_items pe on pe.assignment_id = a.id and not pe.is_removed
  join public.exercises x on x.id = pe.exercise_id
  cross join public.app_settings s
  left join public.weight_overrides o
    on o.client_id = mem.client_id and o.exercise_id = pe.exercise_id and o.ended_at is null
  left join lateral (
    select r.id, r.estimated_1rm_kg, ts.test_date
    from public.rm_results r
    join public.rm_testing_sessions ts on ts.id = r.session_id
    where ts.client_id = mem.client_id and r.exercise_id = pe.exercise_id
      and r.voided_at is null
    order by ts.test_date desc, ts.session_no desc
    limit 1
  ) rm on true
  cross join lateral (
    select public.round_to_increment(rm.estimated_1rm_kg * pe.rm_percentage,
                                     s.rounding_increment_kg) as calculated_kg
  ) calc
  order by mem.client_id, pe.position;
$$;

revoke all on function public.effective_weights_at(bigint, date) from public, anon;
grant execute on function public.effective_weights_at(bigint, date) to authenticated;

create table public.session_occurrences (
  id           bigint generated always as identity primary key,
  class_id     bigint not null references public.classes (id),
  session_date date not null,
  status       text not null default 'open' check (status in ('open', 'locked')),
  snapshot_at  timestamptz,
  locked_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (class_id, session_date)
);

alter table public.session_occurrences enable row level security;

create trigger set_updated_at before update on public.session_occurrences
  for each row execute function public.set_updated_at();
create trigger audit_row after insert or update or delete on public.session_occurrences
  for each row execute function public.audit_row();

create table public.session_snapshot_rows (
  id                 bigint generated always as identity primary key,
  occurrence_id      bigint not null references public.session_occurrences (id) on delete cascade,
  client_id          bigint not null references public.clients (id) on delete cascade,
  item_key           uuid not null,
  exercise_id        bigint not null references public.exercises (id),
  exercise_name      text not null,
  position           int not null,
  superset_group     int,
  sets               int not null,
  reps               text not null,
  rm_percentage      numeric(4, 3),
  calculated_kg      numeric,
  effective_kg       numeric,
  weight_source      text not null,
  is_override        boolean not null,
  override_note      text check (char_length(override_note) <= 200),
  program_version_id bigint references public.program_versions (id),
  rm_result_id       bigint references public.rm_results (id) on delete set null,
  edited_by          uuid references public.staff (id),
  edited_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (occurrence_id, client_id, item_key)
);

alter table public.session_snapshot_rows enable row level security;

create index session_snapshot_rows_client_idx on public.session_snapshot_rows (client_id);

create trigger set_updated_at before update on public.session_snapshot_rows
  for each row execute function public.set_updated_at();
create trigger audit_row after insert or update or delete on public.session_snapshot_rows
  for each row execute function public.audit_row();

-- A locked snapshot changes only through edit_snapshot_row, or when the test-data purge
-- removes a fake client.
create function public.guard_snapshot_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('reprx.snapshot_edit', true), 'off') = 'on'
     or exists (select 1 from private.purge_context where xact = pg_current_xact_id()::text)
     or not exists (
       select 1 from public.session_occurrences
       where id = old.occurrence_id and status = 'locked'
     ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'This session is locked. An admin can correct it.' using errcode = 'RX011';
end;
$$;

create trigger guard_snapshot_row before update or delete on public.session_snapshot_rows
  for each row execute function public.guard_snapshot_row();

-- Takes or refreshes a snapshot. Per-row auditing is paused, as for the purge, and replaced
-- by one summary row per snapshot.
create function private.snapshot_session(p_class_id bigint, p_date date, p_label text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_occurrence public.session_occurrences;
  v_rows int;
begin
  insert into public.session_occurrences (class_id, session_date)
  values (p_class_id, p_date)
  on conflict (class_id, session_date) do nothing;

  select * into v_occurrence
  from public.session_occurrences
  where class_id = p_class_id and session_date = p_date
  for update;

  if v_occurrence.status = 'locked' then
    return v_occurrence.id;
  end if;

  insert into private.purge_context (xact) values (pg_current_xact_id()::text)
  on conflict do nothing;

  delete from public.session_snapshot_rows where occurrence_id = v_occurrence.id;

  insert into public.session_snapshot_rows (
    occurrence_id, client_id, item_key, exercise_id, exercise_name, position, superset_group,
    sets, reps, rm_percentage, calculated_kg, effective_kg, weight_source, is_override,
    override_note, program_version_id, rm_result_id
  )
  select v_occurrence.id, w.client_id, w.item_key, w.exercise_id, w.exercise_name,
         w.order_index, w.superset_group, w.sets, w.reps, w.rm_percentage, w.calculated_kg,
         w.effective_kg, w.weight_source, w.weight_source = 'override', w.override_note,
         w.program_version_id, w.rm_result_id
  from public.effective_weights_at(p_class_id, p_date) w;
  get diagnostics v_rows = row_count;

  update public.session_occurrences set snapshot_at = now() where id = v_occurrence.id;

  delete from private.purge_context where xact = pg_current_xact_id()::text;

  insert into public.audit_log (actor, actor_label, table_name, row_pk, action, new_row)
  values (auth.uid(), p_label, 'session_occurrences', v_occurrence.id::text, 'UPDATE',
          jsonb_build_object('class_id', p_class_id, 'session_date', p_date, 'rows', v_rows));

  return v_occurrence.id;
end;
$$;

-- pg_cron, every 5 minutes: snapshot today's sessions that have started and have none yet.
create function private.snapshot_started_sessions()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamp := now() at time zone 'Australia/Brisbane';
  v_count int := 0;
  c record;
begin
  for c in
    select cl.id
    from public.classes cl
    where cl.is_active
      and cl.day_of_week = extract(dow from v_now::date)
      and cl.start_time <= v_now::time
      and not exists (
        select 1 from public.session_occurrences o
        where o.class_id = cl.id and o.session_date = v_now::date
      )
  loop
    perform private.snapshot_session(c.id, v_now::date, 'cron:snapshot');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- pg_cron, 00:05 Brisbane: create any missing snapshots for the day, then lock everything
-- up to and including it.
create function private.lock_sessions(p_date date)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_locked int;
  c record;
begin
  for c in
    select cl.id
    from public.classes cl
    where cl.is_active and cl.day_of_week = extract(dow from p_date)
      and not exists (
        select 1 from public.session_occurrences o
        where o.class_id = cl.id and o.session_date = p_date
      )
  loop
    perform private.snapshot_session(c.id, p_date, 'cron:snapshot');
  end loop;

  perform set_config('reprx.actor_label', 'cron:lock', true);
  update public.session_occurrences
  set status = 'locked', locked_at = now()
  where status = 'open' and session_date <= p_date;
  get diagnostics v_locked = row_count;
  return v_locked;
end;
$$;

revoke all on all functions in schema private from public;

-- Staff opening or printing today's session. Null on a day the class doesn't run.
create function public.snapshot_today(p_class_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can open a session.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.classes
    where id = p_class_id and is_active
      and day_of_week = extract(dow from public.practice_today())
  ) then
    return null;
  end if;

  return private.snapshot_session(p_class_id, public.practice_today(), 'snapshot:open');
end;
$$;

-- Admin correction of a locked snapshot cell. The audit trigger records old and new values.
create function public.edit_snapshot_row(p_row_id bigint, p_effective_kg numeric, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can correct a past session.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.session_snapshot_rows r
    join public.session_occurrences o on o.id = r.occurrence_id
    where r.id = p_row_id and o.status = 'locked'
  ) then
    raise exception 'Only a locked session can be corrected; today''s session updates itself.'
      using errcode = 'RX011';
  end if;

  if p_effective_kg is not null and p_effective_kg < 0 then
    raise exception 'Weight can''t be negative.' using errcode = 'RX011';
  end if;

  perform set_config('reprx.snapshot_edit', 'on', true);
  update public.session_snapshot_rows
  set effective_kg = p_effective_kg,
      override_note = nullif(trim(p_note), ''),
      edited_by = auth.uid(),
      edited_at = now()
  where id = p_row_id;
  perform set_config('reprx.snapshot_edit', 'off', true);
end;
$$;

revoke all on function public.snapshot_today(bigint) from public, anon;
revoke all on function public.edit_snapshot_row(bigint, numeric, text) from public, anon;
grant execute on function public.snapshot_today(bigint) to authenticated;
grant execute on function public.edit_snapshot_row(bigint, numeric, text) to authenticated;

-- Staff read snapshots; every write goes through the functions above.
grant select on public.session_occurrences, public.session_snapshot_rows to authenticated;
create policy session_occurrences_select on public.session_occurrences for select to authenticated
  using ((select public.is_staff()));
create policy session_snapshot_rows_select on public.session_snapshot_rows for select to authenticated
  using ((select public.is_staff()));

-- Schedules. Brisbane is UTC+10 with no daylight saving, so 00:05 there is 14:05 UTC.
create extension if not exists pg_cron;

select cron.schedule(
  'reprx-snapshot-started-sessions', '*/5 * * * *',
  'select private.snapshot_started_sessions()'
);
select cron.schedule(
  'reprx-lock-yesterday', '5 14 * * *',
  $$select private.lock_sessions(((now() at time zone 'Australia/Brisbane')::date) - 1)$$
);
