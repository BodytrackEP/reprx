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

The full routine for building, testing, shipping and deploying (including hosted migrations, order of changes and rollback) is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Hosted Supabase project settings

Set these by hand in each hosted project (`config.toml` only covers local):

- **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up", and leave the **Email provider enabled**. Turning off "signups" inside the email provider disables all password login.
- **Minimum password length:** 12. Enable leaked-password protection if the plan offers it; if not, record that here.
- **MFA:** TOTP enabled.
- **URL Configuration:** Site URL = the deployment URL, with `<site>/**` in the redirect list.
- **Email Templates → Invite user:** paste [supabase/templates/invite.html](supabase/templates/invite.html). **Reset password:** paste [supabase/templates/recovery.html](supabase/templates/recovery.html). The default templates won't work, because the server can't read tokens from a URL fragment.
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

## Cut-over: before any real client is entered (§7, D2)

Real clients go only into prod, so this must happen first. **Stop and confirm with the owner before doing it.** The full step-by-step procedure (email domain, Supabase and Vercel settings, checks, and the two-site release routine) is in [docs/PRODUCTION_DEPLOY.md](docs/PRODUCTION_DEPLOY.md).

1. Create the prod Supabase project (**Sydney, `ap-southeast-2`**, Pro plan) and the Vercel production deployment. The region is chosen at creation, so check it before going further: `pnpm exec supabase projects list`. The existing test project is in Singapore and must never hold real clients.
2. Run migrations with `supabase db push`, **without the seed**.
3. Apply the hosted settings above, setting `environment = 'prod'`, then create the first admin.
4. Confirm a Preview deployment can't reach prod: its environment variables must point at `test`.
5. Complete the "before any real client" list in [docs/PRIVACY_CHECKLIST.md](docs/PRIVACY_CHECKLIST.md).

## Backups

Prod relies on Supabase Pro daily backups. Run a **quarterly restore drill**: restore into a scratch project, check row counts and sign in, then record the date and result here.

## Performance (§10)

Target: the session view for 15 members × 12 exercises renders in under 300 ms server time. Measured on 2026-10-31 on a local production build and local Supabase (Windows, Docker):

- `EXPLAIN ANALYZE` of `effective_weights` as an AAL2 EP under RLS, 180 rows: 3.3–4.7 ms execution, under 0.1 ms planning. The latest-test lookup uses `rm_tests_latest_idx`.
- Whole page: median 140 ms, worst warm 191 ms. The first two cold requests took 247 ms and 343 ms, so a cold function can exceed the target.

Re-measured on 2026-11-10 after the update (transposed grid, `effective_weights_at`, and the 180-row snapshot refresh that opening today's session now does): median 97 ms, worst warm 119 ms, first request 173 ms. Same local production build.

Re-measure on Vercel syd1 against hosted Supabase, which adds a network hop per query.

## Lost authenticator

An admin uses **Reset authenticator** on `/admin/staff`, after confirming who is asking. Anyone holding that person's password can then enrol a new authenticator, so verify in person or by phone. If the **only** admin loses theirs, use the Supabase dashboard (Authentication → Users → the user → remove the MFA factor). Keep at least two admins to avoid this.

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
| 2026-10-31 | Playwright runs serially, because `zz-purge.spec.ts` deletes every test client. Commit messages go through Git Bash, because Windows PowerShell 5.1 breaks double quotes passed to git. |
| 2026-10-31 | Phase 3 draft: clients and staff share the `authenticated` role, so column grants can't hide `override.reason`. Clients get no policy on `weight_overrides` and read through `my_overrides()`. |
| 2026-10-31 | Owner exception to D1 and §6.5, **test only**: the hosted test project is in Singapore (`ap-southeast-1`). It holds fake clients only, plus staff accounts. D1 still binds prod, which must be in Sydney. Session view timings against this project include Vercel syd1 to Singapore latency, so they don't represent prod. |
| 2026-10-31 | Forgot password (added at the owner's request, not in the spec): a reset link never bypasses TOTP, since it proves only mailbox access. The reply doesn't reveal whether an account exists, and other sessions are signed out afterwards. |
| 2026-10-31 | `/auth/confirm` spends the one-time token on a button press, not on page load, because email scanners open links automatically. This covers invites and resets. |
| 2026-10-31 | Authenticator reset (added at the owner's request): `record_authenticator_reset` audits and ends sessions first, then the admin API deletes the factors. Admins can't reset their own. An access token already issued lasts until it expires (up to 1 hour). |
| 2026-10-31 | Invite links (added at the owner's request): admins can create a one-time invite link to send by hand, for a pending staff member or a new one, so staff access doesn't depend on email. Each is audited through `record_invite_link`; the link is shown once and never stored. |
| 2026-11-10 | Update spec (Nov 2026) is [docs/UPDATE_2026-11.md](docs/UPDATE_2026-11.md). Phases run 1, 2, 3, 4, 6, 5: snapshots store the RM result used, so RM testing sessions come first. Owner decisions: all staff edit programs and class copies; only admins edit locked snapshots; the override note replaces the reason and the review date stays; SVG chart with no library, `@dnd-kit` for dragging; migrated history starts on each class's creation date. |
| 2026-11-10 | Program library: `library_programs` → immutable `program_versions`/`program_version_items` → `class_program_assignments` (exclusion constraint, no overlap per class) → `class_program_items`, one copy per assignment. Rows match across versions by `item_key`. `save_program_version` pushes to current and queued assignments; customised rows are kept and placed after the row they followed. Removed library rows stay as `is_removed` so a push doesn't restore them. |
| 2026-11-10 | The old `programs`/`program_exercises` tables are read-only and unused, kept until the owner confirms the final cleanup. The seed still writes them and calls `private.convert_legacy_programs()`, so every reset exercises the migration path. |
| 2026-11-10 | `program_versions.created_by` and `class_program_assignments.created_by` are nullable: null means the one-off migration. |
| 2026-11-10 | Supersets: `superset_group` on version and class items. A library version must be valid (2+ adjacent rows, RX010). Class copies are normalised after every push and edit instead, so a removed or customised row can't break a group: singletons are ungrouped and split groups become separate ones. A superset change in the library doesn't reach a class's customised row, so a group can dissolve in that class. Only a dragged row becomes customised; rows it passes just shift. Print keeps colour blocks with `print-color-adjust: exact`. |
| 2026-11-10 | Enrolments: `class_members` stays the record of current membership, so capacity, moves and RLS are unchanged. Definer triggers open an enrolment on insert (from `added_at`, Brisbane date) and close it on delete (today), so a move closes one and opens another. No API role can write enrolments. `program_history_v` intersects enrolment periods with assignments and splits them at each version push (the last push of a day wins), so history names the version in effect. |
| 2026-11-10 | Override notes: optional `weight_overrides.note` (1–200 chars, exercise changes only) replaces the required reason; existing reasons were copied into notes. `reason` is nullable and unused until the final cleanup. With a note, the cell shows the weight and the full note in place of "Override"; without one, only the amber weight. Dormant overrides are derived in `client_overrides_v` (no current program has the exercise), never deleted, and apply again when the exercise returns. |
| 2026-11-10 | RM testing sessions: `rm_testing_sessions` (numbered per client by trigger, under a client-row lock) hold `rm_results` with the same Epley column. One non-voided result per exercise per session (partial unique index); voiding is per result and frees the exercise. Weights use the latest valid result by test date then session number; trends are least-squares in `lib/trend.ts`, from 3 sessions, drawn as plain SVG. The owner confirmed wiping the old `rm_tests` (213 fake rows on hosted test); the wipe is one `rm:wipe` audit row and the empty table stays until the final cleanup. |
| 2026-11-10 | Session snapshots: `session_occurrences` (class + date) and `session_snapshot_rows` (one per enrolled client per exercise, with sets/reps/%, weights, override note, program version and RM result used). Staff opening today's session call `snapshot_today`; `pg_cron` snapshots started sessions every 5 minutes and, at 00:05 Brisbane (14:05 UTC), creates any missing snapshots for the previous day and locks it. Refreshes are audited as one summary row each; admin corrections of locked rows go through `edit_snapshot_row` and are audited per row with old and new values. Past dates use enrolments; today and later use current membership. Vercel Cron wasn't used: Hobby runs at most daily. |
| 2026-11-10 | Session grid is transposed: exercises down the left, clients across the top (`abbreviateNames`: first name + enough surname to be unique, full name in the tooltip). Supersets are coloured row groups. Print uses the same layout. An empty class shows no grid. |
| 2026-11-17 | Exercise colours (owner request): an optional `colour` per program row from a fixed 7-colour palette (`lib/colours.ts`, checked in the database), set in the library builder or on a class copy. It's part of a version and follows the push rule; a class-copy colour change marks the row customised. It fills the exercise cell (first column) of the session grid, overriding the superset fill there, and snapshots keep it. |
| 2026-11-17 | Sets, reps and % can be changed from a live session view (owner request); this edits the class copy (marked customised), never the library. |
| 2026-11-17 | Take-home sheets (owner request): `/admin/sessions/[classId]/take-home` prints one portrait A4 page per client (named `@page take-home`) with the colour-coded program, sets × reps (no % 1RM) and that client's weights and override notes, from the same data as the session view. Saved as PDF from the browser's print window; nothing is stored. |
| 2026-11-19 | Client order (owner request): `class_members.position`, set for all current members at once by `set_member_order` from the session view's **Client order** dialog. It's per class, so every session, print and take-home sheet uses it; members without a position (new joiners, or past members on an old record) follow by name. Staff may update only that column. |
| 2026-11-19 | CSV client import (owner request): `/admin/clients/import` reads First/Last/Preferred name and an optional Class (semicolons for several), ignores every other column (§3) and shows a preview. The server rebuilds the plan from the file text on confirm; `import_clients` applies it in one transaction, so an over-full class (RX001) imports nothing. A name matching exactly one existing client adds that client to classes instead of duplicating; two or more matches are skipped. New clients take `is_test` from the environment (D2), refused on `unset` (RX012). Each row is audited by the usual trigger. |
| 2026-10-31 | Custom SQLSTATEs: RX001 capacity, RX002 reorder, RX003 RM test locked, RX004 override locked, RX005 audit immutable, RX006 invalid move, RX007 invalid authenticator reset, RX008 program version or code locked, RX009 program rule (archived, wrong version, reset), RX010 invalid superset, RX011 locked session, RX012 environment not configured. |
| 2026-10-31 | `rm_tests.estimated_1rm_kg` keeps the spec's expression. `lib/calc.ts` computes exactly, so it can differ by 0.01 kg on rare half-cent cases; the database value is authoritative. |
