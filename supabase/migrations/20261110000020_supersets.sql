-- Supersets (update spec, Phase 2): a group of 2+ adjacent exercises sharing superset_group.
-- A library version must already be valid. A class copy is normalised instead, so a push or
-- a removed row can never leave a broken group behind: singletons are ungrouped, and a group
-- split by another row becomes separate groups.

create or replace function public.validate_supersets(p_version_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.program_version_items
    where version_id = p_version_id and superset_group is not null
    group by superset_group
    having count(*) < 2 or max(position) - min(position) + 1 <> count(*)
  ) then
    raise exception 'Superset exercises must be next to each other, with at least 2 in a group.'
      using errcode = 'RX010';
  end if;
end;
$$;

create function public.normalise_class_supersets(p_assignment_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sync text := coalesce(current_setting('reprx.program_sync', true), 'off');
begin
  -- Mechanical tidying, not a customisation.
  perform set_config('reprx.program_sync', 'on', true);

  with visible as (
    select id, superset_group, row_number() over (order by position) as rn
    from public.class_program_items
    where assignment_id = p_assignment_id and not is_removed
  ),
  runs as (
    select id, superset_group,
           rn - row_number() over (partition by superset_group order by rn) as run_key
    from visible
    where superset_group is not null
  ),
  sized as (
    select id, superset_group, run_key,
           count(*) over (partition by superset_group, run_key) as size,
           dense_rank() over (partition by superset_group order by run_key) as run_no,
           dense_rank() over (order by superset_group, run_key) as global_run
    from runs
  ),
  target as (
    select id,
           case when size < 2 then null
                when run_no = 1 then superset_group
                else (select coalesce(max(superset_group), 0) from public.class_program_items
                      where assignment_id = p_assignment_id) + global_run::int
           end as new_group
    from sized
  )
  update public.class_program_items c
  set superset_group = t.new_group
  from target t
  where c.id = t.id and c.superset_group is distinct from t.new_group;

  -- Removed rows aren't shown, so they belong to no group.
  update public.class_program_items
  set superset_group = null
  where assignment_id = p_assignment_id and is_removed and superset_group is not null;

  perform set_config('reprx.program_sync', v_sync, true);
end;
$$;

-- Groups the given visible rows of one class copy. They must be adjacent.
create function public.set_class_superset(p_item_ids bigint[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_assignment bigint;
  v_group int;
begin
  select min(assignment_id) into v_assignment
  from public.class_program_items where id = any (p_item_ids);

  if cardinality(p_item_ids) < 2 or (
    select count(distinct assignment_id) from public.class_program_items
    where id = any (p_item_ids)
  ) <> 1 then
    raise exception 'Choose at least 2 exercises to group.' using errcode = 'RX010';
  end if;

  if exists (
    with visible as (
      select id, row_number() over (order by position) as rn
      from public.class_program_items
      where assignment_id = v_assignment and not is_removed
    )
    select 1 from visible where id = any (p_item_ids)
    having max(rn) - min(rn) + 1 <> count(*) or count(*) <> cardinality(p_item_ids)
  ) then
    raise exception 'Superset exercises must be next to each other, with at least 2 in a group.'
      using errcode = 'RX010';
  end if;

  select coalesce(max(superset_group), 0) + 1 into v_group
  from public.class_program_items where assignment_id = v_assignment;

  update public.class_program_items set superset_group = v_group where id = any (p_item_ids);
  perform public.normalise_class_supersets(v_assignment);
end;
$$;

create function public.clear_class_superset(p_item_ids bigint[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_assignment bigint;
begin
  select min(assignment_id) into v_assignment
  from public.class_program_items where id = any (p_item_ids);

  update public.class_program_items set superset_group = null
  where id = any (p_item_ids) and superset_group is not null;
  perform public.normalise_class_supersets(v_assignment);
end;
$$;

-- Drag-to-reorder in a class copy. Only the dragged row becomes customised; the rows it
-- passes just shift.
create function public.move_class_item_to(p_item_id bigint, p_index int)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_assignment bigint;
  v_order bigint[];
begin
  select assignment_id into v_assignment from public.class_program_items where id = p_item_id;

  select array_agg(id order by position) into v_order
  from public.class_program_items
  where assignment_id = v_assignment and not is_removed and id <> p_item_id;

  p_index := greatest(1, least(p_index, coalesce(cardinality(v_order), 0) + 1));
  v_order := coalesce(v_order[1:p_index - 1], '{}') || p_item_id || coalesce(v_order[p_index:], '{}');

  -- Removed rows go to the end, so the visible rows take positions 1..n.
  select v_order || coalesce(array_agg(id order by position), '{}') into v_order
  from public.class_program_items
  where assignment_id = v_assignment and is_removed;

  perform set_config('reprx.program_sync', 'on', true);
  update public.class_program_items c
  set position = array_position(v_order, c.id)
  where c.assignment_id = v_assignment and c.id <> p_item_id
    and c.position <> array_position(v_order, c.id);
  perform set_config('reprx.program_sync', 'off', true);

  update public.class_program_items
  set position = array_position(v_order, id)
  where id = p_item_id and position <> array_position(v_order, id);

  perform public.normalise_class_supersets(v_assignment);
end;
$$;

-- Every class-copy change ends with the groups tidied.
create or replace function public.remove_class_item(p_item_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_assignment bigint;
begin
  select assignment_id into v_assignment from public.class_program_items where id = p_item_id;

  delete from public.class_program_items
  where id = p_item_id and source_version_id is null;

  if not found then
    update public.class_program_items
    set is_removed = true, is_customised = true
    where id = p_item_id;
  end if;

  perform public.normalise_class_supersets(v_assignment);
end;
$$;

create or replace function public.move_class_item(p_item_id bigint, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item public.class_program_items;
  v_index int;
begin
  select * into v_item from public.class_program_items where id = p_item_id;

  select rn into v_index
  from (
    select id, row_number() over (order by position) as rn
    from public.class_program_items
    where assignment_id = v_item.assignment_id and not is_removed
  ) visible
  where id = p_item_id;

  perform public.move_class_item_to(
    p_item_id, v_index + case when p_direction = 'up' then -1 else 1 end
  );
end;
$$;

-- The push and reset tidy the groups too. Wrapping keeps their tested bodies unchanged.
alter function public.push_version_to_assignment(bigint, bigint)
  rename to push_version_to_assignment_rows;

create function public.push_version_to_assignment(p_assignment_id bigint, p_version_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.push_version_to_assignment_rows(p_assignment_id, p_version_id);
  perform public.normalise_class_supersets(p_assignment_id);
  return v_result;
end;
$$;

alter function public.reset_class_item(bigint) rename to reset_class_item_row;

create function public.reset_class_item(p_item_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_assignment bigint;
begin
  select assignment_id into v_assignment from public.class_program_items where id = p_item_id;
  perform public.reset_class_item_row(p_item_id);
  perform public.normalise_class_supersets(v_assignment);
end;
$$;

grant execute on function public.normalise_class_supersets(bigint) to authenticated;
grant execute on function public.set_class_superset(bigint[]) to authenticated;
grant execute on function public.clear_class_superset(bigint[]) to authenticated;
grant execute on function public.move_class_item_to(bigint, int) to authenticated;
grant execute on function public.push_version_to_assignment(bigint, bigint) to authenticated;
grant execute on function public.reset_class_item(bigint) to authenticated;
