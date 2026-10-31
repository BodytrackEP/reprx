-- Authenticators live in the auth schema, which the audit trigger doesn't cover, so resets
-- are recorded here. Runs before the factors are removed: if this fails, nothing is reset.
-- Definer, because API roles can neither write audit_log nor touch auth.sessions.
-- Ending the sessions stops refreshes; an access token already issued lasts until it expires.
create function public.record_authenticator_reset(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reset an authenticator.' using errcode = '42501';
  end if;

  if p_staff_id = auth.uid() then
    raise exception 'You can''t reset your own authenticator. Ask another admin.'
      using errcode = 'RX007';
  end if;

  if not exists (select 1 from public.staff s where s.id = p_staff_id) then
    raise exception 'That staff member wasn''t found.' using errcode = 'RX007';
  end if;

  delete from auth.sessions where user_id = p_staff_id;

  insert into public.audit_log (actor, actor_label, table_name, row_pk, action, new_row)
  values (
    auth.uid(),
    'mfa:reset',
    'staff',
    p_staff_id::text,
    'UPDATE',
    jsonb_build_object('event', 'authenticator_reset')
  );
end;
$$;

revoke all on function public.record_authenticator_reset(uuid) from public, anon;
grant execute on function public.record_authenticator_reset(uuid) to authenticated;
