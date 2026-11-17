# RepRx: development, shipping and deployment

How the development machine is set up, and the routine for building, testing and deploying a change. Last checked 2026-11-17, at 27 migrations.

## 1. What's installed

| Tool | Version | What it's for |
|---|---|---|
| Node.js | 26.13.0 | Runs the app and all the tooling |
| pnpm | 12.16.1 | Installs packages and runs project commands (`pnpm dev`, `pnpm test`, and so on) |
| Git | 2.56.0 | Version control, connected to GitHub |
| Docker Desktop (with WSL2) | 29.9.2 | Runs a complete local copy of Supabase |
| Supabase CLI | 2.122.0 | Installed inside the project, so you run it as `pnpm exec supabase …` |
| Next.js | 16.4.3 | The web framework |
| Playwright + Chromium | 1.64.1 | Browser tests, using the Chromium build in `%LOCALAPPDATA%\ms-playwright` |

**Project folder:** `C:\temp\Harth`

**Connections:**
- **GitHub:** `https://github.com/iainroberts1980-ui/reprx.git`, branch `main`. The sign-in is saved in Windows, so pushes go through without a prompt.
- **Supabase CLI:** signed in and linked to the hosted **test** project `hjmwswejuklkjexbrudw`, which is in Singapore (an owner exception for test only; see the decisions log in [CLAUDE.md](../CLAUDE.md)).
- **Vercel:** no connection from the machine. Vercel watches the GitHub repo instead.

**Local settings file:** `.env.local`. It holds five values that point the app at the **local** Supabase: the URL, publishable key, secret key, database URL and Mailpit URL. It's excluded from Git, and `pnpm env:local` regenerates it at any time.

**New machine:** install Node.js, pnpm, Git and Docker Desktop with WSL2. Clone the repo, run `pnpm install`, then follow section 3. To work with the hosted project, also run `pnpm exec supabase login` and `pnpm exec supabase link --project-ref hjmwswejuklkjexbrudw`.

## 2. How the pieces connect

```text
 Development machine                  Cloud
 ─────────────────────────            ─────────────────────────────────────
 Code in C:\temp\Harth  ──git push──▶ GitHub (main) ──▶ GitHub Actions CI
                                           │
                                           └──▶ Vercel builds and deploys
                                                  https://reprx-iainroberts1980-ui.vercel.app
                                                  (functions in syd1)
                                                          │ reads and writes
 Local Supabase in Docker                                 ▼
 (for development and tests)   ──db push──▶  Hosted Supabase "test"
                                              hjmwswejuklkjexbrudw (Singapore)
                                              + pg_cron jobs + Mailgun SMTP
```

The rules that matter:
- **Code** reaches the live site by pushing to GitHub. Vercel deploys automatically.
- **Database changes** never go through GitHub or Vercel. They're applied separately with `supabase db push` (section 7).
- **Local** Supabase is disposable and gets reset all the time. The **hosted** project is only changed through migrations.

## 3. Starting work

Run these in a terminal in `C:\temp\Harth`:

```powershell
# 1. Make sure Docker Desktop is running (whale icon in the system tray).

# 2. Start local Supabase. The first run takes a minute.
pnpm exec supabase start

# 3. Only after a fresh start, or if .env.local is missing:
pnpm env:local

# 4. Start the app.
pnpm dev
```

Then open **http://localhost:3000**.

Local Supabase also runs these:

| URL | What it is |
|---|---|
| http://127.0.0.1:54323 | **Studio**, the local database browser |
| http://127.0.0.1:54324 | **Mailpit**: every email the local app sends, such as invites and resets, lands here, never in a real inbox |
| `127.0.0.1:54322` | Postgres itself |

**Local sign-in:** the seed creates fake clients and classes but no staff you can sign in as. The browser tests create their own. To create a local admin by hand, follow "First admin" in [CLAUDE.md](../CLAUDE.md) using Studio. Local email goes to Mailpit, so password resets work locally too.

**To stop:** press Ctrl+C on `pnpm dev`. `pnpm exec supabase stop` shuts down the Docker containers; you can leave them running.

## 4. Making a change

### Code-only changes (pages, wording, behaviour)
1. Edit the files.
2. Check it in the browser at `localhost:3000`.
3. Run the checks in section 5.

### Database changes (new table, column, rule or function)
**Never change the hosted database through the Supabase dashboard.** Every schema change is a new migration file.

1. **Create the migration:** add a file such as `supabase/migrations/20261112000027_what_it_does.sql`. The number must be higher than the last one in `supabase/migrations/`.
2. **Apply it locally:** `pnpm db:reset`. This wipes the local database, replays every migration, then loads the seed.
3. **Regenerate the TypeScript types:** `pnpm db:types`, which updates `lib/database.types.ts`.
4. **Add or adjust database tests** in `supabase/tests/`, then run `pnpm db:test`.
5. **Update the seed** (`supabase/seed.sql`) if the feature needs fake data to demonstrate it. The seed must stay safe to run twice.

**Once a migration is on the hosted project, never edit it.** Write a new migration that changes or undoes it.

**A migration that changes existing rows must be tested against existing rows.** A fresh `db reset` runs migrations on an empty database, so it can't catch, for example, a trigger blocking a backfill. That's how the Phase 4 migration first failed on the hosted project. To reproduce the hosted state, run `pnpm exec supabase db reset --version <previous migration> --no-seed`, insert representative rows, then run `pnpm exec supabase migration up --local`.

## 5. Testing before you ship

These are the same checks CI runs. From quickest to slowest:

| Command | What it checks | Time |
|---|---|---|
| `pnpm typecheck` | TypeScript types | ~10 s |
| `pnpm lint` | Code-quality rules | ~10 s |
| `pnpm test` | Unit tests: calculations, trend line, dates, name abbreviations | ~2 s |
| `pnpm db:test` | Database rules, access control, the push rule, snapshots. Needs local Supabase running | ~5 s |
| `$env:CI='1'; pnpm e2e; Remove-Item Env:CI` | Browser tests against a **production build**, which is the only build with the strict security policy | ~1.5 min |
| `pnpm build; pnpm check:bundle` | Confirms no secret key leaked into the browser code | ~1 min |

**What to know:**
- **Run `pnpm db:test` and `pnpm e2e` one after the other, not at the same time.** Running them together makes the browser tests slow and flaky.
- **The browser tests delete every test client at the end,** in `zz-purge.spec.ts`. Run `pnpm db:reset` afterwards to get the fake data back.
- **If the browser tests all fail with "fetch failed",** Docker's networking has stuck. Run `pnpm exec supabase stop`, then `pnpm exec supabase start`, then `pnpm env:local`.

## 6. Shipping: GitHub, then CI, then Vercel

```powershell
git status                     # check what's changed; never commit .env.local
git add -A
git commit -m "Short summary of the change"
git push origin main
```

**Commit messages:** Windows PowerShell breaks double quotes inside commit messages. Use single quotes, or a Git Bash window, for anything with quotation marks.

When you push:
1. **GitHub Actions** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs three jobs in parallel:
   - **app:** typecheck, lint, unit tests, production build and the secrets check;
   - **database:** local Supabase, pgTAP tests and a re-run of the seed;
   - **e2e:** the browser tests.

   The results are on the repo's **Actions** tab, and the same checks also run on pull requests.
2. **Vercel** builds and deploys `main` to production at the same time, usually within 2–3 minutes. **It doesn't wait for CI**, so a broken commit can go live before CI turns red. That's why running the checks locally first matters.

## 7. Deploying database changes to the hosted project

Do this **separately from the Git push**, and always run a dry run first:

```powershell
# 1. See what would be applied, without changing anything.
pnpm exec supabase db push --linked --dry-run

# 2. Read the list. Does it contain only the migrations you expect?

# 3. Apply them.
pnpm exec supabase db push --linked

# 4. Confirm they're recorded.
pnpm exec supabase migration list --linked
```

A failed migration rolls back completely, so the hosted database is never left half-changed.

**To check data on the hosted project** (read-only queries are safe):
```powershell
pnpm exec supabase db query --linked "select count(*) from public.clients"
```

**To reload fake data on the hosted test project:** `pnpm exec supabase db query --linked -f supabase/seed.sql`. The seed refuses to run unless the project's environment is `test` or `local`, and it leaves existing rows alone. Never run it against prod.

## 8. Order matters

| Kind of change | Order |
|---|---|
| Code only | Push to GitHub. Done. |
| Code that needs a new table, column or function | **Database first** (section 7), **then** push the code. Otherwise the live site briefly calls something that doesn't exist yet. |
| Removing or renaming something the live code uses | In steps. First push code that no longer uses it, then remove it in a later migration. Confirm with the owner before any drop (update spec, ground rule 3). |

## 9. Undoing a bad release

- **Code:** in Vercel, open **Deployments**, find the last good one, choose **⋯**, then **Promote to Production** (instant rollback). Then fix the problem and push again.
- **Database:** migrations only go forward. Write a new migration that reverses the change, then dry run and apply it as usual. For data mistakes, Supabase Free has no point-in-time restore, which is fine for test. Prod needs Pro.

## 10. Settings that live outside the code

These aren't in Git, so remember them when anything changes:

| Where | Setting |
|---|---|
| Vercel → Environment Variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`, set by the Supabase integration, **Production only**. Preview isn't set up. |
| Supabase → Authentication | Sign-ups off, Email provider on, minimum password 12, TOTP on. Site URL is the Vercel address. The **Invite** and **Reset password** templates are pasted from [supabase/templates/](../supabase/templates/) |
| Supabase → SMTP | Mailgun **sandbox**, which only delivers to authorised addresses. The sender is still `jugsy@hotmail.com` and should be changed to the Mailgun address. |
| Supabase → Database | `app_settings.environment = 'test'`. `pg_cron` jobs: snapshots every 5 minutes, and a lock at 14:05 UTC (00:05 Brisbane) |

The full list of hosted settings, and the first-admin steps, are in [CLAUDE.md](../CLAUDE.md).

## 11. Not set up yet
- **A prod project.** It must be in Sydney and on Supabase Pro. The steps are under "Cut-over" in [CLAUDE.md](../CLAUDE.md), and **no real clients go in until that's done**.
- **Preview deployments.** The variables aren't set for Preview.
- **Your own email domain in Mailgun,** so email reaches real staff.
- **The final cleanup migration,** dropping the old program and RM tables, which is waiting for the owner's go-ahead.
- **Two housekeeping updates:** the Supabase CLI has a newer version (3.1), and npm 12 is available. Update them deliberately, and re-run every check afterwards.
