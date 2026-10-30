-- Runs before seed.sql, and only through the Supabase CLI's seed path (local `db reset`).
-- It can only move a fresh database out of 'unset', so it can't relabel test or prod.
update public.app_settings set environment = 'local' where environment = 'unset';
