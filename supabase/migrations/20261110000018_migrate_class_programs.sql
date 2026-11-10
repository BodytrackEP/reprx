-- Converts the old one-program-per-class tables into the library (update spec, Phase 1).
-- Classes whose programs match on exercise, order, sets, reps and % share one library
-- program. Where a merged class's starting weight, rest or notes differ, that row keeps the
-- class's values and is marked customised, so nothing is lost. Assignments start on the
-- class's creation date (owner decision). Idempotent: classes already assigned are skipped.
-- Lives in the private schema so pgTAP can exercise it; no API role can call it.
create function private.convert_legacy_programs()
returns int
language plpgsql
set search_path = ''
as $$
declare
  g record;
  c record;
  v_program_id bigint;
  v_version_id bigint;
  v_assignment_id bigint;
  v_converted int := 0;
begin
  perform set_config('reprx.actor_label', 'migration:programs', true);

  for g in
    with legacy as (
      select p.id as program_id, p.class_id, p.name,
             coalesce(string_agg(
               pe.exercise_id || ':' || pe.sets || ':' || pe.reps || ':' ||
               coalesce(pe.rm_percentage::text, '-'),
               '|' order by pe.order_index), 'empty:' || p.id) as signature
      from public.programs p
      left join public.program_exercises pe on pe.program_id = p.id
      where not exists (
        select 1 from public.class_program_assignments a where a.class_id = p.class_id
      )
      group by p.id
    )
    select signature, array_agg(program_id order by class_id) as program_ids
    from legacy
    group by signature
    order by min(class_id)
  loop
    insert into public.library_programs (code, name)
    select '', name from public.programs where id = g.program_ids[1]
    returning id into v_program_id;

    insert into public.program_versions (program_id, version_no, created_by)
    values (v_program_id, 1, null)
    returning id into v_version_id;

    insert into public.program_version_items (
      version_id, item_key, position, exercise_id, sets, reps, rm_percentage,
      fallback_weight_kg, rest_seconds, notes
    )
    select v_version_id, gen_random_uuid(),
           row_number() over (order by pe.order_index)::int,
           pe.exercise_id, pe.sets, pe.reps::text, pe.rm_percentage,
           pe.fallback_weight_kg, pe.rest_seconds, pe.notes
    from public.program_exercises pe
    where pe.program_id = g.program_ids[1];

    update public.library_programs set current_version_id = v_version_id
    where id = v_program_id;

    for c in
      select p.id as legacy_id, p.class_id, cl.created_at
      from public.programs p
      join public.classes cl on cl.id = p.class_id
      where p.id = any (g.program_ids)
      order by p.class_id
    loop
      insert into public.class_program_assignments (class_id, program_id, start_date, created_by)
      values (c.class_id, v_program_id,
              (c.created_at at time zone 'Australia/Brisbane')::date, null)
      returning id into v_assignment_id;

      insert into public.class_program_items (
        assignment_id, item_key, position, exercise_id, sets, reps, rm_percentage,
        fallback_weight_kg, rest_seconds, notes, source_version_id, is_customised
      )
      select v_assignment_id, i.item_key, i.position, i.exercise_id, i.sets, i.reps,
             i.rm_percentage, pe.fallback_weight_kg, pe.rest_seconds, pe.notes, v_version_id,
             (pe.fallback_weight_kg, pe.rest_seconds, pe.notes)
               is distinct from (i.fallback_weight_kg, i.rest_seconds, i.notes)
      from public.program_version_items i
      join (
        select x.*, row_number() over (order by x.order_index)::int as position
        from public.program_exercises x
        where x.program_id = c.legacy_id
      ) pe on pe.position = i.position
      where i.version_id = v_version_id;

      insert into public.class_program_pushes (
        assignment_id, version_id, applied_at, applied_by, rows_changed
      )
      values (v_assignment_id, v_version_id, c.created_at, null,
              jsonb_build_object('migrated_from_program', c.legacy_id));

      v_converted := v_converted + 1;
    end loop;
  end loop;

  return v_converted;
end;
$$;

revoke all on function private.convert_legacy_programs() from public;

select private.convert_legacy_programs();
