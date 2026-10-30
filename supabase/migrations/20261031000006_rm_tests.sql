create table public.rm_tests (
  id               bigint generated always as identity primary key,
  client_id        bigint not null references public.clients (id) on delete cascade,
  exercise_id      bigint not null references public.exercises (id),
  test_date        date not null default current_date,
  reps             smallint not null check (reps between 1 and 10),
  weight_kg        numeric(6, 2) not null check (weight_kg > 0),
  -- Epley. A true 1RM is special-cased: raw Epley would give 1.033 x the weight.
  estimated_1rm_kg numeric(6, 2) generated always as (
    case when reps = 1 then weight_kg
         else round(weight_kg * (1 + reps / 30.0), 2) end
  ) stored,
  recorded_by      uuid not null default auth.uid() references public.staff (id),
  notes            text check (char_length(notes) <= 200),
  voided_at        timestamptz,
  voided_reason    text check (char_length(voided_reason) between 3 and 200),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((voided_at is null) = (voided_reason is null))
);

alter table public.rm_tests enable row level security;

create index rm_tests_latest_idx
  on public.rm_tests (client_id, exercise_id, test_date desc, created_at desc);

create trigger set_updated_at before update on public.rm_tests
  for each row execute function public.set_updated_at();

-- Append-only: the only permitted change is voiding a test, once.
-- estimated_1rm_kg is excluded because generated columns are null in a BEFORE trigger.
create function public.guard_rm_test_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mutable constant text[] :=
    array['voided_at', 'voided_reason', 'updated_at', 'estimated_1rm_kg'];
begin
  if old.voided_at is not null then
    raise exception 'This RM test is already voided.' using errcode = 'RX003';
  end if;

  if new.voided_at is null or to_jsonb(new) - v_mutable <> to_jsonb(old) - v_mutable then
    raise exception 'RM tests cannot be edited. Void the test and record a new one.'
      using errcode = 'RX003';
  end if;

  return new;
end;
$$;

create trigger guard_rm_test_update before update on public.rm_tests
  for each row execute function public.guard_rm_test_update();
