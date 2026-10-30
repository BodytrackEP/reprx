create table public.class_categories (
  code       text primary key,
  label      text not null,
  colour     text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_categories enable row level security;

create trigger set_updated_at before update on public.class_categories
  for each row execute function public.set_updated_at();

insert into public.class_categories (code, label, colour, sort_order) values
  ('STRENGTH',         'Strength',         'bg-blue-100 text-blue-800',     1),
  ('CARDIAC_REHAB',    'Cardiac Rehab',    'bg-red-100 text-red-800',       2),
  ('FALLS_PREVENTION', 'Falls Prevention', 'bg-amber-100 text-amber-800',   3),
  ('CHRONIC_DISEASE',  'Chronic Disease',  'bg-purple-100 text-purple-800', 4),
  ('NDIS',             'NDIS',             'bg-green-100 text-green-800',   5),
  ('PULMONARY_REHAB',  'Pulmonary Rehab',  'bg-teal-100 text-teal-800',     6),
  ('CANCER_REHAB',     'Cancer Rehab',     'bg-pink-100 text-pink-800',     7),
  ('GENERAL',          'General',          'bg-gray-100 text-gray-800',     8);

create table public.classes (
  id                            bigint generated always as identity primary key,
  name                          text not null,
  category_code                 text not null references public.class_categories (code),
  day_of_week                   smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time                    time not null,
  end_time                      time not null,
  location                      text,
  max_capacity                  int check (max_capacity > 0),
  is_active                     boolean not null default true,
  cliniko_group_appointment_ref text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.classes enable row level security;

create trigger set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();

create table public.class_members (
  class_id   bigint not null references public.classes (id) on delete cascade,
  client_id  bigint not null references public.clients (id) on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid not null default auth.uid() references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, client_id)
);

alter table public.class_members enable row level security;

create trigger set_updated_at before update on public.class_members
  for each row execute function public.set_updated_at();

create index class_members_client_idx on public.class_members (client_id);

-- The class row is locked so two concurrent adds can't both take the last place.
-- The bypass flag only counts for an admin: an EP could otherwise set it too.
create function public.enforce_class_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_class public.classes;
  v_taken int;
begin
  select * into v_class from public.classes where id = new.class_id for update;

  if v_class.max_capacity is null then
    return new;
  end if;

  if coalesce(current_setting('reprx.allow_over_capacity', true), 'off') = 'on'
     and public.is_admin() then
    return new;
  end if;

  select count(*) into v_taken
  from public.class_members m
  join public.clients c on c.id = m.client_id
  where m.class_id = new.class_id and c.deleted_at is null;

  if v_taken >= v_class.max_capacity then
    raise exception '% is full (% of % places taken).',
      v_class.name, v_taken, v_class.max_capacity
      using errcode = 'RX001',
            hint = 'An admin can add this client over capacity.';
  end if;

  return new;
end;
$$;

create trigger enforce_class_capacity before insert on public.class_members
  for each row execute function public.enforce_class_capacity();
