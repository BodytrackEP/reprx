create table public.app_settings (
  id                                  int primary key default 1 check (id = 1),
  -- Starts 'unset' on every database, and the seed refuses it, so a forgotten
  -- setting can't seed prod. Hosted projects set this once, by hand.
  environment                         text not null default 'unset'
    check (environment in ('unset', 'local', 'test', 'prod')),
  staff_session_timeout_hours         int not null default 12 check (staff_session_timeout_hours > 0),
  client_session_timeout_days         int not null default 30 check (client_session_timeout_days > 0),
  soft_delete_restore_days            int not null default 30 check (soft_delete_restore_days >= 0),
  retention_years_after_last_activity int not null default 7 check (retention_years_after_last_activity > 0),
  rounding_increment_kg               numeric(4, 2) not null default 2.5 check (rounding_increment_kg > 0),
  rm_warn_above_reps                  int not null default 6 check (rm_warn_above_reps between 1 and 10),
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create trigger set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (id) values (1);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor       uuid, -- auth.uid(); null = system or sync job
  actor_label text, -- e.g. 'sync:cliniko' for jobs
  table_name  text not null,
  row_pk      text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_row     jsonb,
  new_row     jsonb
);

alter table public.audit_log enable row level security;

create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_pk);
create index audit_log_actor_idx on public.audit_log (actor, occurred_at desc);

create function public.reject_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The audit log is append-only.' using errcode = 'RX005';
end;
$$;

create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.reject_audit_change();

create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.reject_audit_change();

-- Transactions in which purge_test_data() is running. Only that function can write
-- here, so per-row auditing can't be switched off by a caller the way a GUC could.
create table private.purge_context (
  xact text primary key
);

alter table private.purge_context enable row level security;

-- Trigger arguments name the primary-key columns (default: id).
create function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_pk text;
begin
  if exists (
    select 1 from private.purge_context where xact = pg_current_xact_id()::text
  ) then
    return null;
  end if;

  select string_agg(v_row ->> col, ':') into v_pk
  from unnest(case when tg_nargs = 0 then array['id'] else tg_argv::text[] end) as col;

  insert into public.audit_log (actor, actor_label, table_name, row_pk, action, old_row, new_row)
  values (
    auth.uid(),
    nullif(current_setting('reprx.actor_label', true), ''),
    tg_table_name,
    v_pk,
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );

  return null;
end;
$$;

create trigger audit_row after insert or update or delete on public.clients
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.class_members
  for each row execute function public.audit_row('class_id', 'client_id');
create trigger audit_row after insert or update or delete on public.programs
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.program_exercises
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.rm_tests
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.weight_overrides
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.exercises
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.classes
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.staff
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.app_settings
  for each row execute function public.audit_row();
