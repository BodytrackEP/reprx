-- The flag is only honoured for admins: see enforce_class_capacity().
create function public.add_class_members(
  p_class_id bigint,
  p_client_ids bigint[],
  p_allow_over_capacity boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_allow_over_capacity then
    perform set_config('reprx.allow_over_capacity', 'on', true);
  end if;

  insert into public.class_members (class_id, client_id)
  select p_class_id, c
  from unnest(p_client_ids) as c
  where not exists (
    select 1 from public.class_members m
    where m.class_id = p_class_id and m.client_id = c
  );
end;
$$;

-- Atomic: a capacity failure on the target leaves the client in the source class.
create function public.move_clients(
  p_client_ids bigint[],
  p_from_class bigint,
  p_to_class bigint,
  p_allow_over_capacity boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_moved int;
begin
  if p_from_class = p_to_class then
    raise exception 'Choose a different class to move to.' using errcode = 'RX006';
  end if;

  delete from public.class_members
  where class_id = p_from_class and client_id = any (p_client_ids);

  get diagnostics v_moved = row_count;

  if v_moved <> cardinality(p_client_ids) then
    raise exception 'Every client being moved must be a member of the class.'
      using errcode = 'RX006';
  end if;

  perform public.add_class_members(p_to_class, p_client_ids, p_allow_over_capacity);
end;
$$;

create function public.move_client(
  p_client_id bigint,
  p_from_class bigint,
  p_to_class bigint,
  p_allow_over_capacity boolean default false
)
returns void
language sql
set search_path = ''
as $$
  select public.move_clients(array[p_client_id], p_from_class, p_to_class, p_allow_over_capacity);
$$;
