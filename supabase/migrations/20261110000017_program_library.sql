-- Program library (update spec, Phase 1). Programs are standalone and reusable. Every save
-- creates an immutable version, and each class assignment works from its own copy of the
-- items, linked to the library by item_key so rows can be matched across versions.

create extension if not exists btree_gist with schema extensions;

-- All date logic uses the practice's timezone (spec ground rule 7).
create function public.practice_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Australia/Brisbane')::date;
$$;

create sequence public.library_program_code_seq;

create table public.library_programs (
  id                 bigint generated always as identity primary key,
  code               text not null unique,
  name               text not null check (char_length(name) between 1 and 100),
  status             text not null default 'active' check (status in ('active', 'archived')),
  current_version_id bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.library_programs enable row level security;

create trigger set_updated_at before update on public.library_programs
  for each row execute function public.set_updated_at();

create function public.set_program_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.code := 'PRG-' || lpad(nextval('public.library_program_code_seq')::text, 4, '0');
  elsif new.code <> old.code then
    raise exception 'Program codes can''t be changed.' using errcode = 'RX008';
  end if;
  return new;
end;
$$;

create trigger set_program_code before insert or update on public.library_programs
  for each row execute function public.set_program_code();

-- created_by is null only for versions made by the one-off migration of the old programs.
create table public.program_versions (
  id         bigint generated always as identity primary key,
  program_id bigint not null references public.library_programs (id),
  version_no int not null check (version_no > 0),
  created_by uuid default auth.uid() references public.staff (id),
  created_at timestamptz not null default now(),
  unique (program_id, version_no)
);

alter table public.program_versions enable row level security;

alter table public.library_programs
  add constraint library_programs_current_version_fkey
  foreign key (current_version_id) references public.program_versions (id)
  deferrable initially deferred;

create table public.program_version_items (
  id                 bigint generated always as identity primary key,
  version_id         bigint not null references public.program_versions (id),
  item_key           uuid not null,
  position           int not null check (position > 0),
  exercise_id        bigint not null references public.exercises (id),
  sets               int not null check (sets between 1 and 20),
  reps               text not null check (char_length(reps) between 1 and 20),
  rm_percentage      numeric(4, 3) check (rm_percentage > 0 and rm_percentage <= 1.2),
  fallback_weight_kg numeric(6, 2) check (fallback_weight_kg >= 0),
  rest_seconds       int check (rest_seconds >= 0),
  notes              text check (char_length(notes) <= 200),
  superset_group     int check (superset_group > 0),
  created_at         timestamptz not null default now(),
  unique (version_id, position),
  unique (version_id, item_key)
);

alter table public.program_version_items enable row level security;

create index program_version_items_exercise_idx on public.program_version_items (exercise_id);

create function public.reject_version_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Program versions can''t be changed. Save a new version instead.'
    using errcode = 'RX008';
end;
$$;

create trigger program_versions_immutable before update or delete on public.program_versions
  for each row execute function public.reject_version_change();
create trigger program_version_items_immutable before update or delete on public.program_version_items
  for each row execute function public.reject_version_change();

-- One active program per class at a time; assignments can be queued for next term.
create table public.class_program_assignments (
  id         bigint generated always as identity primary key,
  class_id   bigint not null references public.classes (id),
  program_id bigint not null references public.library_programs (id),
  start_date date not null,
  end_date   date,
  created_by uuid default auth.uid() references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  constraint class_program_assignments_no_overlap
    exclude using gist (class_id with =, daterange(start_date, end_date, '[]') with &&)
);

alter table public.class_program_assignments enable row level security;

create index class_program_assignments_program_idx on public.class_program_assignments (program_id);

create trigger set_updated_at before update on public.class_program_assignments
  for each row execute function public.set_updated_at();

create function public.refuse_archived_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.library_programs p
    where p.id = new.program_id and p.status = 'archived'
  ) then
    raise exception 'That program is archived and can''t be assigned.' using errcode = 'RX009';
  end if;
  return new;
end;
$$;

create trigger refuse_archived_assignment before insert or update of program_id
  on public.class_program_assignments
  for each row execute function public.refuse_archived_assignment();

-- The class's working copy. is_customised rows are left alone when the library changes;
-- is_removed keeps a library row the class deleted from coming back on the next push.
create table public.class_program_items (
  id                 bigint generated always as identity primary key,
  assignment_id      bigint not null references public.class_program_assignments (id) on delete cascade,
  item_key           uuid not null default gen_random_uuid(),
  position           int not null check (position > 0),
  exercise_id        bigint not null references public.exercises (id),
  sets               int not null check (sets between 1 and 20),
  reps               text not null check (char_length(reps) between 1 and 20),
  rm_percentage      numeric(4, 3) check (rm_percentage > 0 and rm_percentage <= 1.2),
  fallback_weight_kg numeric(6, 2) check (fallback_weight_kg >= 0),
  rest_seconds       int check (rest_seconds >= 0),
  notes              text check (char_length(notes) <= 200),
  superset_group     int check (superset_group > 0),
  is_customised      boolean not null default false,
  is_removed         boolean not null default false,
  source_version_id  bigint references public.program_versions (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (assignment_id, position) deferrable initially deferred,
  unique (assignment_id, item_key),
  check (not is_removed or is_customised)
);

alter table public.class_program_items enable row level security;

create index class_program_items_exercise_idx on public.class_program_items (exercise_id);

create trigger set_updated_at before update on public.class_program_items
  for each row execute function public.set_updated_at();

-- Any edit made outside a library push or a reset marks the row as the class's own.
create function public.flag_class_item_customised()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('reprx.program_sync', true), 'off') = 'on' then
    return new;
  end if;

  if (new.exercise_id, new.sets, new.reps, new.rm_percentage, new.fallback_weight_kg,
      new.rest_seconds, new.notes, new.superset_group, new.position, new.is_removed)
     is distinct from
     (old.exercise_id, old.sets, old.reps, old.rm_percentage, old.fallback_weight_kg,
      old.rest_seconds, old.notes, old.superset_group, old.position, old.is_removed) then
    new.is_customised := true;
  end if;

  return new;
end;
$$;

create trigger flag_class_item_customised before update on public.class_program_items
  for each row execute function public.flag_class_item_customised();

-- One row per version applied to an assignment. Drives program history (Phase 3).
create table public.class_program_pushes (
  id            bigint generated always as identity primary key,
  assignment_id bigint not null references public.class_program_assignments (id) on delete cascade,
  version_id    bigint not null references public.program_versions (id),
  applied_at    timestamptz not null default now(),
  applied_by    uuid default auth.uid() references public.staff (id),
  rows_changed  jsonb not null default '{}'
);

alter table public.class_program_pushes enable row level security;

create index class_program_pushes_assignment_idx
  on public.class_program_pushes (assignment_id, applied_at);

-- Audit
create trigger audit_row after insert or update or delete on public.library_programs
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.program_versions
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.program_version_items
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.class_program_assignments
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.class_program_items
  for each row execute function public.audit_row();
create trigger audit_row after insert or update or delete on public.class_program_pushes
  for each row execute function public.audit_row();

-- Applies a version to one class copy. Uncustomised rows follow the version (exercise
-- swaps, values, order, additions and removals); customised rows are kept as they are and
-- placed after the row they followed before. Returns what changed.
create function public.push_version_to_assignment(p_assignment_id bigint, p_version_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_library uuid[];
  v_order uuid[];
  v_index int;
  v_updated int;
  v_added int;
  v_removed int;
  v_kept int;
  r record;
begin
  if not exists (
    select 1
    from public.class_program_assignments a
    join public.program_versions v on v.program_id = a.program_id
    where a.id = p_assignment_id and v.id = p_version_id
  ) then
    raise exception 'That version doesn''t belong to the class''s program.' using errcode = 'RX009';
  end if;

  perform set_config('reprx.program_sync', 'on', true);

  select coalesce(array_agg(i.item_key order by i.position), '{}')
  into v_library
  from public.program_version_items i
  where i.version_id = p_version_id;

  v_order := v_library;

  -- Class rows the library doesn't have, kept in their relative place.
  for r in
    select s.item_key, s.prev_key
    from (
      select c.item_key, c.is_customised, c.position,
             lag(c.item_key) over (order by c.position) as prev_key
      from public.class_program_items c
      where c.assignment_id = p_assignment_id
    ) s
    where s.is_customised and not (s.item_key = any (v_library))
    order by s.position
  loop
    v_index := case when r.prev_key is null then 0 else array_position(v_order, r.prev_key) end;
    if v_index is null then
      v_order := v_order || r.item_key;
    else
      v_order := v_order[1:v_index] || r.item_key || v_order[v_index + 1:];
    end if;
  end loop;

  select count(*) into v_kept
  from public.class_program_items c
  where c.assignment_id = p_assignment_id and c.is_customised;

  delete from public.class_program_items c
  where c.assignment_id = p_assignment_id
    and not c.is_customised
    and not (c.item_key = any (v_library));
  get diagnostics v_removed = row_count;

  update public.class_program_items c
  set exercise_id = i.exercise_id,
      sets = i.sets,
      reps = i.reps,
      rm_percentage = i.rm_percentage,
      fallback_weight_kg = i.fallback_weight_kg,
      rest_seconds = i.rest_seconds,
      notes = i.notes,
      superset_group = i.superset_group,
      source_version_id = p_version_id
  from public.program_version_items i
  where c.assignment_id = p_assignment_id
    and not c.is_customised
    and i.version_id = p_version_id
    and i.item_key = c.item_key
    and (c.exercise_id, c.sets, c.reps, c.rm_percentage, c.fallback_weight_kg,
         c.rest_seconds, c.notes, c.superset_group)
        is distinct from
        (i.exercise_id, i.sets, i.reps, i.rm_percentage, i.fallback_weight_kg,
         i.rest_seconds, i.notes, i.superset_group);
  get diagnostics v_updated = row_count;

  insert into public.class_program_items (
    assignment_id, item_key, position, exercise_id, sets, reps, rm_percentage,
    fallback_weight_kg, rest_seconds, notes, superset_group, source_version_id
  )
  select p_assignment_id, i.item_key, array_position(v_order, i.item_key), i.exercise_id,
         i.sets, i.reps, i.rm_percentage, i.fallback_weight_kg, i.rest_seconds, i.notes,
         i.superset_group, p_version_id
  from public.program_version_items i
  where i.version_id = p_version_id
    and not exists (
      select 1 from public.class_program_items c
      where c.assignment_id = p_assignment_id and c.item_key = i.item_key
    );
  get diagnostics v_added = row_count;

  -- The unique order is checked at commit, so positions can be rewritten in one pass.
  update public.class_program_items c
  set position = array_position(v_order, c.item_key)
  where c.assignment_id = p_assignment_id
    and c.position is distinct from array_position(v_order, c.item_key);

  insert into public.class_program_pushes (assignment_id, version_id, rows_changed)
  values (
    p_assignment_id,
    p_version_id,
    jsonb_build_object(
      'updated', v_updated, 'added', v_added, 'removed', v_removed, 'kept_customised', v_kept
    )
  );

  perform set_config('reprx.program_sync', 'off', true);

  return jsonb_build_object(
    'updated', v_updated, 'added', v_added, 'removed', v_removed, 'kept_customised', v_kept
  );
end;
$$;

-- Saves a new version and pushes it to every class running or queued to run the program.
-- p_items: ordered array of {item_key?, exercise_id, sets, reps, rm_percentage,
-- fallback_weight_kg, rest_seconds, notes, superset_group}.
create function public.save_program_version(p_program_id bigint, p_name text, p_items jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_program public.library_programs;
  v_version_id bigint;
  v_version_no int;
  v_classes int := 0;
  a record;
begin
  select * into v_program from public.library_programs where id = p_program_id for update;
  if not found then
    raise exception 'That program wasn''t found.' using errcode = 'RX009';
  end if;
  if v_program.status = 'archived' then
    raise exception 'Archived programs can''t be edited. Unarchive it first.' using errcode = 'RX009';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_version_no
  from public.program_versions where program_id = p_program_id;

  insert into public.program_versions (program_id, version_no)
  values (p_program_id, v_version_no)
  returning id into v_version_id;

  insert into public.program_version_items (
    version_id, item_key, position, exercise_id, sets, reps, rm_percentage,
    fallback_weight_kg, rest_seconds, notes, superset_group
  )
  select v_version_id,
         coalesce(nullif(item ->> 'item_key', '')::uuid, gen_random_uuid()),
         ordinality::int,
         (item ->> 'exercise_id')::bigint,
         (item ->> 'sets')::int,
         item ->> 'reps',
         nullif(item ->> 'rm_percentage', '')::numeric,
         nullif(item ->> 'fallback_weight_kg', '')::numeric,
         nullif(item ->> 'rest_seconds', '')::int,
         nullif(item ->> 'notes', ''),
         nullif(item ->> 'superset_group', '')::int
  from jsonb_array_elements(coalesce(p_items, '[]')) with ordinality as e (item, ordinality);

  perform public.validate_supersets(v_version_id);

  update public.library_programs
  set name = coalesce(nullif(trim(p_name), ''), name),
      current_version_id = v_version_id
  where id = p_program_id;

  for a in
    select id from public.class_program_assignments
    where program_id = p_program_id
      and (end_date is null or end_date >= public.practice_today())
    order by id
  loop
    perform public.push_version_to_assignment(a.id, v_version_id);
    v_classes := v_classes + 1;
  end loop;

  return jsonb_build_object('version_no', v_version_no, 'classes_updated', v_classes);
end;
$$;

-- Phase 2 replaces this with the superset rules.
create function public.validate_supersets(p_version_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  return;
end;
$$;

create function public.create_program(p_name text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.library_programs (code, name) values ('', trim(p_name))
  returning id into v_id;
  perform public.save_program_version(v_id, p_name, '[]');
  return v_id;
end;
$$;

-- A copy for rapid building: new code, version 1, fresh item identities.
create function public.duplicate_program(p_program_id bigint, p_name text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_items jsonb;
begin
  select coalesce(jsonb_agg(
           (to_jsonb(i) - array['id', 'version_id', 'item_key', 'position', 'created_at'])
           order by i.position), '[]')
  into v_items
  from public.library_programs p
  join public.program_version_items i on i.version_id = p.current_version_id
  where p.id = p_program_id;

  insert into public.library_programs (code, name) values ('', trim(p_name))
  returning id into v_id;
  perform public.save_program_version(v_id, p_name, v_items);
  return v_id;
end;
$$;

create function public.set_program_archived(p_program_id bigint, p_archived boolean)
returns void
language sql
set search_path = ''
as $$
  update public.library_programs
  set status = case when p_archived then 'archived' else 'active' end
  where id = p_program_id;
$$;

-- Builds the class copy from the program's current version.
create function public.assign_program(
  p_class_id bigint,
  p_program_id bigint,
  p_start_date date,
  p_end_date date default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_version_id bigint;
begin
  select current_version_id into v_version_id
  from public.library_programs where id = p_program_id;

  insert into public.class_program_assignments (class_id, program_id, start_date, end_date)
  values (p_class_id, p_program_id, p_start_date, p_end_date)
  returning id into v_id;

  perform public.push_version_to_assignment(v_id, v_version_id);
  return v_id;
end;
$$;

-- Class-copy edits. Changes made here mark the row customised (flag_class_item_customised).
create function public.add_class_item(
  p_assignment_id bigint,
  p_exercise_id bigint,
  p_sets int default 3,
  p_reps text default '10',
  p_rm_percentage numeric default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.class_program_items (
    assignment_id, position, exercise_id, sets, reps, rm_percentage, is_customised
  )
  select p_assignment_id, coalesce(max(position), 0) + 1, p_exercise_id, p_sets, p_reps,
         p_rm_percentage, true
  from public.class_program_items
  where assignment_id = p_assignment_id
  returning id into v_id;
  return v_id;
end;
$$;

-- Library rows are kept as removed, so the next push doesn't bring them back.
create function public.remove_class_item(p_item_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.class_program_items
  where id = p_item_id and source_version_id is null;

  if not found then
    update public.class_program_items
    set is_removed = true, is_customised = true
    where id = p_item_id;
  end if;
end;
$$;

create function public.reset_class_item(p_item_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item public.class_program_items;
  v_library public.program_version_items;
begin
  select * into v_item from public.class_program_items where id = p_item_id;
  if v_item.source_version_id is null then
    raise exception 'This row was added for the class only. Remove it instead.'
      using errcode = 'RX009';
  end if;

  select i.* into v_library
  from public.class_program_assignments a
  join public.library_programs p on p.id = a.program_id
  join public.program_version_items i
    on i.version_id = p.current_version_id and i.item_key = v_item.item_key
  where a.id = v_item.assignment_id;

  perform set_config('reprx.program_sync', 'on', true);

  if v_library.id is null then
    -- The library no longer has this row.
    delete from public.class_program_items where id = p_item_id;
  else
    update public.class_program_items
    set exercise_id = v_library.exercise_id,
        sets = v_library.sets,
        reps = v_library.reps,
        rm_percentage = v_library.rm_percentage,
        fallback_weight_kg = v_library.fallback_weight_kg,
        rest_seconds = v_library.rest_seconds,
        notes = v_library.notes,
        superset_group = v_library.superset_group,
        source_version_id = v_library.version_id,
        is_customised = false,
        is_removed = false
    where id = p_item_id;
  end if;

  perform set_config('reprx.program_sync', 'off', true);
end;
$$;

-- Swaps a class row with its visible neighbour. The moved row becomes customised.
create function public.move_class_item(p_item_id bigint, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item public.class_program_items;
  v_other public.class_program_items;
begin
  select * into v_item from public.class_program_items where id = p_item_id;

  select * into v_other
  from public.class_program_items
  where assignment_id = v_item.assignment_id
    and not is_removed
    and case when p_direction = 'up' then position < v_item.position
             else position > v_item.position end
  order by case when p_direction = 'up' then -position else position end
  limit 1;

  if v_other.id is null then
    return;
  end if;

  update public.class_program_items set position = v_other.position where id = v_item.id;
  perform set_config('reprx.program_sync', 'on', true);
  update public.class_program_items set position = v_item.position where id = v_other.id;
  perform set_config('reprx.program_sync', 'off', true);
end;
$$;

-- Old per-class tables: kept, read-only, until the owner confirms the final cleanup.
revoke insert, update, delete on public.programs, public.program_exercises from authenticated;
revoke execute on function public.reorder_program_exercises(bigint, bigint[]) from authenticated;

-- Access
grant select on public.library_programs, public.program_versions, public.program_version_items,
  public.class_program_assignments, public.class_program_items, public.class_program_pushes
  to authenticated;
grant insert (code, name) on public.library_programs to authenticated;
grant update (name, status, current_version_id) on public.library_programs to authenticated;
grant insert on public.program_versions, public.program_version_items,
  public.class_program_items, public.class_program_pushes to authenticated;
grant insert (class_id, program_id, start_date, end_date) on public.class_program_assignments
  to authenticated;
grant update (end_date) on public.class_program_assignments to authenticated;
grant delete on public.class_program_assignments to authenticated;
grant update, delete on public.class_program_items to authenticated;

create policy library_programs_select on public.library_programs for select to authenticated
  using ((select public.is_staff()));
create policy library_programs_insert on public.library_programs for insert to authenticated
  with check ((select public.is_staff()));
create policy library_programs_update on public.library_programs for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy program_versions_select on public.program_versions for select to authenticated
  using ((select public.is_staff()));
create policy program_versions_insert on public.program_versions for insert to authenticated
  with check ((select public.is_staff()) and created_by = (select auth.uid()));

create policy program_version_items_select on public.program_version_items for select to authenticated
  using ((select public.is_staff()));
create policy program_version_items_insert on public.program_version_items for insert to authenticated
  with check ((select public.is_staff()));

create policy class_program_assignments_select on public.class_program_assignments
  for select to authenticated using ((select public.is_staff()));
create policy class_program_assignments_insert on public.class_program_assignments
  for insert to authenticated
  with check ((select public.is_staff()) and created_by = (select auth.uid()));
create policy class_program_assignments_update on public.class_program_assignments
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
-- Only a queued assignment that never took effect can be withdrawn.
create policy class_program_assignments_delete on public.class_program_assignments
  for delete to authenticated
  using ((select public.is_staff()) and start_date > (select public.practice_today()));

create policy class_program_items_select on public.class_program_items for select to authenticated
  using ((select public.is_staff()));
create policy class_program_items_insert on public.class_program_items for insert to authenticated
  with check ((select public.is_staff()));
create policy class_program_items_update on public.class_program_items for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy class_program_items_delete on public.class_program_items for delete to authenticated
  using ((select public.is_staff()));

create policy class_program_pushes_select on public.class_program_pushes for select to authenticated
  using ((select public.is_staff()));
create policy class_program_pushes_insert on public.class_program_pushes for insert to authenticated
  with check ((select public.is_staff()));

-- The code trigger runs as the caller, so staff need the sequence.
grant usage on sequence public.library_program_code_seq to authenticated;

grant execute on function public.practice_today() to authenticated;
grant execute on function public.push_version_to_assignment(bigint, bigint) to authenticated;
grant execute on function public.save_program_version(bigint, text, jsonb) to authenticated;
grant execute on function public.validate_supersets(bigint) to authenticated;
grant execute on function public.create_program(text) to authenticated;
grant execute on function public.duplicate_program(bigint, text) to authenticated;
grant execute on function public.set_program_archived(bigint, boolean) to authenticated;
grant execute on function public.assign_program(bigint, bigint, date, date) to authenticated;
grant execute on function public.add_class_item(bigint, bigint, int, text, numeric) to authenticated;
grant execute on function public.remove_class_item(bigint) to authenticated;
grant execute on function public.reset_class_item(bigint) to authenticated;
grant execute on function public.move_class_item(bigint, text) to authenticated;
