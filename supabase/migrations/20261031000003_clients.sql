-- Name-only by design (BUILD_PROMPT §3). Cliniko holds identity, contact and clinical data.
-- A pgTAP test pins this column list: adding a column means changing that test on purpose.
create table public.clients (
  id                     bigint generated always as identity primary key,
  first_name             text not null,
  last_name              text not null,
  preferred_name         text,
  source                 text not null default 'manual' check (source in ('manual', 'cliniko')),
  is_test                boolean not null default false,
  cliniko_shard          text,
  cliniko_patient_id     bigint,
  cliniko_linked_at      timestamptz,
  cliniko_linked_by      uuid references public.staff (id),
  cliniko_archived_at    timestamptz,
  cliniko_last_synced_at timestamptz,
  auth_user_id           uuid unique references auth.users (id),
  is_active              boolean not null default true,
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (cliniko_shard, cliniko_patient_id),
  check ((cliniko_patient_id is null) = (cliniko_shard is null)),
  check (not (is_test and cliniko_patient_id is not null))
);

alter table public.clients enable row level security;

create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create index clients_name_idx on public.clients (lower(last_name), lower(first_name));
