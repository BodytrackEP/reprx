-- Per (client, exercise), so an override follows the person across every class.
create table public.weight_overrides (
  id                 bigint generated always as identity primary key,
  client_id          bigint not null references public.clients (id) on delete cascade,
  exercise_id        bigint not null references public.exercises (id),
  override_weight_kg numeric(6, 2) not null check (override_weight_kg >= 0),
  reason             text not null check (char_length(reason) between 3 and 200),
  review_date        date,
  set_by             uuid not null default auth.uid() references public.staff (id),
  set_at             timestamptz not null default now(),
  ended_at           timestamptz,
  ended_by           uuid references public.staff (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((ended_at is null) = (ended_by is null))
);

alter table public.weight_overrides enable row level security;

create unique index weight_overrides_one_active
  on public.weight_overrides (client_id, exercise_id)
  where ended_at is null;

create index weight_overrides_review_idx
  on public.weight_overrides (review_date)
  where ended_at is null and review_date is not null;

create trigger set_updated_at before update on public.weight_overrides
  for each row execute function public.set_updated_at();

-- History is kept: an override can be ended, once, and otherwise never changes.
create function public.guard_override_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mutable constant text[] := array['ended_at', 'ended_by', 'updated_at'];
begin
  if old.ended_at is not null
     or new.ended_at is null
     or to_jsonb(new) - v_mutable <> to_jsonb(old) - v_mutable then
    raise exception 'Overrides cannot be edited. Replace or end the override instead.'
      using errcode = 'RX004';
  end if;

  return new;
end;
$$;

create trigger guard_override_update before update on public.weight_overrides
  for each row execute function public.guard_override_update();

create function public.end_override(p_override_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.weight_overrides
  set ended_at = now(), ended_by = auth.uid()
  where id = p_override_id and ended_at is null;

  if not found then
    raise exception 'That override is not active.' using errcode = 'RX004';
  end if;
end;
$$;

-- Replaces any active override in one transaction.
create function public.set_override(
  p_client_id bigint,
  p_exercise_id bigint,
  p_weight_kg numeric,
  p_reason text,
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
    (client_id, exercise_id, override_weight_kg, reason, review_date)
  values
    (p_client_id, p_exercise_id, p_weight_kg, p_reason, p_review_date)
  returning id into v_id;

  return v_id;
end;
$$;
