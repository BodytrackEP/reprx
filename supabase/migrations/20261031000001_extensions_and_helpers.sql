-- Shared trigger function and default privileges.
-- New objects must never be reachable by anon or PUBLIC without an explicit grant.

alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Internal state that no API role can read or write.
create schema private;
revoke all on schema private from public;
