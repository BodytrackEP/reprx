# RepRx: deploying to new production servers

How to stand up a new, separate copy of RepRx (a new Vercel web project and a new Supabase database) for real use, then keep it updated alongside the test site. Written 2026-11-17, at 28 migrations.

The current site (`reprx.vercel.app`, formerly `reprx-iainroberts1980-ui.vercel.app`, + Supabase project `hjmwswejuklkjexbrudw` in Singapore) stays as the **test** site. Never delete it, and never put real clients in it.

**The code doesn't change.** The same GitHub repo deploys to both. Everything that differs between test and production lives in settings: Vercel environment variables, Supabase dashboard settings, and one row in the database (`app_settings.environment`).

**Stop points:** the new database starts empty and needs no destructive steps. The only dangerous mistakes are pointing a command at the wrong project, and running the seed against production. Both are called out where they could happen.

---

## 0. Before you start: decisions and accounts

| Item | What you need | Why |
|---|---|---|
| Supabase plan | **Pro**, in the practice's organisation | Daily backups, leaked-password protection and session controls. Free pauses idle projects and has no backups. |
| Vercel plan | **Pro** | Hobby is for non-commercial use only. |
| Web address | A subdomain the practice controls, such as `reprx.bodytrack.com.au`, plus access to its DNS | A stable address for staff, and for the email links. |
| Email domain | A Mailgun **custom domain** (such as `mg.bodytrack.com.au`) on a paid plan, verified with DNS records | The sandbox only delivers to authorised addresses, so invites to new staff would never arrive. |
| Sender address | Such as `reprx@bodytrack.com.au` | Replaces `jugsy@hotmail.com`. |
| Password manager | Somewhere to store the database password and keys | They're shown once, and never go in chat, email or Git. |
| Privacy items | The "Before any real client" list in [PRIVACY_CHECKLIST.md](PRIVACY_CHECKLIST.md) | It must be complete before any real client is entered. You can do it in parallel with these steps. |

Allow about two hours, plus up to a day for DNS to settle.

---

## 1. Email domain (Mailgun)

Do this first, because DNS can take hours.

1. In Mailgun: **Sending → Domains → Add new domain**. Enter `mg.bodytrack.com.au` and choose the region you want (US or EU).
2. Mailgun lists DNS records: 2 TXT records (SPF and DKIM), and optionally MX and CNAME records. Add them at your DNS provider exactly as shown.
3. Wait until Mailgun shows the domain as **Verified**.
4. **Domain settings → SMTP credentials**: create a credential, such as `reprx@mg.bodytrack.com.au`, and store its password in the password manager.

Keep the sandbox domain for the test site, or switch the test site to the new domain later.

---

## 2. Create the production database (Supabase)

1. In the Supabase dashboard, click **New project** inside the practice's Pro organisation.
   - **Name:** `reprx-prod`
   - **Region: Sydney (`ap-southeast-2`).** The region can't be changed later, so check it before you click Create.
   - **Database password:** generate a long one and store it in the password manager.
2. When the project is ready, confirm the region from the development machine:
   ```powershell
   pnpm exec supabase projects list
   ```
   `reprx-prod` must show **Sydney / ap-southeast-2**. If it doesn't, delete the project and create it again **before** going any further.
3. Note the new **project ref**, the 20-letter ID in the dashboard URL. These steps write it as `<PROD_REF>`. The practice's production project is `bkoseiyuinefetphjrjw` (created 2026-11-24).

---

## 3. Load the database structure (migrations, no data)

The migrations create every table, rule, function and scheduled job. **The seed (fake data) must never run here.** `db push` doesn't run it unless you ask.

The CLI talks to one **linked** project at a time, so you switch the link to production, push, then switch it back.

```powershell
# 1. Point the CLI at production. It asks for the prod database password.
pnpm exec supabase link --project-ref <PROD_REF>

# 2. Dry run. It should list all 28 migrations and NO seed.
pnpm exec supabase db push --linked --dry-run

# 3. Apply.
pnpm exec supabase db push --linked

# 4. Confirm all 28 are recorded.
pnpm exec supabase migration list --linked

# 5. IMPORTANT: point the CLI back at the test project.
pnpm exec supabase link --project-ref hjmwswejuklkjexbrudw
```

Do step 5 every time. Otherwise the next routine "push to test" goes to production.

**Check the scheduled jobs exist** (Supabase dashboard → SQL editor, on the **prod** project):

```sql
select jobname, schedule, active from cron.job order by jobname;
```

You should see two active jobs: one every 5 minutes (snapshots), and one at `5 14 * * *` (00:05 Brisbane, which locks the day's sessions).

---

## 4. Supabase settings (prod project, in the dashboard)

These aren't in the code, so set each one by hand.

### Authentication → Sign In / Providers
- **Allow new users to sign up: OFF.**
- **Email provider: ON.** Inside the email provider, leave **sign-ups enabled**. Turning that switch off blocks all password logins.
- **Confirm email:** on.

### Authentication → Policies (or Passwords)
- **Minimum password length: 12.**
- **Leaked password protection: ON.** Pro has it.

### Authentication → Multi-Factor
- **TOTP (authenticator app): enabled.**

### Authentication → Sessions (Pro)
- Optional: set the time-box or inactivity timeout to match your staff timeout decision. RepRx also enforces its own limit (12 hours by default, in `app_settings.staff_session_timeout_hours`).

### Authentication → URL Configuration
- **Site URL:** the final address, such as `https://reprx.bodytrack.com.au`. Invite links, reset links and the **Create invite link** button all take their address from this setting, so it must be correct.
- **Redirect URLs:** add `https://reprx.bodytrack.com.au/**`. Until your domain is live, also add the Vercel address from step 6, such as `https://reprx-prod.vercel.app/**`.

### Authentication → Email Templates
- **Invite user:** paste the whole of [supabase/templates/invite.html](../supabase/templates/invite.html).
- **Reset password:** paste the whole of [supabase/templates/recovery.html](../supabase/templates/recovery.html).
- The default templates **don't work** with RepRx, so don't skip this.

### Authentication → Emails → SMTP Settings
- **Enable custom SMTP: on.**
- **Host:** `smtp.mailgun.org`, or `smtp.eu.mailgun.org` for the EU region. **Port:** `587`.
- **Username and password:** the Mailgun SMTP credential from step 1.
- **Sender email:** such as `reprx@bodytrack.com.au`. **Sender name:** `RepRx`.
- **Rate limits** (Authentication → Rate Limits): raise "emails per hour" above the default if you'll invite many staff at once.

### Mark the database as production (SQL editor, prod project)

```sql
update public.app_settings set environment = 'prod';
select environment from public.app_settings;   -- must say prod
```

This does three things. New clients are saved as real (not test) clients, the fake-data seed refuses to run, and the test-data purge can't touch them.

### Practice settings (optional, same table)
Check the defaults match your privacy decisions:
```sql
select staff_session_timeout_hours, retention_years_after_last_activity, rounding_increment_kg
from public.app_settings;
```

---

## 5. First admin (prod project)

Public sign-up is off, so the first admin is created by hand:

1. **Authentication → Users → Add user → Create new user.** Enter your email and a password of 12+ characters, and tick **Auto Confirm User**.
2. In the SQL editor:
   ```sql
   insert into public.staff (id, display_name, role)
   select id, 'Your Name', 'admin' from auth.users where email = 'you@example.com';
   ```
3. Repeat for a **second admin** (Daniel, for example) using **Create invite link** once you're signed in. With two admins, one lost phone never locks everyone out.

---

## 6. Create the production web project (Vercel)

Make a **second, separate Vercel project** from the same GitHub repo. The existing project stays as the test site.

1. Vercel → **Add New → Project → Import** `BodytrackEP/reprx`.
   - **Project name:** `reprx-prod`.
   - Framework: Next.js (detected). Leave the build settings at their defaults.
   - **Don't deploy yet** if it offers. Set the variables first, or redeploy after setting them.
2. **Settings → Environment Variables**, for the **Production** environment only:

   | Name | Value (from Supabase prod → Project Settings → API Keys / Data API) |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROD_REF>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_…`) |
   | `SUPABASE_SECRET_KEY` | The **secret** key (`sb_secret_…`). Tick **Sensitive.** |

   You can use the Supabase integration instead of typing them in, as you did for test. If you do, make sure it connects **this** Vercel project to the **prod** Supabase project only.
   `SUPABASE_DB_URL` isn't needed on Vercel.
3. **Preview deployments must never reach production.** Either:
   - **Settings → Git → Preview deployments: off** for this project (simplest), or
   - set the three variables for **Preview** to the **test** project's values.
4. **Settings → Git → Production Branch:** set it to `production` (see section 9). Create the branch first:
   ```powershell
   git push origin main:production
   ```
5. **Settings → Functions → Region:** confirm **Sydney (syd1)**. It comes from [vercel.json](../vercel.json).
6. Deploy: **Deployments → Redeploy**, or push to `production`.

---

## 7. Your own web address

1. Vercel `reprx-prod` → **Settings → Domains → Add** `reprx.bodytrack.com.au`.
2. Add the DNS record Vercel shows (usually a CNAME to `cname.vercel-dns.com`) at your DNS provider.
3. When Vercel shows **Valid configuration**, the HTTPS certificate is issued automatically.
4. Back in Supabase prod → URL Configuration, make sure the **Site URL** is this address (step 4).

---

## 8. Check it before anyone uses it

Work through this on the **production** address:

- [ ] The site loads over HTTPS, and the address bar shows your domain.
- [ ] Sign in as the first admin. You're asked to set up the authenticator, it works, and you reach the dashboard.
- [ ] **Staff → Invite** a colleague. The email arrives from your new sender, and its link opens your domain (not the Vercel or test address).
- [ ] **Create invite link** also gives a link on your domain.
- [ ] **Forgot password** sends an email, and the link works once.
- [ ] Create a dummy client named "Zz Check". The **Settings** page shows the environment as **prod**, and the client is **not** marked as test data.
- [ ] Add the dummy client to a class with a program, and open the session view. Weights show, and the status says "Saved for the record".
- [ ] After 5 minutes, check the SQL editor: `select jobname, status, start_time from cron.job_run_details order by start_time desc limit 5;` shows successful runs.
- [ ] Remove the dummy client: delete it from the Clients page (soft delete). The purge doesn't work on prod, by design.
- [ ] The PRIVACY_CHECKLIST "Before any real client" boxes are all ticked.

Only then enter real clients.

**Copying data from test:** don't. Test holds fake clients only. Real clients, classes, exercises and programs are entered fresh in production. You can rebuild the exercise list and library programs by hand, or ask the developer for a one-off script that copies **only exercises and programs** (never clients).

---

## 9. Updating once there are two sites

From now on every change goes to **test first**, then production.

```text
code ──push──▶ main ──▶ Vercel test project (auto)        ┐
                                                          ├─ check on the test site
db changes ──db push──▶ Supabase test (linked by default) ┘
                │
                ▼  when happy
db changes ──db push──▶ Supabase PROD (link, push, re-link to test)
code: main ──merge──▶ production ──▶ Vercel prod project (auto)
```

**Routine for each release:**

1. Build and test locally, as in [DEVELOPMENT.md](DEVELOPMENT.md).
2. Apply any new migration to **test** (dry run, then push), and push the code to `main`. Check the test site.
3. If there's a new migration, apply it to **production**:
   ```powershell
   pnpm exec supabase link --project-ref <PROD_REF>
   pnpm exec supabase db push --linked --dry-run    # read it: only the new migration(s)
   pnpm exec supabase db push --linked
   pnpm exec supabase link --project-ref hjmwswejuklkjexbrudw   # back to test
   ```
   **Database before code**, as always.
4. Release the code to production:
   ```powershell
   git push origin main:production
   ```
   Vercel `reprx-prod` deploys within 2–3 minutes.

**Rollback:** in Vercel `reprx-prod` → Deployments → the last good one → **⋯ → Promote to Production**. Database changes only go forward: write a new migration that reverses the problem, and apply it to test, then prod.

**Never on production:**
- `pnpm seed:test`, `supabase db reset --linked`, or running `seed.sql` (the environment guard refuses, but don't rely on it);
- **Purge test data** (it refuses on prod);
- schema changes in the dashboard (always use a migration).

---

## 10. After go-live

- **Backups:** Supabase Pro takes daily backups automatically. Run the **quarterly restore drill** in [CLAUDE.md](../CLAUDE.md#backups): restore into a scratch project, check row counts, sign in, and record the date.
- **Access review:** check the staff list each quarter, and deactivate leavers on their last day.
- **Performance:** re-measure the session view on the live site (target under 300 ms server time).
- **Update the docs:** record the prod project ref, domain and go-live date in [CLAUDE.md](../CLAUDE.md), and tick the cut-over items there.
- **Test site:** keep it for trying changes. You can move it to Sydney or the Pro plan later, but it must only ever hold fake data.
