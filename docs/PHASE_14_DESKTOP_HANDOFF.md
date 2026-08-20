# Phase 14 Desktop-Only Handoff

Last updated: 2026-08-20

All target-independent implementation, operational scripting, documentation, and automated local validation is complete. Perform the following only from Patrick's authenticated desktop session.

## 1. Finish the three review decisions

1. Complete the salesperson walkthrough.
2. Complete the superadmin walkthrough.
3. Review PR #4 visually and choose merge or defer. If merging, rebase it onto the Phase 13 candidate, rerun its focused conversion test and full gates, then merge only after Patrick accepts the result.

## 2. Confirm the Firebase target

Choose exactly one initial target:

- `mdx-fuel-atlas-crm-dev`
- `mdx-fuel-atlas-crm-staging`
- `mdx-fuel-atlas-crm-prod`

Do not rely on `.firebaserc`; its default is development. Every Phase 14 command must contain the explicit selected project.

## 3. Install/authenticate Google Cloud CLI

The verification desktop did not have `gcloud`. Install the official Google Cloud CLI, authenticate the approved operator, and verify access without printing tokens:

```powershell
gcloud auth list
gcloud projects describe <project>
gcloud storage buckets list --project=<project>
```

Select or create an approved backup bucket in a policy-compliant location with appropriate retention and access controls. Bucket creation is not pre-authorized by this runbook.

## 4. Create backup and reconciliation evidence

Run the backup dry run first, then the executable form:

```powershell
.\tools\phase14\Invoke-Phase14Backup.ps1 -ProjectId <project> -ExportDestination gs://<backup-bucket>/firestore -EvidenceOutput .phase14-evidence\<project>-backup.json
.\tools\phase14\Invoke-Phase14Backup.ps1 -ProjectId <project> -ExportDestination gs://<backup-bucket>/firestore -EvidenceOutput .phase14-evidence\<project>-backup.json -Execute
```

Run read-only Auth/Firestore/Storage reconciliation into the same evidence file:

```powershell
npm --prefix functions run phase14:reconcile -- --project <project> --bucket <storage-bucket> --output .phase14-evidence\<project>-backup.json
npm --prefix functions run phase14:reconcile -- --project <project> --bucket <storage-bucket> --output .phase14-evidence\<project>-backup.json --execute
```

Inspect the evidence locally. Stop for an unexpected project, incomplete export, unmatched Auth/profile counts, unexplained entity variance, or Storage discrepancy. Never commit `.phase14-evidence/`.

## 5. Run final candidate gates

From the final merged candidate commit:

```powershell
npm run build
npm --prefix functions run lint
npm --prefix functions run build
npm run test:phase12
npm run test:phase12:functions-emulator
npm run test:phase13
npm run test:phase14:operations
git diff --check
```

The root `npm run typecheck` has pre-existing repository-wide JavaScript/dependency typing failures and is not a Phase 13/14 release gate. Do not misreport it as passing.

## 6. Preview and perform the scoped deployment

The first command is dry-run validation and performs no deployment:

```powershell
.\tools\phase14\Deploy-Phase14Functions.ps1 -ProjectId <project> -BackupEvidence .phase14-evidence\<project>-backup.json
```

After confirming the printed project, backup URI, and exact four targets, execute:

```powershell
.\tools\phase14\Deploy-Phase14Functions.ps1 -ProjectId <project> -BackupEvidence .phase14-evidence\<project>-backup.json -Execute
```

Never replace this with `firebase deploy --only functions`. The script refuses evidence from another project and refuses incomplete Firestore/Auth/Storage evidence.

## 7. Validate and close

Complete every production smoke item in `PHASE_14_PRODUCTION_VALIDATION.md`, reconcile counts again, observe Scheduler/Tasks/Functions/provider behavior, and apply the documented stop/rollback criteria. Only after the observation window is accepted:

1. Record final evidence without secrets or customer data.
2. Confirm Base44 reference material remains preserved in place.
3. Merge the Phase 13/14 candidate.
4. Create the approved release tag from the final verified `main` commit.

Phase 14 is not closed merely because the four functions deployed; the walkthrough, reconciliation, smoke, monitoring, PR #4 decision, merge, and final tag gates must all be resolved.
