create table public.staff (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role         text not null check (role in ('admin', 'ep')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.staff enable row level security;

create trigger set_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

-- Both helpers require an MFA session, so every policy built on them enforces AAL2.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.staff s
       where s.id = auth.uid() and s.is_active
     );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.staff s
       where s.id = auth.uid() and s.is_active and s.role = 'admin'
     );
$$;
