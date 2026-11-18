-- Client order and CSV import (owner requests, Nov 2026).

-- Client order: a per-class display order for the session grid, take-home sheets and print.
-- New members have no position and sort after the ordered ones, by name.
alter table public.class_members add column position int check (position > 0);

grant update (position) on public.class_members to authenticated;
create policy class_members_update on public.class_members for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Sets the order for every current member at once. The list must be exactly the members.
create function public.set_member_order(p_class_id bigint, p_client_ids bigint[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(p_client_ids) <> (select count(distinct c) from unnest(p_client_ids) as c)
     or (select count(*) from public.class_members where class_id = p_class_id)
        <> cardinality(p_client_ids)
     or exists (
       select 1 from unnest(p_client_ids) as c
       where not exists (
         select 1 from public.class_members m where m.class_id = p_class_id and m.client_id = c
       )
     ) then
    raise exception 'The class''s members changed. Reload the page and try again.'
      using errcode = 'RX002';
  end if;

  update public.class_members m
  set position = array_position(p_client_ids, m.client_id)
  where m.class_id = p_class_id
    and m.position is distinct from array_position(p_client_ids, m.client_id);
end;
$$;

revoke all on function public.set_member_order(bigint, bigint[]) from public, anon;
grant execute on function public.set_member_order(bigint, bigint[]) to authenticated;

-- CSV import, all or nothing. Names only (§3). The app parses and previews the file, and
-- sends:
--   p_new:      [{first_name, last_name, preferred_name, class_ids: [..]}] to create
--   p_existing: [{client_id, class_ids: [..]}] existing clients to add to classes
-- New clients take is_test from the environment, as in the client form (D2). Capacity is
-- enforced by the class_members trigger, so an over-full class fails the whole import.
-- Each new client and membership is audited by the usual row trigger.
create function public.import_clients(p_new jsonb, p_existing jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_environment text;
  v_created int := 0;
  v_memberships int := 0;
  v_added int;
  v_id bigint;
  r jsonb;
begin
  select environment into v_environment from public.app_settings;
  if v_environment is null or v_environment = 'unset' then
    raise exception 'This environment hasn''t been configured yet. Ask an admin.'
      using errcode = 'RX012';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_new, '[]')) loop
    insert into public.clients (first_name, last_name, preferred_name, is_test)
    values (trim(r ->> 'first_name'), trim(r ->> 'last_name'),
            nullif(trim(r ->> 'preferred_name'), ''), v_environment <> 'prod')
    returning id into v_id;
    v_created := v_created + 1;

    insert into public.class_members (class_id, client_id)
    select distinct c::bigint, v_id
    from jsonb_array_elements_text(coalesce(r -> 'class_ids', '[]')) as c;
    get diagnostics v_added = row_count;
    v_memberships := v_memberships + v_added;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_existing, '[]')) loop
    insert into public.class_members (class_id, client_id)
    select distinct c::bigint, (r ->> 'client_id')::bigint
    from jsonb_array_elements_text(coalesce(r -> 'class_ids', '[]')) as c
    where not exists (
      select 1 from public.class_members m
      where m.class_id = c::bigint and m.client_id = (r ->> 'client_id')::bigint
    );
    get diagnostics v_added = row_count;
    v_memberships := v_memberships + v_added;
  end loop;

  return jsonb_build_object('created', v_created, 'memberships', v_memberships);
end;
$$;

revoke all on function public.import_clients(jsonb, jsonb) from public, anon;
grant execute on function public.import_clients(jsonb, jsonb) to authenticated;
