# RepRx privacy checklist: owner actions

The developer can surface these items, but the practice owns them. They are obligations under the *Privacy Act 1988* (Cth) and the Australian Privacy Principles (APPs). RepRx holds names, class types such as "Cardiac Rehab", and strength data, which together are health information about identifiable people.

This is a working list, not legal advice.

## Before any real client is entered

- [ ] **Privacy policy (APP 1).** Publish a policy that covers RepRx, and give the developer the link for the app footer.
- [ ] **Collection notice (APP 5).** Confirm the practice's existing notice covers strength testing data and the fact that it's stored in Australian cloud services (Supabase, Vercel).
- [ ] **Data breach response plan.** Write a runbook for the Notifiable Data Breaches scheme: who decides, how a breach is assessed within 30 days, and how the OAIC and affected people are notified.
- [ ] **Vendor review.** Keep the Supabase and Vercel data-processing terms on file. Confirm the Sydney regions: Supabase ap-southeast-2 and Vercel syd1.
- [ ] **Confirm retention.** Decide the retention period (default 7 years after last activity). Confirm how it fits the practice's record-keeping duties, including any longer periods for children's records.
- [ ] **Confirm session timeouts.** Decide the staff timeout (default 12 hours).
- [ ] **Staff training.** Tell staff that override reasons are brief training notes only, and that clinical notes belong in Cliniko.
- [ ] **Offboarding.** Add "deactivate in RepRx" to the staff leaving checklist.

## Before Phase 2 (Cliniko)

- [ ] **Least-privilege Cliniko user.** Create a dedicated Cliniko user for the API key, with only the access it needs.
- [ ] **Sandbox.** Provide a Cliniko sandbox or trial account for Preview deployments, so the live account is never used there.

## Before Phase 3 (client logins)

- [ ] **First-login collection notice (APP 5).** Approve the wording shown to clients on first login.
- [ ] **Carers and NDIS clients.** Decide who may access a client's program when a carer helps them.
- [ ] **Login method.** Choose an option from [PHASE3_AUTH_OPTIONS.md](PHASE3_AUTH_OPTIONS.md).

## Ongoing

- [ ] **Quarterly restore drill.** Restore a production backup to a scratch project, and record the date and result.
- [ ] **Access review.** Check the staff list in RepRx each quarter.
- [ ] **Printed session sheets.** They name clients and class types. Store and shred them like any other client record.
