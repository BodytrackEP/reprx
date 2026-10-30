-- Admins create the staff row through their own session, so the audit log records
-- who invited whom. The auth user itself is created with the secret key.
grant insert (id, display_name, role) on public.staff to authenticated;

create policy staff_insert on public.staff for insert to authenticated
  with check ((select public.is_admin()));
