create table public.exercises (
  id           bigint generated always as identity primary key,
  name         text not null,
  muscle_group text,
  equipment    text,
  description  text,
  video_url    text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.exercises enable row level security;

create unique index exercises_name_key on public.exercises (lower(name));

create trigger set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

create table public.programs (
  id         bigint generated always as identity primary key,
  class_id   bigint not null unique references public.classes (id),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.programs enable row level security;

create trigger set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();

create table public.program_exercises (
  id                 bigint generated always as identity primary key,
  program_id         bigint not null references public.programs (id) on delete cascade,
  exercise_id        bigint not null references public.exercises (id),
  order_index        int not null,
  sets               int not null check (sets between 1 and 20),
  reps               int not null check (reps between 1 and 100),
  rm_percentage      numeric(4, 3) check (rm_percentage > 0 and rm_percentage <= 1.2),
  fallback_weight_kg numeric(6, 2) check (fallback_weight_kg >= 0),
  rest_seconds       int,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (program_id, order_index) deferrable initially deferred
);

alter table public.program_exercises enable row level security;

create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

create trigger set_updated_at before update on public.program_exercises
  for each row execute function public.set_updated_at();

-- Rewrites the whole order in one statement; the unique check runs at commit.
create function public.reorder_program_exercises(p_program_id bigint, p_ids bigint[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_updated int;
  v_total int;
begin
  select count(*) into v_total
  from public.program_exercises
  where program_id = p_program_id;

  update public.program_exercises pe
  set order_index = o.position
  from unnest(p_ids) with ordinality as o (id, position)
  where pe.id = o.id and pe.program_id = p_program_id;

  get diagnostics v_updated = row_count;

  if v_updated <> v_total or cardinality(p_ids) <> v_total then
    raise exception 'The new order must list every exercise in the program exactly once.'
      using errcode = 'RX002';
  end if;
end;
$$;
