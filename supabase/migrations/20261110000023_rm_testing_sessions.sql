-- RM testing sessions (update spec, Phase 6). A session per client and date, auto-numbered
-- per client, holding one result per exercise among its non-voided results. Results keep
-- the existing Epley estimate and are void-only, like the old rm_tests.

create table public.rm_testing_sessions (
  id           bigint generated always as identity primary key,
  client_id    bigint not null references public.clients (id) on delete cascade,
  test_date    date not null default public.practice_today(),
  session_no   int not null default 0, -- always set by number_rm_session
  conducted_by uuid not null default auth.uid() references public.staff (id),
  notes        text check (char_length(notes) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, session_no)
);

alter table public.rm_testing_sessions enable row level security;

create trigger set_updated_at before update on public.rm_testing_sessions
  for each row execute function public.set_updated_at();
create trigger audit_row after insert or update or delete on public.rm_testing_sessions
  for each row execute function public.audit_row();

-- Session 1, 2, 3… per client. The client row is locked so two sessions created at once
-- can't take the same number.
create function public.number_rm_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.clients where id = new.client_id for update;
  select coalesce(max(session_no), 0) + 1 into new.session_no
  from public.rm_testing_sessions where client_id = new.client_id;
  return new;
end;
$$;

create trigger number_rm_session before insert on public.rm_testing_sessions
  for each row execute function public.number_rm_session();

create table public.rm_results (
  id               bigint generated always as identity primary key,
  session_id       bigint not null references public.rm_testing_sessions (id) on delete cascade,
  exercise_id      bigint not null references public.exercises (id),
  reps             smallint not null check (reps between 1 and 10),
  weight_kg        numeric(6, 2) not null check (weight_kg > 0),
  -- Epley. A true 1RM is the weight itself; raw Epley would give 1.033 x the weight.
  estimated_1rm_kg numeric(6, 2) generated always as (
    case when reps = 1 then weight_kg
         else round(weight_kg * (1 + reps / 30.0), 2) end
  ) stored,
  recorded_by      uuid not null default auth.uid() references public.staff (id),
  voided_at        timestamptz,
  voided_by        uuid references public.staff (id),
  voided_reason    text check (char_length(voided_reason) between 3 and 200),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((voided_at is null) = (voided_reason is null))
);

alter table public.rm_results enable row level security;

-- One result per exercise per session; voiding frees the exercise to be re-recorded.
create unique index rm_results_one_per_session
  on public.rm_results (session_id, exercise_id) where voided_at is null;
create index rm_results_exercise_idx on public.rm_results (exercise_id);

create trigger set_updated_at before update on public.rm_results
  for each row execute function public.set_updated_at();
create trigger audit_row after insert or update or delete on public.rm_results
  for each row execute function public.audit_row();

-- Void-only, once, and recorded against whoever voided it.
create function public.guard_rm_result_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mutable constant text[] :=
    array['voided_at', 'voided_by', 'voided_reason', 'updated_at', 'estimated_1rm_kg'];
begin
  if old.voided_at is not null then
    raise exception 'This result is already voided.' using errcode = 'RX003';
  end if;

  if new.voided_at is null or to_jsonb(new) - v_mutable <> to_jsonb(old) - v_mutable then
    raise exception 'Results can''t be edited. Void the result and record it again.'
      using errcode = 'RX003';
  end if;

  new.voided_by := auth.uid();
  return new;
end;
$$;

create trigger guard_rm_result_update before update on public.rm_results
  for each row execute function public.guard_rm_result_update();

-- Access: staff create sessions and results and void results. Nothing is deleted.
grant select on public.rm_testing_sessions, public.rm_results to authenticated;
grant insert (client_id, test_date, notes) on public.rm_testing_sessions to authenticated;
grant update (test_date, notes) on public.rm_testing_sessions to authenticated;
grant insert (session_id, exercise_id, reps, weight_kg) on public.rm_results to authenticated;
grant update (voided_at, voided_reason) on public.rm_results to authenticated;

create policy rm_testing_sessions_select on public.rm_testing_sessions for select to authenticated
  using ((select public.is_staff()));
create policy rm_testing_sessions_insert on public.rm_testing_sessions for insert to authenticated
  with check ((select public.is_staff()));
create policy rm_testing_sessions_update on public.rm_testing_sessions for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy rm_results_select on public.rm_results for select to authenticated
  using ((select public.is_staff()));
create policy rm_results_insert on public.rm_results for insert to authenticated
  with check ((select public.is_staff()));
create policy rm_results_update on public.rm_results for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Every valid result with its session, for summaries and trend graphs.
create view public.rm_results_v
with (security_invoker = true)
as
select r.id, r.session_id, s.client_id, s.session_no, s.test_date, r.exercise_id,
       e.name as exercise_name, r.reps, r.weight_kg, r.estimated_1rm_kg, r.created_at
from public.rm_results r
join public.rm_testing_sessions s on s.id = r.session_id
join public.exercises e on e.id = r.exercise_id
where r.voided_at is null;

grant select on public.rm_results_v to authenticated;

-- The old table is now read-only, like the old program tables.
revoke insert, update, delete on public.rm_tests from authenticated;
