-- Exercise colours (owner request, Nov 2026): an optional colour per program row, chosen from
-- a fixed print-safe palette, shown on the exercise cell of the session grid, the take-home
-- sheets and the program editors. Colour is part of a version and follows the push rule like
-- any other value; changing it on a class copy marks the row customised. Snapshots keep the
-- colour shown on the day.

alter table public.program_version_items
  add column colour text check (colour in ('orange', 'blue', 'green', 'pink', 'purple', 'yellow', 'grey'));
alter table public.class_program_items
  add column colour text check (colour in ('orange', 'blue', 'green', 'pink', 'purple', 'yellow', 'grey'));
alter table public.session_snapshot_rows add column colour text;

create or replace function public.flag_class_item_customised()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('reprx.program_sync', true), 'off') = 'on' then
    return new;
  end if;

  if (new.exercise_id, new.sets, new.reps, new.rm_percentage, new.fallback_weight_kg,
      new.rest_seconds, new.notes, new.superset_group, new.colour, new.position, new.is_removed)
     is distinct from
     (old.exercise_id, old.sets, old.reps, old.rm_percentage, old.fallback_weight_kg,
      old.rest_seconds, old.notes, old.superset_group, old.colour, old.position, old.is_removed) then
    new.is_customised := true;
  end if;

  return new;
end;
$$;

-- Unchanged apart from carrying colour.
create or replace function public.push_version_to_assignment_rows(p_assignment_id bigint, p_version_id bigint)
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
      colour = i.colour,
      source_version_id = p_version_id
  from public.program_version_items i
  where c.assignment_id = p_assignment_id
    and not c.is_customised
    and i.version_id = p_version_id
    and i.item_key = c.item_key
    and (c.exercise_id, c.sets, c.reps, c.rm_percentage, c.fallback_weight_kg,
         c.rest_seconds, c.notes, c.superset_group, c.colour)
        is distinct from
        (i.exercise_id, i.sets, i.reps, i.rm_percentage, i.fallback_weight_kg,
         i.rest_seconds, i.notes, i.superset_group, i.colour);
  get diagnostics v_updated = row_count;

  insert into public.class_program_items (
    assignment_id, item_key, position, exercise_id, sets, reps, rm_percentage,
    fallback_weight_kg, rest_seconds, notes, superset_group, colour, source_version_id
  )
  select p_assignment_id, i.item_key, array_position(v_order, i.item_key), i.exercise_id,
         i.sets, i.reps, i.rm_percentage, i.fallback_weight_kg, i.rest_seconds, i.notes,
         i.superset_group, i.colour, p_version_id
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

create or replace function public.save_program_version(p_program_id bigint, p_name text, p_items jsonb)
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
    fallback_weight_kg, rest_seconds, notes, superset_group, colour
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
         nullif(item ->> 'superset_group', '')::int,
         nullif(item ->> 'colour', '')
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

create or replace function public.reset_class_item_row(p_item_id bigint)
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
        colour = v_library.colour,
        source_version_id = v_library.version_id,
        is_customised = false,
        is_removed = false
    where id = p_item_id;
  end if;

  perform set_config('reprx.program_sync', 'off', true);
end;
$$;

-- The return type gains colour, so the function is recreated.
drop function public.effective_weights_at(bigint, date);

create function public.effective_weights_at(p_class_id bigint, p_date date)
returns table (
  client_id bigint, item_id bigint, item_key uuid, exercise_id bigint, exercise_name text,
  order_index int, sets int, reps text, rm_percentage numeric, superset_group int,
  program_version_id bigint, rm_result_id bigint, latest_1rm_kg numeric,
  latest_test_date date, calculated_kg numeric, override_kg numeric, override_note text,
  override_review_date date, fallback_kg numeric, effective_kg numeric, weight_source text,
  colour text
)
language sql
stable
set search_path = ''
as $$
  with members as (
    select m.client_id
    from public.class_members m
    where m.class_id = p_class_id and p_date >= public.practice_today()
    union
    select en.client_id
    from public.enrolments en
    where en.class_id = p_class_id
      and p_date < public.practice_today()
      and en.start_date <= p_date
      and (en.end_date is null or en.end_date > p_date)
  ),
  assignment as (
    select a.id
    from public.class_program_assignments a
    where a.class_id = p_class_id
      and p_date between a.start_date and coalesce(a.end_date, 'infinity'::date)
  ),
  version as (
    select p.version_id
    from public.class_program_pushes p
    join assignment a on a.id = p.assignment_id
    where (p.applied_at at time zone 'Australia/Brisbane')::date <= greatest(p_date, public.practice_today())
    order by p.applied_at desc
    limit 1
  )
  select mem.client_id, pe.id, pe.item_key, pe.exercise_id, x.name, pe.position, pe.sets,
         pe.reps, pe.rm_percentage, pe.superset_group, (select version_id from version),
         rm.id, rm.estimated_1rm_kg, rm.test_date, calc.calculated_kg,
         o.override_weight_kg, o.note, o.review_date, pe.fallback_weight_kg,
         case
           when o.id is not null then o.override_weight_kg
           when calc.calculated_kg is not null then calc.calculated_kg
           else pe.fallback_weight_kg
         end,
         case
           when o.id is not null then 'override'
           when calc.calculated_kg is not null then 'calculated'
           when pe.fallback_weight_kg is not null then 'fallback'
           when pe.rm_percentage is null then 'bodyweight'
           else 'not_tested'
         end,
         pe.colour
  from members mem
  join public.clients c on c.id = mem.client_id and c.deleted_at is null
  cross join assignment a
  join public.class_program_items pe on pe.assignment_id = a.id and not pe.is_removed
  join public.exercises x on x.id = pe.exercise_id
  cross join public.app_settings s
  left join public.weight_overrides o
    on o.client_id = mem.client_id and o.exercise_id = pe.exercise_id and o.ended_at is null
  left join lateral (
    select r.id, r.estimated_1rm_kg, ts.test_date
    from public.rm_results r
    join public.rm_testing_sessions ts on ts.id = r.session_id
    where ts.client_id = mem.client_id and r.exercise_id = pe.exercise_id
      and r.voided_at is null
    order by ts.test_date desc, ts.session_no desc
    limit 1
  ) rm on true
  cross join lateral (
    select public.round_to_increment(rm.estimated_1rm_kg * pe.rm_percentage,
                                     s.rounding_increment_kg) as calculated_kg
  ) calc
  order by mem.client_id, pe.position;
$$;

revoke all on function public.effective_weights_at(bigint, date) from public, anon;
grant execute on function public.effective_weights_at(bigint, date) to authenticated;

create or replace function private.snapshot_session(p_class_id bigint, p_date date, p_label text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_occurrence public.session_occurrences;
  v_rows int;
begin
  insert into public.session_occurrences (class_id, session_date)
  values (p_class_id, p_date)
  on conflict (class_id, session_date) do nothing;

  select * into v_occurrence
  from public.session_occurrences
  where class_id = p_class_id and session_date = p_date
  for update;

  if v_occurrence.status = 'locked' then
    return v_occurrence.id;
  end if;

  insert into private.purge_context (xact) values (pg_current_xact_id()::text)
  on conflict do nothing;

  delete from public.session_snapshot_rows where occurrence_id = v_occurrence.id;

  insert into public.session_snapshot_rows (
    occurrence_id, client_id, item_key, exercise_id, exercise_name, position, superset_group,
    sets, reps, rm_percentage, calculated_kg, effective_kg, weight_source, is_override,
    override_note, program_version_id, rm_result_id, colour
  )
  select v_occurrence.id, w.client_id, w.item_key, w.exercise_id, w.exercise_name,
         w.order_index, w.superset_group, w.sets, w.reps, w.rm_percentage, w.calculated_kg,
         w.effective_kg, w.weight_source, w.weight_source = 'override', w.override_note,
         w.program_version_id, w.rm_result_id, w.colour
  from public.effective_weights_at(p_class_id, p_date) w;
  get diagnostics v_rows = row_count;

  update public.session_occurrences set snapshot_at = now() where id = v_occurrence.id;

  delete from private.purge_context where xact = pg_current_xact_id()::text;

  insert into public.audit_log (actor, actor_label, table_name, row_pk, action, new_row)
  values (auth.uid(), p_label, 'session_occurrences', v_occurrence.id::text, 'UPDATE',
          jsonb_build_object('class_id', p_class_id, 'session_date', p_date, 'rows', v_rows));

  return v_occurrence.id;
end;
$$;
