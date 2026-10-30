# Phase 3 client login options

**Status: design only. Nothing here is built.** The aim is to let clients see their own classes, program and RM history while storing as little as possible. RepRx keeps no client email if that can be avoided.

## Recommendation

**Choose Option A (Supabase magic link), with a staff-issued invite.** It's the only option that needs no custom authentication code, and that matters more here than avoiding one stored field. Writing session and token handling by hand for a small clinical app is the larger privacy risk.

The cost is one extra piece of personal information: the client's email address in `auth.users`. That departs from "RepRx stores no client email if that can be avoided", so **this is the owner's decision**. It needs a §3 update and a mention in the collection notice.

If the owner decides no email may be stored, choose **Option C**, not B. Option C has the simplest threat model of the two email-free options, and its only real cost is that recovery needs a clinic visit.

## Comparison

| | A. Supabase magic link | B. Cliniko-verified magic link | C. Practice-issued code + passkey |
|---|---|---|---|
| Client PII in RepRx | Email, in `auth.users` | None persisted | None |
| Custom auth code | None | Substantial | Moderate |
| Depends on Cliniko at login | No | Yes, every login | No |
| Client needs | An email inbox | An email inbox, matching Cliniko | A device with passkey support |
| Recovery | Self-service | Self-service | Clinic visit |

## Option A: Supabase Auth magic link

Staff invite a client, whose email is held in `auth.users`.

- **Threat model:** a compromised mailbox gives access to that client's program. Rate limits, link expiry and single use come from Supabase Auth. An optional MFA factor is available. The email list itself is a small new asset to protect.
- **Account recovery:** self-service, by requesting a new link. If the email changes, staff update it.
- **Shared-email households:** Supabase requires a unique email per user, so a couple sharing an address can't both have accounts. Decide whether one client goes without, or uses a second address.
- **NDIS clients with carers:** the link goes to whichever address is on file. If that's a carer's, the carer has full access, so consent must be recorded. Accounts can't be shared by design, so there's no separate carer view.
- **Logout and timeout:** use the Supabase session settings where the plan allows; otherwise enforce `client_session_timeout_days` in `proxy.ts`, as the staff timeout does. Add a logout button.
- **APP 5 notice:** show on first login, and add that RepRx now holds the client's email.

## Option B: Cliniko-verified magic link

The client enters an email. The server looks up a **linked** patient in Cliniko by exact email. If exactly one matches, it sends a single-use, 15-minute token, stored only as a hash. On click, the server mints a session for `auth_user_id`.

- **Threat model:** the largest of the three, because RepRx owns token generation, storage, expiry, single use and session minting. It must rate-limit by IP and by address, and answer in constant time with "if that email is registered, a link has been sent". A bug here is an authentication bypass. Email is sent by a RepRx-controlled service (Postmark or SES), so that key must be protected.
- **Verify first:** the exact-email filter on `/patients` must be confirmed against the Cliniko OpenAPI spec (§8.1). Each login also draws on the Cliniko rate limit.
- **Session minting needs checking.** The spec suggests signing a custom JWT with the project secret. Supabase has since moved to asymmetric signing keys, so this may no longer work as described. A Supabase user created without an email, signed in via a server-side admin flow, is the likely route. Prove it before committing to this option.
- **Account recovery:** self-service, as long as Cliniko holds the right email. If it doesn't, the practice corrects it in Cliniko.
- **Shared-email households:** multiple matches must be refused, with a message to contact the practice. Those families can never use this login.
- **NDIS clients with carers:** access follows the email in Cliniko. If that's a carer's address, the carer has access, so the same consent point applies.
- **Logout and timeout:** a custom session must honour `client_session_timeout_days` and support revocation, which is more code.
- **APP 5 notice:** show on first login, and explain that the email is checked against Cliniko but not kept.
- **Availability:** a Cliniko outage stops clients logging in.

## Option C: Practice-issued code + passkey

An EP generates a one-time enrolment code in the clinic. The client enters it and creates a passkey (WebAuthn) on their own device.

- **Threat model:** phishing-resistant, with nothing to steal from RepRx beyond public keys. The main risk is the enrolment code, so it must be short-lived, single-use, hashed at rest and handed over in person. A lost or shared unlocked phone exposes that client's program.
- **Account recovery:** a clinic visit for a new code. Passkeys synced by Apple or Google survive a new phone on the same account. Low-tech clients may struggle, so test with real clients before committing.
- **Shared-email households:** not applicable, because no email is involved. Each client enrols separately.
- **NDIS clients with carers:** the carer can enrol on their own device, in person, at the clinic. That makes consent easy to record, and it's the cleanest of the three for this case.
- **Logout and timeout:** `client_session_timeout_days` is enforced as in Option A, and re-authentication is one fingerprint or face check. Staff can revoke a device.
- **APP 5 notice:** show on first login. It's the shortest of the three, because no new contact data is collected.
- **Technical check:** confirm Supabase Auth's passkey support for this flow. `config.toml` already lists `[auth.passkey]`, but enrolling a user who has no email needs proving.

## Common to all options

- `clients.auth_user_id` already exists. The draft access rules are in [supabase/migrations_phase3_draft/](../supabase/migrations_phase3_draft/). They are not applied.
- Clients see weights marked "Adjusted by your EP", never the override reason.
- The client screens from the mockup are not built. `app/(client)/` is a placeholder.
- Owner decisions are listed in [PRIVACY_CHECKLIST.md](PRIVACY_CHECKLIST.md).
