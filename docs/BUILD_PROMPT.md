# RepRx — Claude Code Build Prompt

> Hand this whole file to Claude Code at the root of an empty repository. Save it as `docs/BUILD_PROMPT.md` and tell Claude Code: *"Read docs/BUILD_PROMPT.md and start Phase 0. Use plan mode, confirm the plan with me, then build."*
>
> **Scope:** Phase 1 (standalone app on a test database) and Phase 2 (Cliniko integration) are to be **built**. Phase 3 (client self-login) is **designed only**. Build the seams for it, not the feature.

---

## 0. Role and working rules for Claude Code

You are a senior full-stack engineer and PostgreSQL DBA building a small clinical web app for an Australian Exercise Physiology (EP) practice. The product owner is an experienced DBA with a law background. Be direct. Put business rules in the database where Postgres can enforce them. Don't over-engineer.

Working rules:

1. **Before writing code in each phase**, use plan mode. List the files you'll create, the migrations, and any assumption that isn't settled in this document. Wait for approval.
2. **Commit at each milestone** listed in the phase checklists, with a meaningful message. Never commit secrets.
3. **Create and maintain `CLAUDE.md`** at the repo root. It should hold the stack, commands (dev, test, migrate, seed, typegen), conventions, and a "decisions log". Append to the log whenever a decision is made during the build.
4. **The schema is migration-first.** Every change goes in a new SQL file under `supabase/migrations/`. Never edit the schema through the dashboard. Regenerate TypeScript types after each migration.
5. **If anything here is ambiguous or contradictory, stop and ask.** Do not guess on data-model or privacy questions.
6. **Do not invent Cliniko API behaviour.** Download the official OpenAPI spec (see §8.1) and verify every endpoint, filter and field against it. Where this document says *VERIFY*, check before relying on it.

---

## 1. Product summary

RepRx links three things:

- group **classes**, each with a **program template** (exercises, sets, reps, % of 1RM);
- **clients** assigned to one or more classes;
- **RM test** results per client per exercise.

From these it calculates each client's **working weight** per exercise, applies EP **overrides**, and shows two views:

- a **live session view** for each class, for staff;
- later, a mobile **"my program"** view, for clients (Phase 3).

**Reference material**

- Clickable mockup: **https://mockups-three-woad.vercel.app/**. Fetch these pages and port their Tailwind markup and layout. Reuse the markup liberally; the mockup's data and JS are throwaway.
  - Staff: `/admin/dashboard.html`, `/admin/classes.html`, `/admin/class-detail.html`, `/admin/program-builder.html`, `/admin/clients.html`, `/admin/client-detail.html`, `/admin/client-program.html`, `/admin/rm-testing.html`, `/admin/session-view.html`, `/admin/exercises.html`
  - Client (Phase 3 reference only): `/client/dashboard.html`, `/client/program.html`, `/client/progress.html`
  - If a path 404s, start from `/` and follow the links.
- `mockups/data.js` in the mockup has the helpers `getEffectiveWeight` and `calcWeight`. Read them, but the rules in §5 of this document take precedence.
- The original handover spec, *RepRx Handover Specification (April 2026)*. This document **overrides** it where they differ. In particular, see §3.

---

## 2. Stack and hosting (fixed)

| Concern | Choice |
|---|---|
| Framework | Current stable **Next.js** (App Router), **TypeScript** in strict mode, React Server Components plus Server Actions for writes |
| UI | **Tailwind CSS**, ported from the mockup. Minimal component library (shadcn/ui only if needed for dialogs or forms) |
| Database | **Supabase Postgres**, in the **Sydney region (ap-southeast-2)** |
| Auth | **Supabase Auth**: email + password plus **TOTP MFA**, enforced for all staff |
| DB access | `@supabase/ssr` and `supabase-js` with generated types. Complex reads go through SQL functions or views called via RPC |
| Migrations | Supabase CLI (`supabase/migrations/*.sql`). Local dev with `supabase start` (Docker) |
| Hosting | **Vercel**, with the Function region pinned to **syd1** (`vercel.json` / route config) |
| Scheduled jobs (Phase 2) | **Vercel Cron**, calling a route handler protected by `CRON_SECRET` |
| Validation | **Zod** at every server boundary |
| Tests | **Vitest** (unit), **pgTAP** via `supabase test db` (database rules and RLS), **Playwright** (critical end-to-end flows) |
| Email (Phase 3) | Postmark or Amazon SES (Sydney). Not needed in Phases 1–2 except Supabase's own auth emails |

**Environments**

- `local`: Supabase CLI.
- `test`: the hosted Supabase project, with Vercel Preview plus a `test` deployment.
- `prod`: a separate Supabase project, created at the end of Phase 2. Never point a Preview deployment at prod.

**Plan notes for the owner** (verify current pricing; Claude Code should restate these in `CLAUDE.md`):

- Vercel **Hobby is non-commercial only**. A practice's production app needs **Vercel Pro**.
- **Supabase Free** pauses inactive projects and has no point-in-time recovery. It's fine for `test`, but `prod` needs **Supabase Pro** for backups and session-timeout controls.

---

## 3. Privacy and data-minimisation stance (binding)

RepRx stores **only what it needs to calculate and display training loads**. Cliniko remains the system of record for all identity, contact and clinical information.

**Stored in RepRx**

- the client's display name (first and last);
- the Cliniko patient ID, once linked;
- class memberships;
- RM tests;
- overrides, together with a short clinical reason;
- program data;
- staff accounts;
- the audit log.

**Never stored in RepRx**

- date of birth, gender, address, phone or email (of clients);
- emergency contacts, referral source or referring doctor;
- medical notes, Medicare or NDIS numbers;
- any Cliniko field not listed above.

Rules:

1. **The schema must make it impossible to store these fields.** Don't add the columns, and don't add a generic `jsonb` "extra" column on `clients`.
2. **Transient display is allowed; persistence is not.** In Phase 2, when staff link a client, Cliniko search results may show DOB and a partly masked email so staff can tell people apart. That data must be rendered server-side from the live API response and then discarded. It must never be written to the database, logs, caches, analytics, error trackers or the audit log.
3. **Logging hygiene.** Never log Cliniko response bodies. Log the HTTP status, endpoint template, duration and patient ID only.
4. **This data is still sensitive information.** The remaining data (a name, plus class type such as "Cardiac Rehab", plus strength data) is still **health information about an identifiable person** under the *Privacy Act 1988* (Cth). So MFA, RLS, the audit log, AU-only hosting and TLS remain mandatory. Minimisation reduces the risk; it doesn't remove the obligations.
5. **Override reasons** are free text. The UI hint must say: *"Brief training reason only (e.g. 'L shoulder rehab – reduce pressing'). Clinical notes belong in Cliniko."* Limit the field to 200 characters.

---

## 4. Data model (Phase 1 builds all of this; Phase 2 columns are present but unused)

All tables:

- primary key `id bigint generated always as identity`, unless noted;
- `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()`, maintained by a trigger;
- **RLS enabled**.

Use `numeric`, never `float`, for weights.

### 4.1 Staff and auth

```
staff
  id            uuid pk references auth.users(id) on delete cascade
  display_name  text not null
  role          text not null check (role in ('admin','ep'))
  is_active     boolean not null default true
```

- There is no public sign-up. Admins invite staff (see §6.1).
- `auth.users` holds the staff email. That's acceptable, because staff are employees, not clients.

### 4.2 Clients (name-only, Cliniko-linkable)

```
clients
  id                   bigint pk
  first_name           text not null
  last_name            text not null
  preferred_name       text null
  source               text not null check (source in ('manual','cliniko')) default 'manual'
  is_test              boolean not null default false     -- fake seed data; purgeable
  cliniko_shard        text null                          -- e.g. 'au1' (Phase 2)
  cliniko_patient_id   bigint null                        -- Cliniko returns ids as strings: parse to bigint
  cliniko_linked_at    timestamptz null
  cliniko_linked_by    uuid null references staff(id)
  cliniko_archived_at  timestamptz null                   -- mirrored state, Phase 2
  cliniko_last_synced_at timestamptz null
  auth_user_id         uuid null unique references auth.users(id)  -- Phase 3 seam; unused now
  is_active            boolean not null default true
  deleted_at           timestamptz null                   -- soft delete
  unique (cliniko_shard, cliniko_patient_id)
  check ((cliniko_patient_id is null) = (cliniko_shard is null))
  check (not (is_test and cliniko_patient_id is not null)) -- test people can never be linked
```

**Identity rule.** Once linked, `(cliniko_shard, cliniko_patient_id)` *is* the person. The name is a cached display field that Cliniko overwrites on sync. **Never match people on name alone automatically.** Matching is always a human decision (see §8.4).

### 4.3 Classes and membership

```
class_categories  -- lookup table, not an enum, so the practice can add categories
  code text pk, label text, colour text, sort_order int
  seed: STRENGTH, CARDIAC_REHAB, FALLS_PREVENTION, CHRONIC_DISEASE, NDIS, PULMONARY_REHAB, CANCER_REHAB, GENERAL

classes
  id, name, category_code fk, day_of_week smallint check 0..6 (0=Sunday),
  start_time time, end_time time check (end_time > start_time),
  location text, max_capacity int null check (> 0), is_active bool,
  cliniko_group_appointment_ref text null   -- Phase 2 seam (see §8.6); unused in Phase 1

class_members
  class_id fk, client_id fk, added_at timestamptz default now(), added_by uuid fk staff
  primary key (class_id, client_id)
```

- Capacity is enforced in a trigger. The error message must be friendly and must name the class.
- An admin may override capacity by setting a flag in the same transaction, for example `set_config('reprx.allow_over_capacity','on', true)`.

### 4.4 Exercises and programs

```
exercises
  id, name text not null, muscle_group text, equipment text, description text, video_url text null,
  is_active bool
  unique index on lower(name)

programs
  id, class_id fk unique, name

program_exercises
  id, program_id fk, exercise_id fk, order_index int not null,
  sets int check (sets between 1 and 20),
  reps int check (reps between 1 and 100),
  rm_percentage numeric(4,3) null check (rm_percentage > 0 and rm_percentage <= 1.2),
  fallback_weight_kg numeric(6,2) null check (fallback_weight_kg >= 0),
  rest_seconds int null, notes text,
  unique (program_id, order_index) deferrable initially deferred
```

`fallback_weight_kg` is the starting weight for clients with no RM test on this exercise.

### 4.5 RM tests

```
rm_tests
  id, client_id fk, exercise_id fk, test_date date not null default current_date,
  reps smallint not null check (reps between 1 and 10),
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  estimated_1rm_kg numeric(6,2) generated always as (
      case when reps = 1 then weight_kg
           else round(weight_kg * (1 + reps / 30.0), 2) end) stored,
  recorded_by uuid fk staff, notes text null (max 200)
  index (client_id, exercise_id, test_date desc, created_at desc)
```

- **Formula: Epley.** It must special-case `reps = 1`, because raw Epley gives 1.033 × the weight for a true 1RM.
- The UI shows a **soft warning** when reps > 6 ("estimate less reliable above 6 reps").
- RM tests are **append-only**. Corrections are made by soft-voiding, never by update. Add `voided_at timestamptz` and `voided_reason text`; voided rows are ignored by the calculation.

### 4.6 Overrides (follow the client across all classes, with history)

```
weight_overrides
  id, client_id fk, exercise_id fk,
  override_weight_kg numeric(6,2) not null check (>= 0),
  reason text not null check (char_length(reason) between 3 and 200),
  review_date date null,              -- e.g. rehab review; drives a "due for review" badge
  set_by uuid fk staff, set_at timestamptz default now(),
  ended_at timestamptz null, ended_by uuid fk staff null
  unique index (client_id, exercise_id) where ended_at is null   -- one active override
```

- **Scope:** per (client, exercise). An override applies in **every** class that contains that exercise. The reason is injury rehab that follows the person.
- **Replacing an override** ends the current row and inserts a new one, in a single transaction (`set_override()` SQL function).
- **Removing an override** sets `ended_at`. The full history is kept.

### 4.7 Settings and audit

```
app_settings  (single row, id = 1 check)
  staff_session_timeout_hours int default 12
  client_session_timeout_days int default 30
  soft_delete_restore_days int default 30
  retention_years_after_last_activity int default 7
  rounding_increment_kg numeric(4,2) default 2.5
  rm_warn_above_reps int default 6
```

`audit_log` is populated by a **generic Postgres trigger** on every clinical and membership table (`clients`, `class_members`, `programs`, `program_exercises`, `rm_tests`, `weight_overrides`, `exercises`, `classes`, `staff`, `app_settings`):

```
audit_log
  id, occurred_at timestamptz default now(), actor uuid null,  -- from auth.uid(); null = system/sync
  actor_label text,  -- 'sync:cliniko' for jobs
  table_name text, row_pk text, action text check (action in ('INSERT','UPDATE','DELETE')),
  old_row jsonb, new_row jsonb
```

Requirements:

- Staff can only `SELECT` the audit log, and admins only. Nobody gets `UPDATE` or `DELETE` (revoke it, and enforce with RLS plus a trigger that raises).
- Jobs set `set_config('reprx.actor_label', 'sync:cliniko', true)` so the trigger records them.

**Do the retention and soft-delete settings do anything in Phase 1?** They are stored and editable. Phase 1 adds a manual admin action, "Purge test data", that hard-deletes `is_test = true` clients. It cascades to their tests, memberships and overrides, and logs one summary audit row.

The automated retention job is Phase 2+, and must be built as a **dry-run report first**.

---

## 5. Core calculation (in the database)

Implement `effective_weights(p_class_id bigint)` as a `stable` SQL function. It returns one row per (member × program exercise), with these columns:

`client_id, exercise_id, order_index, sets, reps, rm_percentage, latest_1rm_kg, latest_test_date, calculated_kg, override_kg, override_reason, override_review_date, fallback_kg, effective_kg, weight_source`

The precedence rule is:

1. An active override exists → `effective_kg = override_kg`, `weight_source = 'override'`.
2. Otherwise, if `rm_percentage` is set and a latest non-voided RM test exists → `effective_kg = round_to_increment(latest_1rm × rm_percentage)`, `weight_source = 'calculated'`.
3. Otherwise, if `fallback_weight_kg` is set → `effective_kg = fallback_kg`, `weight_source = 'fallback'`.
4. Otherwise → `effective_kg = null`, `weight_source = 'not_tested'`. If `rm_percentage` is null, the exercise has no load, so `weight_source = 'bodyweight'`.

Supporting details:

- `round_to_increment(x, inc)` is `round(x / inc) * inc`, which rounds half away from zero. Write a pgTAP test that pins this behaviour.
- "Latest" RM means ordered by `test_date desc, created_at desc`, excluding voided rows.
- Also add `effective_weights_for_client(p_client_id)` for the client-detail and client-program screens.

**Visual treatment** (from the mockup):

- Override: amber border plus an "Override" label. Show the reason on hover or tap, and a "Review due" badge when `review_date <= current_date`.
- Fallback: a neutral "Starting weight" label.
- Not tested: an empty state.

Required unit tests (pgTAP and Vitest mirror):

- 3RM at 30 kg gives 1RM 33.00 kg.
- 1RM at 50 gives 50.
- At 70% of a 1RM of 57.5, the result is 40.25, which rounds to 40.0.
- An override beats the calculated weight.
- A voided test is ignored.
- The fallback is used only when there is no test.
- Ending an override reverts the weight to the calculated value.

---

## 6. Phase 1 — Standalone app on a test database

**Goal:** a deployed, MFA-protected staff app on Vercel plus Supabase (test), with fake data. Staff can create classes, programs and exercises, add clients manually, move clients between classes, record RM tests, set overrides and run the session view.

### 6.1 Auth and access

- **Staff login:** email plus password, then a mandatory **TOTP enrolment** on first login (QR code plus manual secret). After enrolment, every login requires TOTP.
- **Enforce AAL2 in two places:**
  - Next.js middleware redirects any staff route to `/mfa` unless the session is AAL2.
  - **Every RLS policy** also checks `(auth.jwt() ->> 'aal') = 'aal2'`.
- **Inviting staff:** admins invite staff from `/admin/staff` using `auth.admin.inviteUserByEmail`. This runs in a Server Action with the service-role key, which is server-only and never exposed to the client.
- **Bootstrapping the first admin:** documented SQL in `CLAUDE.md`, run once.
- **Password policy:** minimum 12 characters, with Supabase's leaked-password protection enabled if available on the plan. Document it in `CLAUDE.md` if it isn't.
- **Session lifetime:** use the Supabase Auth session timebox or inactivity settings where the plan allows. Otherwise enforce the timeout in middleware using `app_settings.staff_session_timeout_hours`.
- **Security headers:** HSTS, a strict CSP, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, secure cookies.

**Roles**

- `ep`: full read and write on clients, classes, programs, exercises, RM tests and overrides; read on settings.
- `admin`: everything an EP can do, plus staff management, settings, the audit log viewer and purging test data.
- Encode these in SQL helper functions `is_staff()` and `is_admin()` (`security definer`, `search_path` locked). Use them in RLS.

### 6.2 Screens (port from the mockup)

| Route | Purpose | Notes |
|---|---|---|
| `/admin` | Dashboard | Today's classes (by `day_of_week`), member counts, overrides due for review |
| `/admin/classes` | Class list + category filter | Create/edit modal |
| `/admin/classes/[id]` | Class detail | Members (add/remove), program summary, "Open session view" |
| `/admin/classes/[id]/program` | Program builder | Add/reorder/remove exercises; sets/reps/%1RM/fallback/rest/notes. **Inline "+ Create new exercise…"** in the add-exercise modal. Drag-to-reorder is optional; up/down buttons are the minimum |
| `/admin/clients` | Client list | Search, filters (class, active, linked/unlinked, test), New Client (first/last/preferred name only) |
| `/admin/clients/[id]` | Client detail | Classes, RM summary per exercise, active overrides, history tabs |
| `/admin/clients/[id]/program/[classId]` | Client's personalised program | Shows `weight_source` treatments; set/replace/end override here |
| `/admin/rm-testing` | Record RM test | Client picker → exercise picker (with **inline "+ Create new exercise…"**) → **reps (1–10) number field** + weight → live preview of estimated 1RM. Warn above 6 reps |
| `/admin/sessions/[classId]` | **Live session view** | All members × all exercises with effective weights. Large type, projector-friendly, **print stylesheet** (A4 landscape) |
| `/admin/exercises` | Exercise library | CRUD; deactivate instead of delete when referenced |
| `/admin/staff` | Staff management (admin) | Invite, deactivate, role |
| `/admin/settings` | App settings (admin) | §4.7 fields + "Purge test data" |
| `/admin/audit` | Audit viewer (admin) | Filter by table, actor, date, row |

### 6.3 "Move clients around programs"

This is a primary workflow and must be fast:

- **On a client's page:** a multi-select of classes, with add and remove.
- **On a class page:** an "Add members" picker that searches clients, plus a **"Move to class…"** action on each member. The move removes the client from this class and adds them to the target in **one transaction**, via a `move_client(client, from_class, to_class)` SQL function.
- **Bulk action:** select several members and move them to another class.
- Capacity violations show a clear error. Admins can override capacity.
- Overrides and RM tests are unaffected by moves. They belong to the client, not the class.

### 6.4 Seed data (`supabase/seed.sql` and a `pnpm seed:test` script)

- **40 obviously fake clients** with `is_test = true`, using names that can't be real people's, for example "Test Client 01" or a fixed list of "Zz-" prefixed names.
- 8 classes, one per category.
- About 25 exercises.
- A program for each class.
- RM tests for about 70% of (client, exercise) pairs.
- 5 active overrides, 2 of them with a past `review_date`.
- Some program rows with fallback weights.
- The seed is **idempotent** and **refuses to run against a database where `app_settings.environment = 'prod'`**. Add that column.

### 6.5 Phase 1 acceptance criteria

- [ ] Deployed to Vercel (syd1) against the Supabase **test** project in Sydney. A Preview deploy per PR.
- [ ] A staff user cannot reach any data without TOTP. This is proven by a Playwright test and by pgTAP RLS tests run as an AAL1 JWT.
- [ ] An anonymous request to any table via PostgREST returns nothing (pgTAP).
- [ ] All the §5 calculation tests pass.
- [ ] Moving a client between classes is atomic, appears in the audit log, and keeps overrides intact.
- [ ] An inline exercise creation works from both the program builder and RM testing, and returns to the form with the new exercise preselected.
- [ ] The session view prints cleanly on A4 landscape.
- [ ] "Purge test data" removes every `is_test` record and nothing else (pgTAP).
- [ ] The schema contains **none** of the fields forbidden in §3 (a pgTAP test asserts the column list of `clients`).
- [ ] `CLAUDE.md` documents setup, environment variables, commands, the first-admin bootstrap and the decisions log.

**Milestone commits:**

1. Scaffold and CI.
2. Schema, RLS and pgTAP.
3. Auth and MFA.
4. Classes, exercises and programs.
5. Clients and moves.
6. RM testing.
7. Overrides and the calculation.
8. Session view.
9. Settings, audit and purge.
10. Deploy.

**CI** (GitHub Actions): typecheck, lint, Vitest, `supabase db reset` plus `supabase test db`, and Playwright against a local stack.

---

## 7. Real clients entered before Phase 2

The practice may enter **real** clients manually in Phase 1, by name only, with `is_test = false` and `source = 'manual'`. They stay unlinked (`cliniko_patient_id` null) until Phase 2. In Phase 1:

- show an **"Not linked to Cliniko"** chip on unlinked real clients;
- **real clients must never be created in the test database** once it holds seed data. Before any real client is entered, create the **prod** Supabase project and Vercel production deployment. Run the Phase 1 migrations there without the seed. Document this cut-over in `CLAUDE.md` and stop to confirm it with the owner.

---

## 8. Phase 2 — Cliniko integration

**Goal:** link RepRx clients to Cliniko patients by Cliniko's patient ID, keep display names in sync, and handle archived patients. This is still name-only (§3).

**Design principle: link on demand, don't mirror.** RepRx does **not** import the practice's whole patient list. Staff search Cliniko live, pick the right patient, and RepRx stores only the ID, the shard and the name. The sync job then refreshes **only linked patients**. This keeps RepRx minimal.

### 8.1 Verify the API first

Download the official OpenAPI description:

- `https://docs.api.cliniko.com/_bundle/openapi.json?download`

Commit it to `integrations/cliniko/openapi.json`, generate TypeScript types from it (`openapi-typescript`), and write `integrations/cliniko/NOTES.md`. That file confirms each of the following against the spec, with a quoted line reference for each:

- the base URL `https://api.{shard}.cliniko.com/v1`;
- the patient `id` type. It is expected to be an int64 serialised as a JSON string. Parse it with `BigInt` or a string-to-bigint conversion, never `Number`;
- `GET /patients`, `GET /patients/{id}`, and how **archived** patients are exposed (*VERIFY*: whether `/patients` excludes archived patients by default, and whether there's a filter or endpoint for them);
- the `q[]` filter syntax for `last_name`, `first_name`, `updated_at` and `email` (*VERIFY* exact operators such as `:~`, `:=`, `:>`);
- the pagination parameters and maximum page size (expected `per_page` up to 100, plus `links.next`);
- whether a single-ID fetch of an archived patient returns the record (with `archived_at`) or a 404.

Report any differences from this document before writing integration code.

### 8.2 Client library (`integrations/cliniko/client.ts`, server-only)

**Authentication**

- HTTP Basic with the **API key as the username and a blank password**.
- The **shard** is the suffix after the last `-` in the key. A key with no suffix means `au1`.
- Validate the shard against the known list: `au1`–`au4`, `uk1`, `eu1`, `us1`, `ca1`.

**Required headers on every request**

- `Accept: application/json`
- `User-Agent: RepRx (<CLINIKO_CONTACT_EMAIL>)`. Cliniko may block requests without a valid contact email.

**Rate limit**

- The limit is 200 requests per minute per user. Use a client-side token bucket of about 150 per minute.
- On a 429, wait until `X-RateLimit-Reset` (a UNIX timestamp) and retry. Retry up to 3 times with jittered backoff for 5xx errors as well.

**Other requirements**

- Timeouts of 10 seconds.
- **No response-body logging** (§3.3).
- Typed functions: `searchPatients({lastName, firstName})`, `getPatient(id)`, `listPatientsUpdatedSince(ts)` (paginated), and later `listGroupAppointments` and `listAttendees` (§8.6).
- Unit tests using recorded **synthetic** fixtures (no real patient data in the repo) and `msw`.

**Secrets**

- `CLINIKO_API_KEY` and `CLINIKO_CONTACT_EMAIL` go in Vercel environment variables marked **Sensitive**, separately for Production and Preview.
- Preview should use a **Cliniko sandbox or trial account**, never the practice's live account.
- The key must belong to a **dedicated least-privilege Cliniko user** created by the practice. Document this in `CLAUDE.md`.

### 8.3 Settings and state

Add these tables:

```
cliniko_sync_state (single row)
  shard text, last_patient_sync_at timestamptz, last_run_id bigint
sync_runs
  id, job text, started_at, finished_at, status text check in ('running','ok','partial','failed'),
  patients_checked int, names_updated int, archived_detected int, errors jsonb  -- error codes + patient ids only
```

The admin settings page gets a Cliniko panel showing the connection test (`GET /user` returns 200; display only the Cliniko user's name), the detected shard, the last sync, and a "Run sync now" button. **Do not show the key.**

### 8.4 Linking workflow (the core of Phase 2)

On an unlinked client's page there's a **"Link to Cliniko"** button. It opens a modal that does the following:

1. Pre-fills a search with the client's last name, with the first name optional.
2. Calls a **Server Action** that queries Cliniko live and returns up to 20 candidates. For each it returns the full name, **DOB and a masked email (`j***@g***.com`) for disambiguation only**, the Cliniko ID, and whether the patient is archived.
3. Renders the candidates server-side. Nothing from step 2 except the chosen ID and name is persisted. Use `export const dynamic = 'force-dynamic'` and `Cache-Control: no-store`.
4. When staff select a candidate, a `link_client_to_cliniko(client_id, shard, patient_id, first_name, last_name)` SQL function runs. It:
   - checks that the patient isn't already linked to another RepRx client. The unique constraint enforces this; return a friendly message naming the existing RepRx client;
   - sets the link fields and `source = 'cliniko'`;
   - **overwrites the name with Cliniko's version**;
   - audits the change.
5. **Unlinking** is admin-only, requires a reason, and is audited.

There is also a **"Create from Cliniko"** flow: search Cliniko and create a new RepRx client already linked. Before creating, check whether an unlinked RepRx client has the same name. If so, offer "link existing instead" to avoid duplicates.

Finally, a **"Reconciliation" screen** lists all unlinked real clients with a "Link" action, so the pre-Phase-2 manual records can be cleaned up in one sitting.

### 8.5 Sync job

- Exposed as a route at `/api/cron/cliniko-sync` with `runtime = 'nodejs'` and region `syd1`. It authenticates with `Authorization: Bearer ${CRON_SECRET}`.
- Scheduled in `vercel.json`, nightly at 02:00 AEST. Hourly is optional on Pro.

The algorithm:

1. Use the incremental `updated_at` filter since `last_patient_sync_at` minus a 10-minute overlap. Page through the results and keep only IDs present in `clients`. If the filter can't be verified (§8.1), fall back to `GET /patients/{id}` for each linked client, rate-limited.
2. For each linked patient, update `first_name` and `last_name` if they changed, and set `cliniko_last_synced_at`.
3. If a patient is archived, set `cliniko_archived_at` and flag the client in the UI ("Archived in Cliniko"). **Do not delete or deactivate automatically.** Staff decide.
4. If a patient returns 404 (deleted in Cliniko), mark the client with a `cliniko_missing` flag, report it in `sync_runs.errors`, and leave the data intact.
5. Write audit rows with `actor_label = 'sync:cliniko'`.
6. The job is **idempotent and safe to re-run**, and uses an advisory lock (`pg_try_advisory_lock`) to prevent overlapping runs.

Sync is **one-way (Cliniko → RepRx) and covers names and archive status only.** RepRx never writes to Cliniko in Phase 2.

### 8.6 Group appointments (decision gate; do not build without the owner's approval)

The practice hasn't yet confirmed whether its classes are booked in Cliniko as group appointments. Build only:

- a read-only **diagnostic page** (admin) that lists Cliniko group appointments for the next 14 days (`/group_appointments`) and their attendee counts (*VERIFY* the endpoints and filters). This lets the owner see whether the data maps to RepRx classes;
- the nullable `classes.cliniko_group_appointment_ref` column, which already exists.

Then **stop and ask** whether to build attendance sync, meaning "who is booked into today's class" feeding the session view.

### 8.7 Phase 2 acceptance criteria

- [ ] `NOTES.md` verifies every API assumption, with citations to the OpenAPI spec.
- [ ] A client can be linked by search, created from Cliniko, and unlinked (admin only). All three are audited.
- [ ] Linking the same Cliniko patient to two clients is impossible (database constraint plus a test).
- [ ] The candidate DOB and email never appear in the database, logs or audit. Prove it with a test that links a fixture patient and greps the database dump and captured logs for the fixture DOB and email.
- [ ] The sync updates a changed name, flags an archived patient, survives a 429 (fixture) and is idempotent.
- [ ] The reconciliation screen lists every unlinked real client.
- [ ] The prod Supabase project (Sydney, Pro) and Vercel production are live. Backups are confirmed, and a restore has been tested once and documented.

---

## 9. Phase 3 — Client self-login (design only; build the seams, not the feature)

**Requirement:** clients may later log in to see their own classes, program and RM history. The method is undecided. The constraint is that RepRx stores no client email if that can be avoided.

The seams to build now:

- `clients.auth_user_id` exists (§4.2).
- RLS policies for a `client` role are **written but disabled**, in a separate migration file that isn't applied by default (`supabase/migrations_phase3_draft/`). A client may `SELECT` only their own `clients` row, their `class_members`, the programs of their classes, their `rm_tests` (non-voided), their active overrides (showing the weight and "Adjusted by your EP", **not** the reason), and the output of `effective_weights_for_client` for themselves only.
- The client screens from the mockup (`/client/*`) are **not built**. Leave a route group placeholder `app/(client)/` with a README.

Write `docs/PHASE3_AUTH_OPTIONS.md` comparing the following options:

| Option | How | Client PII in RepRx | Notes |
|---|---|---|---|
| **A. Supabase Auth magic link** | Staff invite the client; their email lives in `auth.users` | Email only | Simplest. Uses built-in rate limits, expiry and MFA option |
| **B. Cliniko-verified magic link** | Client enters email → server looks up a **linked** patient in Cliniko by exact email (*VERIFY* filter) → if exactly one match, send a single-use, 15-minute, hashed-at-rest token to that email → on click, mint a session for `auth_user_id` (Supabase user created **without** email, or a custom JWT signed with the project secret) | None persisted | Email is checked live against Cliniko; RepRx never stores it. More code; must rate-limit, give a constant-time "if that email is registered, a link has been sent" response, and handle shared family emails (multiple matches → refuse and tell them to contact the practice) |
| **C. Practice-issued access code** | EP generates a one-time enrolment code in the clinic; client sets a passkey (WebAuthn) | None | No email at all; recovery requires a clinic visit |

For each option, cover the threat model, account recovery, shared-email households, NDIS clients with carers, logout and timeout (`client_session_timeout_days`), and the APP 5 collection notice on first login. Recommend one, but **do not implement any of them.**

---

## 10. Non-functional requirements (all phases)

- **Hosting:** AU data residency, with Supabase in ap-southeast-2 and Vercel Functions in syd1. Static assets may be served from the CDN edge.
- **Security:**
  - RLS is on every table, and there are no `using (true)` policies.
  - The service-role key is used only in server code, never in the browser bundle (add a CI check that greps the build output).
  - Every RPC function is `security invoker` unless it must be `security definer`. Definer functions have `search_path` locked and arguments validated.
- **Accessibility:** WCAG 2.2 AA for staff screens. Session-view text is at least 20px.
- **Performance:** the session view for a class of 15 members × 12 exercises renders in under 300 ms server time. Add an `EXPLAIN ANALYZE` note in `CLAUDE.md`.
- **Backups:** Supabase Pro daily backups on prod. Document a quarterly restore drill.
- **Observability:** Vercel logs only, with no third-party error tracker that would receive request bodies. If one is added later, it must scrub data and be AU-hosted.
- **Privacy items the developer surfaces but the practice owns:** the privacy policy link in the footer (APP 1), a collection notice (APP 5, for Phase 3), and a data-breach runbook (Notifiable Data Breaches scheme). Add `docs/PRIVACY_CHECKLIST.md` listing these as owner actions.

---

## 11. Decisions already made (do not reopen)

| # | Decision |
|---|---|
| D1 | Vercel + Supabase, Sydney region |
| D2 | Phase 1 test DB holds fake people only (`is_test`); real clients go only into prod |
| D3 | Real clients may be entered manually before Phase 2 and linked later via §8.4 |
| D4 | Name-only: no DOB, contact, medical notes, emergency contacts or referral data in RepRx |
| D5 | Overrides are per (client, exercise), follow the client across classes, with history and optional review date |
| D6 | Staff auth = email + password + mandatory TOTP |
| D7 | RM tests 1–10 reps, Epley (1 rep = actual weight), warn above 6 |
| D8 | Program-level fallback weight for untested clients |
| D9 | Cliniko sync is one-way, linked patients only, names + archive status only |
| D10 | Cliniko patient ID (+ shard) is the identity key once linked; never auto-match on name |

## 12. Open items (ask the owner when you reach them)

1. Whether classes are booked in Cliniko as group appointments (gate at §8.6).
2. The final session timeouts and retention period. Defaults are in §4.7; confirm them before prod.
3. The domain or subdomain and the transactional-email sender (needed in Phase 3 or for staff invites on a custom domain).
4. Whether a Cliniko sandbox or trial account is available for Preview.
5. Whether `preferred_name` should be synced from Cliniko, if Cliniko exposes it (*VERIFY*).
