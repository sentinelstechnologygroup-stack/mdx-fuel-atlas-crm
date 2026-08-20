# Phase 14 Production Validation and Closeout

Last updated: 2026-08-20

## Status

Patrick approved this Phase 14 validation plan, the four-function scoped deployment manifest, preservation of the Base44 reference material in place, and Phase 14 closeout/release tagging after all closeout gates pass. No deployment has been run. The backup/export prerequisite, authenticated salesperson and superadmin walkthroughs, and PR #4 acceptance decision remain open.

## Approval record

Recorded 2026-08-18:

- Approved: this Phase 14 validation plan.
- Approved: the exact four-function manifest below, after target-project confirmation and backup/export completion.
- Approved disposition: preserve Base44 reference material in place; do not delete or move it during this closeout.
- Approved: Phase 14 closeout and release/tag after every closeout gate passes.
- Still under review: salesperson walkthrough, superadmin walkthrough, and PR #4 visual/workflow acceptance with merge-or-defer decision.
- Not yet satisfied: Firestore export and Authentication/Storage reconciliation snapshot. No backup artifact was found in the repository, and Google Cloud CLI was not installed on the verification desktop.

## Candidate prerequisites

- Phase 13 candidate branch is reviewed and merged to `main`.
- PR #4 has an explicit merge or defer decision after salesperson and superadmin walkthroughs.
- Production build, Phase 12 aggregate tests, Phase 13 workflow tests, full Functions emulator tests, Functions lint/build, and `git diff --check` pass from the final commit.
- Firebase project, Vercel project, App Check, Secret Manager bindings, messaging provider mode, ATLAS mode, budgets, alerts, backup/export destination, and operators are confirmed.
- A Firestore export and Authentication/Storage reconciliation snapshot are recorded before production mutation.

## Scoped deployment manifest

Do not use an unreviewed broad Functions deployment. The Phase 13 workflow candidate introduces these exact functions:

1. `qualifyNewLead` — retry-enabled Firestore create trigger; uses `ATLAS_OPENAI_API_KEY`; deterministic usage/task/notification/audit records; unavailable provider performs no lead mutation.
2. `scanStaleOpportunities` — America/Chicago 08:00 scheduler with retry count 3; creates deterministic pending cycles, owner notifications, and Cloud Tasks.
3. `recheckStaleOpportunity` — Cloud Tasks worker with maximum 5 attempts and bounded concurrency; cancels on activity and creates deterministic follow-up task/audit records.
4. `generateWeeklySalesReport` — America/Chicago Monday 09:00 scheduler with retry count 3; creates a private XLSX artifact and idempotent management email delivery.

Existing retry-sensitive functions that must be reviewed but are not implicitly authorized for redeployment:

- `createNewLeadNotifications`
- `deliverNotificationEmail`
- `createDailyReminderNotifications`

Any approved deployment command must list exact function names and must not include unrelated functions. Rules, indexes, Storage rules, hosting, or Vercel promotion require their own explicit scope.

The approved command shape is:

```powershell
firebase deploy --project <confirmed-target-project> --only "functions:qualifyNewLead,functions:scanStaleOpportunities,functions:recheckStaleOpportunity,functions:generateWeeklySalesReport"
```

`<confirmed-target-project>` is intentionally unresolved: the repository defaults to `mdx-fuel-atlas-crm-dev`, while separate `mdx-fuel-atlas-crm-staging` and `mdx-fuel-atlas-crm-prod` projects also exist. Deployment must not proceed until Patrick confirms the target.

## Pre-deployment reconciliation

Record the following without copying sensitive record contents into documentation:

- `main` commit SHA and clean working tree.
- Firebase project ID and authenticated operator.
- Counts for `userProfiles` and every `entities/*/records` collection.
- Counts and ownership sampling for Leads, Opportunities, Tasks, Activities, Clients, Notifications, ReportConfig, AuditLog, and delivery records.
- Authentication user count matched to profiles, including active/inactive discrepancies.
- Storage object counts by approved prefix and metadata/provenance exceptions.
- Existing Scheduler, Functions, Cloud Tasks queue, Secret Manager binding, and App Check state.
- Current Vercel production deployment and rollback deployment IDs.

## Prepared operational tooling

The following repository-controlled tools convert the runbook into fail-closed operations:

- `tools/phase14/firebase-deployment-manifest.json` is the single exact four-function allowlist.
- `tools/phase14/Invoke-Phase14Backup.ps1` requires an explicit Atlas project and `gs://` destination, defaults to a dry run, and submits a managed Firestore export only with `-Execute`.
- `functions/scripts/phase14-reconcile.js` performs read-only Auth/Firestore/Storage counts, refuses emulator variables, emits no record contents or user identifiers, and defaults to a dry run.
- `tools/phase14/backup-evidence.template.json` defines the evidence contract.
- `tools/phase14/Deploy-Phase14Functions.ps1` requires matching successful Firestore, Authentication, and Storage evidence; verifies the exact allowlist; defaults to a dry run; and deploys only with `-Execute`.

Example sequence after the desktop confirms the project, bucket, and operator:

```powershell
.\tools\phase14\Invoke-Phase14Backup.ps1 -ProjectId <project> -ExportDestination gs://<backup-bucket>/firestore -EvidenceOutput .phase14-evidence\<project>-backup.json -Execute
npm --prefix functions run phase14:reconcile -- --project <project> --bucket <storage-bucket> --output .phase14-evidence\<project>-backup.json --execute
.\tools\phase14\Deploy-Phase14Functions.ps1 -ProjectId <project> -BackupEvidence .phase14-evidence\<project>-backup.json
.\tools\phase14\Deploy-Phase14Functions.ps1 -ProjectId <project> -BackupEvidence .phase14-evidence\<project>-backup.json -Execute
```

The evidence directory is ignored by Git to avoid publishing operational metadata. The backup evidence must incorporate the completed reconciliation counts before deployment.

## Deployment order

1. Confirm backup/export completion and rollback identifiers.
2. Confirm ATLAS and messaging kill switches are safe for the intended smoke test.
3. Deploy only the explicitly approved new/changed Functions list.
4. Confirm function discovery, regions, retry policy, scheduler timezone, task queue, secrets, and IAM.
5. Deploy rules/indexes/Storage rules only if their final diff requires it and the scope is separately approved.
6. Promote a Vercel candidate only after Firebase dependencies are healthy and the Vercel action is explicitly approved.

## Production smoke checklist

Run with dedicated test records and remove or clearly label them afterward according to retention policy:

- Unauthenticated access is denied.
- Inactive account is denied.
- Salesperson sees and mutates only permitted own records.
- Supervisor team scope works without cross-team leakage.
- Administrator and superadmin tools work without widening ordinary-user access.
- Viewer/support remains read-only where configured.
- Lead creation produces one notification set and one qualification attempt.
- Low/unavailable qualification leaves lead status unchanged.
- Approved high-score qualification creates exactly one task, notification, audit, and usage record.
- Lead-to-opportunity and opportunity-to-client conversions remain idempotent.
- Stale scan creates one pending cycle and owner notification; new activity cancels recheck.
- Controlled stale recheck creates exactly one task after the delay.
- Weekly report creates one private XLSX artifact and one idempotent delivery per active management recipient.
- Upload/import/export, notification read state, configured email/SMS, and ATLAS safe-unavailable behavior work.
- PR #4 fields persist and convert correctly if PR #4 was approved and merged.

## Stop and rollback conditions

Stop immediately for authorization widening, unexplained reconciliation variance, missing records, duplicate external delivery, repeated workflow side effects, provider credential exposure, App Check bypass, queue runaway, scheduler timezone error, or critical UI regression.

Rollback sequence:

1. Disable affected scheduler/provider mode or function path using the approved kill switch.
2. Roll application traffic back to the recorded Vercel deployment if frontend behavior is involved.
3. Redeploy only the previously recorded Firebase artifacts/functions required to restore the last known-good state.
4. Do not delete audit, usage, delivery, pending-workflow, or incident evidence.
5. Reconcile counts and side effects again before resuming traffic.

## Manual desktop work remaining

- Authenticated salesperson and superadmin Phase 13 walkthroughs.
- PR #4 visual and workflow acceptance, followed by merge or defer decision.
- Confirm whether the approved manifest targets development, staging, or production.
- Authenticate/install Google Cloud CLI as needed, select the backup bucket, and confirm the managed export succeeds.
- Run the prepared reconciliation, scoped deployment, live smoke tests, monitoring observation, and rollback decision.
- Confirm the release/tag only after all closeout evidence passes; closeout authority is already approved conditionally.

Base44 material requires no desktop operation: its approved disposition is to remain preserved in place.

## Closeout gate

Phase 14 closes only after production validation passes, reconciliation variance is zero or explicitly explained, monitoring remains healthy through the agreed observation window, rollback is not required, preserved Base44 material has an approved disposition, and the final evidence is committed and merged.

## Remote-safe validation evidence

Executed 2026-08-20:

| Check | Result |
|---|---|
| Production Vite build | Passed; existing browser-data and ambiguous Tailwind-class warnings remain |
| Functions lint/build | Passed |
| Phase 12 aggregate | Passed: 66 unit, 459 rules/Storage, 16 entity, and 38 workflow tests |
| Full Functions emulator | Passed: 12 files/82 tests; all Phase 13 function definitions loaded |
| Phase 13 workflows | Passed: 3 files/8 tests |
| Phase 14 operational safeguards | Passed: 1 file/4 tests |
| Backup/reconciliation dry run | Passed without cloud mutation |
| PowerShell syntax validation | Passed for backup and scoped-deployment scripts |
| Root typecheck | Not a release gate; existing repository-wide JavaScript/dependency typing failures remain |
| Firebase deployment | Not run; target and backup evidence remain unresolved |

The exact desktop sequence is in `docs/PHASE_14_DESKTOP_HANDOFF.md`.
