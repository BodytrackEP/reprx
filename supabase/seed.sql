-- Fake data for local and test. Idempotent: fixed ids (900000+) with on conflict do nothing.
-- Refuses anything but local or test. A fresh database is 'unset', which is refused too.
begin;

do $$
begin
  if (select environment from public.app_settings) not in ('local', 'test') then
    raise exception 'Refusing to seed: app_settings.environment is not local or test.';
  end if;
end;
$$;

select set_config('reprx.actor_label', 'seed', true);

-- Seeded rows need a staff member to point at. This account has no password and is
-- inactive, so nobody can sign in with it.
insert into auth.users (id, email, aud, role)
values (
  '00000000-0000-0000-0000-000000000900', 'seed@reprx.invalid', 'authenticated', 'authenticated'
)
on conflict (id) do nothing;

insert into public.staff (id, display_name, role, is_active)
values ('00000000-0000-0000-0000-000000000900', 'Seed Data', 'ep', false)
on conflict (id) do nothing;

insert into public.clients (id, first_name, last_name, is_test)
overriding system value
select 900000 + n, 'Test', 'Client ' || lpad(n::text, 2, '0'), true
from generate_series(1, 40) as n
on conflict do nothing;

insert into public.exercises (id, name, muscle_group, equipment)
overriding system value
select 900000 + row_number() over (), e.name, e.muscle_group, e.equipment
from (values
  ('Barbell Back Squat', 'Quadriceps', 'Barbell'),
  ('Leg Press',          'Quadriceps', 'Machine'),
  ('Leg Extension',      'Quadriceps', 'Machine'),
  ('Leg Curl',           'Hamstrings', 'Machine'),
  ('Romanian Deadlift',  'Hamstrings', 'Barbell'),
  ('Deadlift',           'Full Body',  'Barbell'),
  ('Hip Thrust',         'Glutes',     'Barbell'),
  ('Calf Raise',         'Calves',     'Machine'),
  ('Bench Press',        'Chest',      'Barbell'),
  ('Chest Fly',          'Chest',      'Dumbbell'),
  ('Chest Press',        'Chest',      'Machine'),
  ('Seated Row',         'Back',       'Cable'),
  ('Lat Pulldown',       'Back',       'Cable'),
  ('Dumbbell Row',       'Back',       'Dumbbell'),
  ('Shoulder Press',     'Shoulders',  'Dumbbell'),
  ('Lateral Raise',      'Shoulders',  'Dumbbell'),
  ('Bicep Curl',         'Biceps',     'Dumbbell'),
  ('Tricep Pushdown',    'Triceps',    'Cable'),
  ('Goblet Squat',       'Quadriceps', 'Kettlebell'),
  ('Farmer Carry',       'Full Body',  'Dumbbell'),
  ('Plank',              'Core',       'Bodyweight'),
  ('Wall Sit',           'Quadriceps', 'Bodyweight'),
  ('Step Ups',           'Quadriceps', 'Step'),
  ('Sit to Stand',       'Quadriceps', 'Bodyweight'),
  ('Seated Bike',        'Cardio',     'Machine')
) as e (name, muscle_group, equipment)
on conflict do nothing;

insert into public.classes
  (id, name, category_code, day_of_week, start_time, end_time, location, max_capacity)
overriding system value values
  (900001, 'Monday AM Strength',        'STRENGTH',         1, '09:00', '10:00', 'Studio A', 15),
  (900002, 'Tuesday Cardiac Rehab',     'CARDIAC_REHAB',    2, '10:00', '11:00', 'Studio B', 12),
  (900003, 'Wednesday Falls Prevention','FALLS_PREVENTION', 3, '14:00', '15:00', 'Studio A', 12),
  (900004, 'Thursday Chronic Disease',  'CHRONIC_DISEASE',  4, '16:00', '17:00', 'Studio A', 12),
  (900005, 'Friday NDIS Group',         'NDIS',             5, '11:00', '12:00', 'Studio B', 10),
  (900006, 'Friday Pulmonary Rehab',    'PULMONARY_REHAB',  5, '14:00', '15:00', 'Studio B', 10),
  (900007, 'Saturday Cancer Rehab',     'CANCER_REHAB',     6, '09:00', '10:00', 'Studio A', 10),
  (900008, 'Saturday General',          'GENERAL',          6, '08:00', '09:00', 'Studio A', 15)
on conflict do nothing;

insert into public.programs (id, class_id, name)
overriding system value
select id, id, name || ' Program'
from public.classes
where id between 900001 and 900008
on conflict do nothing;

-- Six to eight exercises per class. Exercises 900021+ are bodyweight or cardio, so they
-- have no percentage. Every third loaded exercise has a starting weight.
insert into public.program_exercises (
  id, program_id, exercise_id, order_index, sets, reps,
  rm_percentage, fallback_weight_kg, rest_seconds
)
overriding system value
select
  900000 + (p.n - 1) * 10 + slot,
  900000 + p.n,
  900000 + 1 + ((p.n * 3 + slot * 2) % 25),
  slot,
  2 + (slot % 2),
  10 + (p.n % 3) * 2,
  case when ((p.n * 3 + slot * 2) % 25) >= 20 then null
       else 0.5 + (p.n % 4) * 0.05 end,
  case when ((p.n * 3 + slot * 2) % 25) < 20 and slot % 3 = 0 then 10 + slot * 2.5 end,
  60
from generate_series(1, 8) as p (n)
cross join lateral generate_series(1, 6 + (p.n % 3)) as slot
on conflict (id) do nothing;

-- A ninth class runs the same program as Monday AM Strength, except one starting weight.
-- The conversion below merges the two into one shared library program and marks that
-- row as the class's own.
insert into public.classes
  (id, name, category_code, day_of_week, start_time, end_time, location, max_capacity)
overriding system value values
  (900009, 'Thursday PM Strength', 'STRENGTH', 4, '16:00', '17:00', 'Studio A', 15)
on conflict do nothing;

insert into public.programs (id, class_id, name)
overriding system value values (900009, 900009, 'Thursday PM Strength Program')
on conflict do nothing;

insert into public.program_exercises (
  id, program_id, exercise_id, order_index, sets, reps,
  rm_percentage, fallback_weight_kg, rest_seconds
)
overriding system value
select id + 80, 900009, exercise_id, order_index, sets, reps, rm_percentage,
       case when order_index = 3 then coalesce(fallback_weight_kg, 0) + 5 else fallback_weight_kg end,
       rest_seconds
from public.program_exercises
where program_id = 900001
on conflict (id) do nothing;

-- Each client joins one class, and every third client joins a second.
insert into public.class_members (class_id, client_id, added_by, added_at)
select 900001 + (n % 8), 900000 + n, '00000000-0000-0000-0000-000000000900',
       now() - interval '90 days'
from generate_series(1, 40) as n
on conflict do nothing;

insert into public.class_members (class_id, client_id, added_by, added_at)
select 900001 + ((n + 3) % 8), 900000 + n, '00000000-0000-0000-0000-000000000900',
       now() - interval '90 days'
from generate_series(3, 39, 3) as n
on conflict do nothing;

insert into public.class_members (class_id, client_id, added_by, added_at)
select 900009, 900000 + n, '00000000-0000-0000-0000-000000000900',
       now() - interval '90 days'
from generate_series(2, 40, 6) as n
on conflict do nothing;

-- Classes have run for 120 days, so the converted assignments start then.
update public.classes set created_at = now() - interval '120 days'
where id between 900001 and 900009
  and not exists (select 1 from public.class_program_assignments a where a.class_id = classes.id);

-- Test Client 01 did 30 days of Thursday Chronic Disease before moving to their current class.
insert into public.enrolments (class_id, client_id, start_date, end_date, opened_by, closed_by)
select 900004, 900001, public.practice_today() - 120, public.practice_today() - 91,
       '00000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000900'
where not exists (
  select 1 from public.enrolments where client_id = 900001 and class_id = 900004
);

-- Convert the per-class programs into the library, exactly as the migration did.
select private.convert_legacy_programs();

-- Next term for Tuesday Cardiac Rehab: a copy of its program, queued four weeks out.
do $$
declare
  v_program bigint;
begin
  if not exists (
    select 1 from public.class_program_assignments
    where class_id = 900002 and start_date > public.practice_today()
  ) then
    v_program := public.duplicate_program(
      (select program_id from public.class_program_assignments
       where class_id = 900002 order by start_date limit 1),
      'Cardiac Rehab - Term 2'
    );
    update public.class_program_assignments
    set end_date = public.practice_today() + 27
    where class_id = 900002 and end_date is null;
    perform public.assign_program(900002, v_program, public.practice_today() + 28);
  end if;
end;
$$;

-- Five active overrides. The first two are past their review date.
insert into public.weight_overrides
  (id, client_id, exercise_id, override_weight_kg, note, review_date, set_by)
overriding system value
select
  900000 + o.n,
  o.client_id,
  o.exercise_id,
  10 + o.n * 2.5,
  (array[
    'Trap bar instead',
    'Box squat to 45 cm',
    'Seated instead of standing',
    'Single arm only',
    null
  ])[o.n],
  case when o.n <= 2 then current_date - 7
       when o.n = 3 then current_date + 30 end,
  '00000000-0000-0000-0000-000000000900'
from (
  select row_number() over (order by m.client_id) as n, m.client_id, min(pe.exercise_id) as exercise_id
  from public.class_members m
  join public.programs p on p.class_id = m.class_id
  join public.program_exercises pe on pe.program_id = p.id
  where m.client_id between 900001 and 900040
  group by m.client_id
  order by m.client_id
  limit 5
) as o
on conflict do nothing;


-- Supersets: Monday AM Strength and Thursday Chronic Disease pair their 2nd and 3rd
-- exercises. Monday's program is shared with Thursday PM Strength, whose 3rd row is
-- customised, so that class keeps the row as it is and gets no superset there.
do $$
declare
  v_program bigint;
  v_class bigint;
begin
  foreach v_class in array array[900001, 900004]::bigint[] loop
  select program_id into v_program
  from public.class_program_assignments where class_id = v_class order by start_date limit 1;

  if not exists (
    select 1 from public.program_version_items i
    join public.library_programs p on p.current_version_id = i.version_id
    where p.id = v_program and i.superset_group is not null
  ) then
    perform public.save_program_version(v_program, null, (
      select jsonb_agg(
        to_jsonb(i) - array['id', 'version_id', 'position', 'created_at', 'superset_group']
          || jsonb_build_object('superset_group', case when i.position in (2, 3) then 1 end)
        order by i.position)
      from public.program_version_items i
      join public.library_programs p on p.current_version_id = i.version_id
      where p.id = v_program));
  end if;
  end loop;
end;
$$;


-- A dormant override: Test Client 01 has one for an exercise none of their current programs
-- use. It's kept, not shown in sessions, and applies again if the exercise returns.
insert into public.weight_overrides
  (id, client_id, exercise_id, override_weight_kg, note, set_by)
overriding system value
select 900006, 900001, e.id, 15, 'Machine instead of free weight',
       '00000000-0000-0000-0000-000000000900'
from public.exercises e
where e.id between 900001 and 900020
  and not exists (
    select 1
    from public.class_members m
    join public.class_program_assignments a
      on a.class_id = m.class_id
     and public.practice_today() between a.start_date and coalesce(a.end_date, 'infinity'::date)
    join public.class_program_items i
      on i.assignment_id = a.id and not i.is_removed and i.exercise_id = e.id
    where m.client_id = 900001
  )
order by e.id
limit 1
on conflict do nothing;


-- RM testing sessions: most clients have 3 to 5 sessions about four weeks apart, so trend
-- graphs show for several exercises. Each session tests most of the client's loaded
-- exercises, with results improving a little each time.
insert into public.rm_testing_sessions (id, client_id, test_date, conducted_by, notes)
overriding system value
select 900000 + n * 10 + j, 900000 + n,
       public.practice_today() - 28 * (3 + n % 3 - j) - (n % 5),
       '00000000-0000-0000-0000-000000000900',
       case when j = 1 then 'Baseline testing' end
from generate_series(1, 40) as n
cross join lateral generate_series(1, 3 + n % 3) as j
where n % 7 <> 0
order by n, j
on conflict (id) do nothing;

insert into public.rm_results (id, session_id, exercise_id, reps, weight_kg, recorded_by)
overriding system value
select s.id * 100 + (x.exercise_id - 900000), s.id, x.exercise_id,
       (array[1, 3, 5])[1 + (s.client_id + x.exercise_id + s.session_no) % 3],
       round(
         (20 + ((s.client_id * 7 + x.exercise_id * 3) % 16) * 5)
         * (0.85 + 0.05 * s.session_no)
         / 2.5) * 2.5,
       '00000000-0000-0000-0000-000000000900'
from public.rm_testing_sessions s
cross join lateral (
  select distinct i.exercise_id
  from public.class_members m
  join public.class_program_assignments a
    on a.class_id = m.class_id
   and public.practice_today() between a.start_date and coalesce(a.end_date, 'infinity'::date)
  join public.class_program_items i
    on i.assignment_id = a.id and not i.is_removed and i.rm_percentage is not null
  where m.client_id = s.client_id
) x
where s.id between 900000 and 900999
  and (s.client_id * 7 + x.exercise_id * 13 + s.session_no) % 10 < 8
on conflict (id) do nothing;

-- One result was entered in error, voided, and recorded again in the same session.
insert into public.rm_results
  (id, session_id, exercise_id, reps, weight_kg, recorded_by, voided_at, voided_reason)
overriding system value
select r.id + 90000000, r.session_id, r.exercise_id, r.reps, r.weight_kg * 2,
       r.recorded_by, now(), 'Typed the wrong weight'
from public.rm_results r
where r.id = (select min(id) from public.rm_results where session_id = 900013)
on conflict (id) do nothing;


-- Locked session records for each class's last two sessions before today. They're taken
-- with today's data, so they're illustrative only.
select private.snapshot_session(c.id, d.session_date, 'seed')
from public.classes c
cross join lateral (
  select public.practice_today() - ((extract(dow from public.practice_today())::int - c.day_of_week + 7) % 7)
         - case when (extract(dow from public.practice_today())::int - c.day_of_week + 7) % 7 = 0 then 7 else 0 end
         - 7 * w as session_date
  from generate_series(0, 1) as w
) d
where c.id between 900001 and 900009;

select private.lock_sessions(public.practice_today() - 1);

commit;
