-- Links created for an admin to send by hand leave no trace in Supabase's own email
-- records, so each one is recorded here. The link itself is never stored.
create function public.record_invite_link(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can create an invite link.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.staff s where s.id = p_staff_id and s.is_active) then
    raise exception 'That staff member wasn''t found.' using errcode = 'RX007';
  end if;

  insert into public.audit_log (actor, actor_label, table_name, row_pk, action, new_row)
  values (
    auth.uid(),
    'invite:link',
    'staff',
    p_staff_id::text,
    'UPDATE',
    jsonb_build_object('event', 'invite_link_created')
  );
end;
$$;

revoke all on function public.record_invite_link(uuid) from public, anon;
grant execute on function public.record_invite_link(uuid) to authenticated;
