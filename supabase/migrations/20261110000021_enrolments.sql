-- Enrolment history (update spec, Phase 3). class_members stays the record of who is in a
-- class now, so capacity, moves and RLS are unchanged. Triggers keep a dated enrolment for
-- every membership: adding opens one, removing closes it, and a move does both. Rows are
-- never overwritten, and no API role can write them directly.

create table public.enrolments (
  id         bigint generated always as identity primary key,
  class_id   bigint not null references public.classes (id),
  client_id  bigint not null references public.clients (id) on delete cascade,
  start_date date not null,
  end_date   date,
  opened_by  uuid references public.staff (id),
  closed_by  uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

alter table public.enrolments enable row level security;

create unique index enrolments_one_open
  on public.enrolments (class_id, client_id) where end_date is null;
create index enrolments_client_idx on public.enrolments (client_id, start_date);

create trigger set_updated_at before update on public.enrolments
  for each row execute function public.set_updated_at();
create trigger audit_row after insert or update or delete on public.enrolments
  for each row execute function public.audit_row();

-- Definer, because staff have no write access to enrolments at all.
create function public.open_enrolment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.enrolments (class_id, client_id, start_date, opened_by)
  values (new.class_id, new.client_id,
          (new.added_at at time zone 'Australia/Brisbane')::date, new.added_by)
  on conflict (class_id, client_id) where end_date is null do nothing;
  return null;
end;
$$;

create function public.close_enrolment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.enrolments
  set end_date = greatest(start_date, public.practice_today()),
      closed_by = auth.uid()
  where class_id = old.class_id and client_id = old.client_id and end_date is null;
  return null;
end;
$$;

create trigger open_enrolment after insert on public.class_members
  for each row execute function public.open_enrolment();
create trigger close_enrolment after delete on public.class_members
  for each row execute function public.close_enrolment();

revoke all on function public.open_enrolment() from public, anon, authenticated;
revoke all on function public.close_enrolment() from public, anon, authenticated;

-- Backfill: everyone currently in a class has been enrolled since they were added.
insert into public.enrolments (class_id, client_id, start_date, opened_by)
select class_id, client_id, (added_at at time zone 'Australia/Brisbane')::date, added_by
from public.class_members;

grant select on public.enrolments to authenticated;
create policy enrolments_select on public.enrolments for select to authenticated
  using ((select public.is_staff()));

-- Each enrolment period intersected with the class's assignments, then split at every
-- version pushed to that assignment, so each row names the version in effect then.
-- Enrolment-based, not attendance-based.
create view public.program_history_v
with (security_invoker = true)
as
with periods as (
  select e.id as enrolment_id, e.client_id, e.class_id, a.id as assignment_id, a.program_id,
         greatest(e.start_date, a.start_date) as from_date,
         least(coalesce(e.end_date, 'infinity'::date), coalesce(a.end_date, 'infinity'::date))
           as to_date
  from public.enrolments e
  join public.class_program_assignments a on a.class_id = e.class_id
  where a.start_date <= coalesce(e.end_date, 'infinity'::date)
    and coalesce(a.end_date, 'infinity'::date) >= e.start_date
),
daily_pushes as (
  -- The last version applied on a day is the one in effect that day.
  select distinct on (p.assignment_id, (p.applied_at at time zone 'Australia/Brisbane')::date)
         p.assignment_id, p.version_id,
         (p.applied_at at time zone 'Australia/Brisbane')::date as push_date
  from public.class_program_pushes p
  order by p.assignment_id, (p.applied_at at time zone 'Australia/Brisbane')::date,
           p.applied_at desc
),
segments as (
  select assignment_id, version_id,
         case when row_number() over w = 1 then '-infinity'::date else push_date end as seg_from,
         coalesce(lead(push_date) over w - 1, 'infinity'::date) as seg_to
  from daily_pushes
  window w as (partition by assignment_id order by push_date)
)
select pr.enrolment_id, pr.client_id, pr.class_id, c.name as class_name, pr.assignment_id,
       pr.program_id, lp.code as program_code, lp.name as program_name,
       s.version_id, v.version_no,
       greatest(pr.from_date, s.seg_from) as from_date,
       nullif(least(pr.to_date, s.seg_to), 'infinity'::date) as to_date
from periods pr
join segments s on s.assignment_id = pr.assignment_id
join public.classes c on c.id = pr.class_id
join public.library_programs lp on lp.id = pr.program_id
join public.program_versions v on v.id = s.version_id
where greatest(pr.from_date, s.seg_from) <= least(pr.to_date, s.seg_to)
  and greatest(pr.from_date, s.seg_from) <= public.practice_today();

grant select on public.program_history_v to authenticated;

create function public.client_program_history(p_client_id bigint)
returns setof public.program_history_v
language sql
stable
set search_path = ''
as $$
  select * from public.program_history_v
  where client_id = p_client_id
  order by from_date desc, class_name;
$$;

create function public.program_client_history(p_program_id bigint)
returns setof public.program_history_v
language sql
stable
set search_path = ''
as $$
  select * from public.program_history_v
  where program_id = p_program_id
  order by from_date desc, client_id;
$$;

revoke all on function public.client_program_history(bigint) from public, anon;
revoke all on function public.program_client_history(bigint) from public, anon;
grant execute on function public.client_program_history(bigint) to authenticated;
grant execute on function public.program_client_history(bigint) to authenticated;
