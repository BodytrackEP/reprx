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
| 2026-10-31 | Seed guard is an allowlist: runs only when `app_settings.environment` is `local` or `test`. |
