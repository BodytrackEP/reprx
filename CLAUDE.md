# RepRx

Staff web app for an Australian EP practice: calculates each client's working weight per exercise from class programs, RM tests and overrides. The full specification is [docs/BUILD_PROMPT.md](docs/BUILD_PROMPT.md). See also [AGENTS.md](AGENTS.md): read `node_modules/next/dist/docs/` before relying on remembered Next.js APIs.

## Stack

Next.js 16 (App Router, RSC, Server Actions), TypeScript strict, Tailwind 4, Supabase Postgres + Auth (Sydney), Vercel (syd1), Zod, Vitest, pgTAP, Playwright. Package manager: pnpm.

## Commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` |
| Unit tests | `pnpm test` |
| End-to-end tests | `pnpm e2e` |
| Start local Supabase (Docker) | `pnpm exec supabase start` |
| Apply migrations + seed locally | `pnpm db:reset` |
| Database tests (pgTAP) | `pnpm db:test` |
| Regenerate TS types | `pnpm db:types` |
| Seed hosted test project | `pnpm seed:test` |
| Check browser bundle for secrets | `pnpm build && pnpm check:bundle` |

## Environment variables

See [.env.example](.env.example). `SUPABASE_SECRET_KEY` is server-only: import it only through `lib/supabase/admin.ts`, and mark it **Sensitive** in Vercel.

Local setup: `pnpm exec supabase start`, then `pnpm env:local` writes `.env.local` from the running stack.

## Hosted Supabase project settings

Set these by hand in each hosted project (`config.toml` only covers local):

- **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up", and leave the **Email provider enabled**. Turning off "signups" inside the email provider disables all password login.
- **Minimum password length:** 12. Enable leaked-password protection if the plan offers it; if not, record that here.
- **MFA:** TOTP enabled.
- **URL Configuration:** Site URL = the deployment URL, with `<site>/**` in the redirect list.
- **Email Templates → Invite user:** paste [supabase/templates/invite.html](supabase/templates/invite.html). The default template won't work, because the server can't read tokens from a URL fragment.
- **Environment:** run once in the SQL editor: `update public.app_settings set environment = 'test';` (or `'prod'`). Every database starts as `unset`, which the seed refuses.

## First admin (run once per project)

Public sign-up is off, so the first admin is created by hand:

1. Authentication → Users → **Add user**, with an email and a password of 12+ characters, and tick auto-confirm.
2. In the SQL editor, using that email:

```sql
insert into public.staff (id, display_name, role)
select id, 'Your Name', 'admin' from auth.users where email = 'you@example.com';
```

3. Sign in. TOTP enrolment runs on first login. Invite everyone else from `/admin/staff`.

## Conventions

- **Migration-first.** Every schema change is a new file in `supabase/migrations/`, then `pnpm db:types`. Never edit the schema through the dashboard.
- **Rules live in Postgres** where it can enforce them. `lib/calc.ts` is only a preview mirror.
- **Name-only (§3).** Never add client DOB, contact, medical or referral fields, or a `jsonb` catch-all on `clients`. Never log Cliniko response bodies.
- **Commit at each milestone.** Never commit secrets or real client data.
- Zod validates input at every Server Action.

## Hosting plans (verify current pricing)

- Vercel **Hobby is non-commercial only**: the practice's production app needs **Pro**.
- Supabase **Free** pauses inactive projects and has no point-in-time recovery. It's fine for `test`; `prod` needs **Pro** for backups and session-timeout controls.

## Decisions log

| Date | Decision |
|---|---|
| 2026-10-31 | "Phase 0" is undefined in the spec: treated as environment setup plus the Phase 1 plan. |
| 2026-10-31 | Next 16 renamed middleware to `proxy.ts`; the spec's "middleware" means this file. |
| 2026-10-31 | Supabase publishable/secret keys are used, not the legacy anon/service_role keys. |
| 2026-10-31 | `cacheComponents` and `partialPrefetching` are off: all pages are per-user health data, and §3 forbids caches. |
| 2026-10-31 | The strict CSP is set in `proxy.ts` (per-request nonce); other security headers are in `next.config.ts`. |
| 2026-10-31 | Purge writes one summary audit row; the per-row trigger is bypassed only inside `purge_test_data()` (owner decision). |
| 2026-10-31 | Seeded rows are attributed to an inactive `seed@reprx.invalid` staff account; `recorded_by`/`set_by` stay NOT NULL (owner decision). |
| 2026-10-31 | Seed guard is an allowlist: runs only when `app_settings.environment` is `local` or `test`. Every database starts as `unset` (corrects the plan, where a migration setting `local` would also have run on prod); only `seed-env-local.sql` moves it to `local`, and hosted projects set it once by hand. API roles cannot change it. |
| 2026-10-31 | The purge audit bypass is a row in `private.purge_context`, not a GUC: no API role can write it, so a caller can't switch auditing off. |
| 2026-10-31 | `reprx.allow_over_capacity` is honoured only for admins, and is set through a function parameter (`p_allow_over_capacity`). |
| 2026-10-31 | Extra NOT NULLs where the spec is silent: `sets`, `reps`, `day_of_week`, `start_time`, `end_time`, `category_code`, and the staff attribution columns. |
| 2026-10-31 | Staff attribution (`added_by`, `recorded_by`, `set_by`) must equal `auth.uid()` on insert, enforced by RLS. |
| 2026-10-31 | `effective_weights*` read a `security_invoker` view, so RLS applies. Soft-deleted clients are excluded and don't count towards capacity. `effective_weights_for_client` also returns `class_id`. |
| 2026-10-31 | `move_client` has an optional fourth parameter for the capacity override; `move_clients` is the bulk form. |
| 2026-10-31 | No browser Supabase client: all auth and data calls run on the server, so session cookies are `httpOnly` and the CSP's `connect-src` is `'self'`. |
| 2026-10-31 | Staff rows are inserted through the admin's own session, not the secret key, so the audit log records who sent an invite. |
| 2026-10-31 | The session timeout is absolute, measured from the last password/TOTP in the JWT `amr` claim, and enforced in `proxy.ts`. Token refreshes don't extend it. |
| 2026-10-31 | Admins can't demote or deactivate themselves, which guarantees one active admin remains. |
| 2026-10-31 | Dev allows inline styles for Next's overlay. CI runs Playwright against the production build, because only that has the strict nonce CSP. |
| 2026-10-31 | New clients take `is_test` from `app_settings.environment`: true on local/test, false on prod, refused on `unset`. This enforces D2 and stops a misconfigured prod labelling real people as purgeable. |
| 2026-10-31 | Soft-deleted clients keep their memberships, so restoring returns them to their classes. |
| 2026-10-31 | `set_client_classes` replaces a client's memberships atomically, for the multi-select on the client page. |
| 2026-10-31 | Custom SQLSTATEs: RX001 capacity, RX002 reorder, RX003 RM test locked, RX004 override locked, RX005 audit immutable, RX006 invalid move. |
| 2026-10-31 | `rm_tests.estimated_1rm_kg` keeps the spec's expression. `lib/calc.ts` computes exactly, so it can differ by 0.01 kg on rare half-cent cases; the database value is authoritative. |
