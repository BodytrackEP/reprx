-- Default-deny: drop everything the platform granted, then add back exactly what each
-- role needs. is_staff() and is_admin() both require an AAL2 session, so every policy
-- below enforces MFA. Wrapping them in a subselect evaluates them once per statement.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- staff: created by the invite flow with the secret key; admins change role and status.
grant select on public.staff to authenticated;
grant update (display_name, role, is_active) on public.staff to authenticated;

create policy staff_select on public.staff for select to authenticated
  using ((select public.is_staff()));
create policy staff_update on public.staff for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- clients: no DELETE (soft delete, or purge). Cliniko link fields and auth_user_id are
-- not writable directly, and Phase 2 sets them through a function.
grant select on public.clients to authenticated;
grant insert (first_name, last_name, preferred_name, is_test) on public.clients to authenticated;
grant update (first_name, last_name, preferred_name, is_active, deleted_at) on public.clients to authenticated;

create policy clients_select on public.clients for select to authenticated
  using ((select public.is_staff()));
create policy clients_insert on public.clients for insert to authenticated
  with check ((select public.is_staff()));
create policy clients_update on public.clients for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- class_categories: read by staff, managed by admins.
grant select, insert, update on public.class_categories to authenticated;

create policy class_categories_select on public.class_categories for select to authenticated
  using ((select public.is_staff()));
create policy class_categories_insert on public.class_categories for insert to authenticated
  with check ((select public.is_admin()));
create policy class_categories_update on public.class_categories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- classes: deactivated, never deleted.
grant select, insert, update on public.classes to authenticated;

create policy classes_select on public.classes for select to authenticated
  using ((select public.is_staff()));
create policy classes_insert on public.classes for insert to authenticated
  with check ((select public.is_staff()));
create policy classes_update on public.classes for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- class_members
grant select, insert, delete on public.class_members to authenticated;

create policy class_members_select on public.class_members for select to authenticated
  using ((select public.is_staff()));
create policy class_members_insert on public.class_members for insert to authenticated
  with check ((select public.is_staff()) and added_by = (select auth.uid()));
create policy class_members_delete on public.class_members for delete to authenticated
  using ((select public.is_staff()));

-- exercises: DELETE is allowed, and the foreign keys refuse it once referenced.
grant select, insert, update, delete on public.exercises to authenticated;

create policy exercises_select on public.exercises for select to authenticated
  using ((select public.is_staff()));
create policy exercises_insert on public.exercises for insert to authenticated
  with check ((select public.is_staff()));
create policy exercises_update on public.exercises for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
create policy exercises_delete on public.exercises for delete to authenticated
  using ((select public.is_staff()));

-- programs
grant select, insert, update, delete on public.programs to authenticated;

create policy programs_select on public.programs for select to authenticated
  using ((select public.is_staff()));
create policy programs_insert on public.programs for insert to authenticated
  with check ((select public.is_staff()));
create policy programs_update on public.programs for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
create policy programs_delete on public.programs for delete to authenticated
  using ((select public.is_staff()));

-- program_exercises
grant select, insert, update, delete on public.program_exercises to authenticated;

create policy program_exercises_select on public.program_exercises for select to authenticated
  using ((select public.is_staff()));
create policy program_exercises_insert on public.program_exercises for insert to authenticated
  with check ((select public.is_staff()));
create policy program_exercises_update on public.program_exercises for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
create policy program_exercises_delete on public.program_exercises for delete to authenticated
  using ((select public.is_staff()));

-- rm_tests: append-only. Voiding is the one UPDATE, held to that by guard_rm_test_update().
grant select, insert, update on public.rm_tests to authenticated;

create policy rm_tests_select on public.rm_tests for select to authenticated
  using ((select public.is_staff()));
create policy rm_tests_insert on public.rm_tests for insert to authenticated
  with check ((select public.is_staff()) and recorded_by = (select auth.uid()));
create policy rm_tests_update on public.rm_tests for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- weight_overrides: history is kept. No DELETE.
grant select, insert, update on public.weight_overrides to authenticated;

create policy weight_overrides_select on public.weight_overrides for select to authenticated
  using ((select public.is_staff()));
create policy weight_overrides_insert on public.weight_overrides for insert to authenticated
  with check ((select public.is_staff()) and set_by = (select auth.uid()));
create policy weight_overrides_update on public.weight_overrides for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- app_settings: read by staff, changed by admins. environment is deliberately not
-- updatable here, so nobody can relabel prod as test through the API.
grant select on public.app_settings to authenticated;
grant update (
  staff_session_timeout_hours,
  client_session_timeout_days,
  soft_delete_restore_days,
  retention_years_after_last_activity,
  rounding_increment_kg,
  rm_warn_above_reps
) on public.app_settings to authenticated;

create policy app_settings_select on public.app_settings for select to authenticated
  using ((select public.is_staff()));
create policy app_settings_update on public.app_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- audit_log: admins read; nobody writes except the definer trigger.
revoke all on public.audit_log from service_role;
grant select on public.audit_log to authenticated;

create policy audit_log_select on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- View and functions.
grant select on public.effective_weights_v to authenticated;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.round_to_increment(numeric, numeric) to authenticated;
grant execute on function public.effective_weights(bigint) to authenticated;
grant execute on function public.effective_weights_for_client(bigint) to authenticated;
grant execute on function public.reorder_program_exercises(bigint, bigint[]) to authenticated;
grant execute on function public.set_override(bigint, bigint, numeric, text, date) to authenticated;
grant execute on function public.end_override(bigint) to authenticated;
grant execute on function public.add_class_members(bigint, bigint[], boolean) to authenticated;
grant execute on function public.move_clients(bigint[], bigint, bigint, boolean) to authenticated;
grant execute on function public.move_client(bigint, bigint, bigint, boolean) to authenticated;
