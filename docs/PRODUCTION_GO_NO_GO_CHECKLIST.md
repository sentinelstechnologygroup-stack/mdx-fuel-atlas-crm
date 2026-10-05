# MDX Fuel ATLAS CRM — Production GO / NO-GO Checklist

Last updated: 2026-10-05

Current-main verification: `c978f589ccf0edc8ea0982c4627c67032d6c3318`. See [October 5 closeout evidence](PRODUCTION_CLOSEOUT_EVIDENCE_2026-10-05.md). Status: **BLOCKED — operational acceptance remains open**. Checked items below reflect only verified facts; they do not authorize final GO.

This checklist contains only the remaining human/operator gates after repository-side closeout work. The authoritative technical runbook remains `docs/PHASE_14_PRODUCTION_VALIDATION.md`.

## Release candidate

- Original release branch: `release/mdx-atlas-production-closeout`; now merged to `main`.
- Pull request: #6 — MDX ATLAS CRM production closeout
- Temporary authentication bypass PR #5: closed
- MDX forms PR #4: technically reconciled and closed as superseded
- Base44 runtime dependency: none identified by repository search
- Production authentication: present on release candidate
- Broad Firebase Functions deployment: prohibited

## Manual prerequisites

- [ ] Confirm exact Firebase production project ID.
- [x] Confirm Vercel production project and current rollback deployment.
- [x] Confirm approved operator account.
- [ ] Confirm App Check production-domain registration/enforcement plan.
- [x] Confirm Secret Manager bindings for ATLAS, email, and SMS.
- [ ] Confirm messaging provider modes and sender identities.
- [ ] Confirm backup bucket and retention/access policy.
- [ ] Decide repository visibility and final `main` protection policy.

## Authenticated walkthroughs

### Salesperson
- [ ] Login/session works.
- [ ] Own-record Lead access is correct.
- [ ] Lead create/edit/reassign limitations are correct.
- [ ] Lead board movement persists after refresh.
- [ ] Tasks and Activities work.
- [ ] Opportunity conversion works.
- [ ] Customer/account views are appropriate.
- [ ] Reports reflect permitted data.
- [ ] ATLAS cannot reveal restricted records.
- [ ] Admin-only controls are unavailable.

### Superadmin
- [ ] Login/session works.
- [ ] User administration works.
- [ ] Role/permission overrides work.
- [ ] Lead reassignment works.
- [ ] Reporting and audit views work.
- [ ] Automation/configuration views work.
- [ ] ATLAS/admin functionality respects intended boundaries.

## Backup and reconciliation

Run the documented Phase 14 backup dry run, then execute it.

- [x] Managed Firestore export succeeds.
- [x] Auth user count reconciles to user profiles.
- [x] Firestore entity counts are captured.
- [x] Storage object counts are captured.
- [x] No unexplained ownership/record variance exists.
- [x] Evidence file is local only and is not committed.
- [x] Current Vercel production and rollback IDs are recorded.

## Controlled deployment

Only after backup/reconciliation passes:

- [x] Run `Deploy-Phase14Functions.ps1` dry run.
- [x] Confirm exact live target project (`mdx-fuel-atlas-crm-dev`; migration to prod remains separate).
- [x] Confirm exact allowlist:
  - `qualifyNewLead`
  - `scanStaleOpportunities`
  - `recheckStaleOpportunity`
  - `generateWeeklySalesReport`
- [ ] Execute guarded deployment.
- [x] Verify Scheduler timezone/retry settings.
- [x] Verify Cloud Tasks queue configuration.
- [x] Verify provider secrets and IAM bindings (one unexpected secret identifier remains a hygiene blocker).
- [ ] Deploy rules/indexes/Storage rules only if separately required and approved.

## Production smoke test

Use dedicated clearly marked test records.

- [ ] Anonymous access denied.
- [ ] Inactive account denied.
- [ ] Salesperson scope correct.
- [ ] Supervisor team scope correct.
- [ ] Admin/superadmin scope correct.
- [ ] Viewer/support remains read-only.
- [ ] Lead create produces one notification/qualification cycle.
- [ ] Qualified lead produces exactly one task/notification/audit/usage record.
- [ ] Lead-to-opportunity conversion is idempotent.
- [ ] Opportunity-to-customer conversion is idempotent.
- [ ] Stale-opportunity cycle behaves correctly.
- [ ] New activity cancels pending stale recheck.
- [ ] Weekly XLSX report is private and delivered once per approved recipient.
- [ ] Email/SMS work without duplicate delivery.
- [ ] File upload/import/export works.
- [ ] Reports reconcile to the production test records exactly.
- [ ] ATLAS authorized context works and restricted context is denied.

## Stop / rollback

NO-GO immediately for:

- authorization widening
- cross-user data exposure
- missing or unexplained records
- reconciliation variance
- duplicate external communications
- repeated workflow side effects
- App Check bypass
- provider secret exposure
- runaway Scheduler/Cloud Tasks behavior
- timezone errors
- material reporting inaccuracy
- critical Lead/Opportunity/Customer regression

If any NO-GO condition occurs, execute the rollback procedure in `docs/PHASE_14_PRODUCTION_VALIDATION.md`.

## Final GO

Only after every applicable item above passes:

- [ ] Production reconciliation is clean.
- [ ] Monitoring observation is accepted.
- [ ] PR #6 CI is green.
- [x] PR #6 is marked ready and merged to `main`.
- [x] Current inspected `main` SHA is recorded; final accepted release SHA remains pending.
- [ ] Release tag is created.
- [x] Phase 14 closeout evidence is updated without secrets/customer data.
- [ ] MDX Fuel ATLAS CRM is declared production-ready.
