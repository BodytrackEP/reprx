-- Makes a client's memberships match the list, atomically: if a target class is full,
-- nothing changes. Clients keep their tests and overrides, which aren't class-scoped.
create function public.set_client_classes(
  p_client_id bigint,
  p_class_ids bigint[],
  p_allow_over_capacity boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_class_id bigint;
begin
  delete from public.class_members
  where client_id = p_client_id and class_id <> all (p_class_ids);

  foreach v_class_id in array p_class_ids loop
    perform public.add_class_members(v_class_id, array[p_client_id], p_allow_over_capacity);
  end loop;
end;
$$;

revoke all on function public.set_client_classes(bigint, bigint[], boolean) from public, anon;
grant execute on function public.set_client_classes(bigint, bigint[], boolean) to authenticated;
