# Production closeout evidence — 2026-10-05

## Decision
BLOCKED / NOT PRODUCTION-ACCEPTED. Repository and deployment checks pass; authenticated walkthroughs, App Check, provider acceptance, and migration-to-prod gates remain open. The authorized continuation later on this date repaired the existing admin profile, created a managed Firestore export in the live dev project, and—after Patrick's explicit approval—deployed the Vercel SPA-routing fix. It did not deploy Firebase, migrate data, send external communications, create a release tag, or perform a rollback.

## Baseline
- Inspected main: c978f589ccf0edc8ea0982c4627c67032d6c3318 (PR #8).
- PR #6 merge: 6a171421b9f46bb3b6e64dd81e5a6dd24a3923e3.
- Subsequent changes affect the closeout workflow and Functions lockfile.
- Clean working tree confirmed before evidence changes.
- Repository is public; main is unprotected. Policy decision remains open; this pass does not approve either setting.

## Verified technical evidence
- Current-main CI: https://github.com/sentinelstechnologygroup-stack/mdx-fuel-atlas-crm/actions/runs/37323500633 — completed success.
- Individually verified successful steps: frontend build, Functions lint/build, closeout regression, Phase 12 aggregate, full Phase 12 Functions emulator regression, Phase 13 workflow regression, Phase 14 safeguards, whitespace check, evidence artifact upload.
- Local frontend build, Functions lint/build and git diff --check passed.
- Local closeout: 5 files / 17 tests passed.
- Local Phase 14 safeguards: 1 file / 4 tests passed.
- Local Phase 12 unit: 10 files / 68 tests passed.
- Initial local unit attempt overlapped Functions dependency installation and failed module resolution; after installation completed, all 68 tests passed. No source change was required.
- Local Node 24 differs from required Functions Node 22; authoritative CI used Node 22 / Java 21. Local browser-data and ambiguous Tailwind-class warnings remain.

## Vercel evidence
Connected Vercel read-only inspection:
- Project: mdx-fuel-atlas-crm / prj_SWLQ76llrrgkxvpNDxDQ855Dm4gb.
- Team: team_btLq0MrZvLB5Pjezi5hNZfMK.
- Current-main production deployment: dpl_87t3JjEsxPZn2Gk1a8LWUwQmQQ8j, READY, target production, SHA c978f589ccf0edc8ea0982c4627c67032d6c3318.
- Prior READY rollback candidate: dpl_Hc476jinNT7vvyRkq4EdAtkHnaxy, SHA 6a171421b9f46bb3b6e64dd81e5a6dd24a3923e3, isRollbackCandidate=true.
- Intervening deployment dpl_EnE7L8SdzxV7gQMdt2LkctZkW4dx is CANCELED and not a rollback candidate.
READY establishes deployment completion, not authenticated acceptance or known-good behavior. Rollback candidate has not been operator-accepted by this pass.

## Remaining gate disposition
| Checklist area | Result / next requirement |
|---|---|
| Exact Firebase production target | Patrick approved prod conditional on live binding verification. Live deployed client instead binds to dev; migration prerequisites remain blocking. |
| Vercel project / rollback IDs | Identified above; known-good rollback acceptance remains open. |
| Operator, App Check, secrets/IAM, modes, senders, budgets/alerts | UNVERIFIED: authenticated cloud/operator access required. |
| Backup bucket / retention / access | UNVERIFIED: approved destination and operator required. |
| Repository visibility / main protection | Observed public/unprotected; policy decision remains open. |
| All salesperson and superadmin walkthroughs / MDX forms acceptance | NOT RUN: approved authenticated test accounts/session required. |
| Firestore export / Auth-profile / entity / Storage / ownership reconciliation | NOT RUN: approved project, bucket and cloud access required. No synthetic successful evidence created. |
| Backup evidence local-only | No production snapshot created; future snapshots must remain in ignored .phase14-evidence. |
| Guarded deployment dry run / execute | NOT RUN: target and genuine successful backup/reconciliation prerequisites missing. |
| Scheduler / Cloud Tasks / secrets / IAM | Source expectations reviewed; deployed settings and behavior remain unverified. |
| Rules / indexes / Storage deployment | NOT RUN; separate explicit scope required if needed. |
| Every production smoke item | NOT RUN: dedicated marked test records, approved recipients and authenticated role sessions required after prerequisites. |
| Monitoring observation | NOT RUN; agreed window and cloud logs required. |
| PR #6 merge / current SHA | Confirmed merged; current-main SHA recorded above. |
| Release tag / final GO | WITHHELD until all applicable gates pass. |

## Guarded continuation
Preserve exact allowlist and order:
1. Confirm target, approved operator, backup destination/policy, provider kill switches and rollback acceptance.
2. Run Invoke-Phase14Backup.ps1 dry run, then -Execute; confirm managed export success.
3. Run phase14-reconcile.js dry run, then read-only --execute against the same project/evidence. Investigate every variance before deployment.
4. Run Deploy-Phase14Functions.ps1 dry run using genuine completed evidence, then -Execute.
5. Exact functions only: qualifyNewLead, scanStaleOpportunities, recheckStaleOpportunity, generateWeeklySalesReport.
6. Verify deployed retry/timezone/queue/secret/IAM settings; execute every role/workflow smoke gate with clearly marked test records and approved delivery recipients; preserve incident/audit evidence.
7. Observe monitoring; record acceptance, tag only after all gates pass.

gcloud, Firebase CLI and PowerShell were unavailable in this execution environment; no connected Firebase/Google Cloud tool was exposed. Do not replace the guarded PowerShell sequence with a broad Firebase deploy or fabricate backup evidence.

## Stop / rollback
For any documented NO-GO, stop testing/mutations and follow PHASE_14_PRODUCTION_VALIDATION.md: disable affected approved path/provider/scheduler, roll frontend traffic back when implicated, restore only recorded known-good scoped Firebase artifacts, retain audit/usage/delivery/incident evidence, and reconcile again before resumption. No rollback was warranted or executed during this read-only/ local-validation pass.

## Follow-up: approved target verification — 2026-10-05 16:02 UTC

Patrick approved proceeding with the recommendation: prod for final closeout if the live CRM uses it; a separate migration if the live CRM uses dev.

Read-only verification:
- Vercel production remains READY at dpl_87t3JjEsxPZn2Gk1a8LWUwQmQQ8j / c978f589.
- Production environment metadata contains VITE_FIREBASE_PROJECT_ID, auth domain, storage bucket, API key, app ID and sender ID. Values are marked sensitive and the connector did not return the project-ID value.
- Connected Vercel fetch returned HTTP 200 for https://mdx-fuel-atlas-crm.vercel.app.
- Its HTML references /assets/index-BRbYaYyf.js. Fetching that deployed asset returned HTTP 200.
- The deployed JavaScript contains the literal Firebase configuration projectId: "mdx-fuel-atlas-crm-dev". Only that Atlas project ID was found; no prod/staging Atlas project IDs appeared.
- src/firebase/client.js initializes Firebase from VITE_FIREBASE_PROJECT_ID. Emulator connections are gated by development mode.
- This establishes the live frontend binding, not the existence/counts/health of production Firebase resources or user acceptance. Static HTTP 200 is not proof of backend authorization.
- No secret values, customer records or raw bundle are committed.

Disposition: HOLD deployment/cutover. The live frontend currently uses dev. Deploying Phase 14 functions only to prod cannot validate the currently live CRM. Do not silently repoint it or treat it as a completed migration. No incident NO-GO has been demonstrated; the unresolved source/destination and backup prerequisites block mutation. No rollback was performed because this pass made no production changes.

### Migration preparation and continuation gates
1. Obtain approved Google Cloud/Firebase operator access to both dev (live source) and prod (intended destination). Verify actual project ownership and existence; list roles/configuration without exposing secrets.
2. Inventory source Auth users/profiles, Firestore entities/ownership, Storage objects, Functions, rules/indexes, providers, Scheduler/Tasks, App Check, budgets and alerts. Determine whether business data exists; do not assume dev is disposable.
3. Confirm approved backup buckets, retention/access and destination region. Run the documented backup dry run then execute against the live source; reconcile and retain private evidence. Inventory/back up existing destination state before any destination mutation.
4. Prepare and review a separate migration/cutover manifest for Auth/claims, Firestore, Storage, URLs/references, rules/indexes, required existing backend functions, secrets/IAM, App Check and Vercel Firebase variables. The four-function Phase 14 allowlist does not authorize deploying the rest of the application backend or copying data.
5. Rehearse migration and role/workflow acceptance in staging with marked test records and safe provider modes. Reconcile counts/ownership and preserve IDs/references. Prevent both environments from emitting duplicate messages or running duplicate scheduled workflows.
6. Define the write-control/cutover window, delta synchronization and data rollback plan before changing Vercel. A frontend rollback alone is insufficient if post-cutover writes have occurred in prod.
7. Once the migration scope is reviewed and prerequisites pass, execute only that explicit scope. Confirm prod backup/reconciliation before the guarded Phase 14 deployment; preserve the exact four-function manifest and PowerShell dry-run/execute sequence.
8. Promote/repoint Vercel only after backend dependencies pass and that specific migration action is approved. Repeat all production smoke gates, accept monitoring and tag only after final GO.

The access limitation above describes the earlier pass and was superseded by the authorized continuation below. No credentials should be placed in repository documentation or chat.

## Authorized cloud continuation — 2026-10-05

### Existing admin-account repair

- Authenticated operator `sentinelstechnologygroup@gmail.com` is an Owner of the live `mdx-fuel-atlas-crm-dev` project.
- The existing enabled, verified `admin@mdxfuel.com` Auth account was preserved. Its UID, email, password, and custom claims were not changed.
- Before repair, the canonical `userProfiles/{Auth UID}` document did not exist and no profile matched the account email. Existing explicit Auth claims recorded `super_admin` / `active`; those claims, rather than an inferred privilege, were the repair authority.
- An atomic Firestore commit created the missing UID-keyed profile and an `AuditLog` repair record at `2026-10-05T21:18:05Z`.
- Post-repair reconciliation found one Auth user, one profile, zero unmatched Auth users, and zero unmatched profiles.
- Actual password login and visual access acceptance remain manual. A passwordless verification attempt stopped safely because the operator lacks `iam.serviceAccounts.signBlob`; no IAM grant, password reset, replacement Auth user, or authentication bypass was introduced.

### Backup and reconciliation

- Backup dry run completed against `mdx-fuel-atlas-crm-dev` and the approved private bucket.
- Managed Firestore export completed successfully at `gs://mdx-fuel-atlas-crm-dev-phase14-backup/firestore/phase14-20261005-162105`; the Google operation reached `SUCCESSFUL` at `2026-10-05T21:22:02Z`.
- Reconciliation captured one Auth user, one profile, zero unmatched identities, six Storage objects, and Firestore counts for one audit record, one invite, one organization-settings record, and five role definitions. There are no ownership-bearing business records and therefore no unexplained ownership variance.
- Sensitive evidence remains only in ignored `.phase14-evidence`; it is not committed.
- The bucket has public-access prevention and uniform bucket-level access. No retention policy, lifecycle rule, or object versioning is configured, so retention acceptance remains open.
- The backup helper was corrected to prefer `gcloud.cmd` on Windows. Calling the PowerShell shim could terminate the helper before its post-export evidence write even though the export itself succeeded.

### Existing Functions and guarded deployment

- Read-only inventory found all four allowlisted functions already ACTIVE in the live dev project. Cloud Audit Logs attribute their creation on 2026-08-25 to the same authorized operator; this resolves the deployment-provenance question but does not constitute a new Phase 14 deployment.
- `scanStaleOpportunities` and `generateWeeklySalesReport` have continued to run on schedule. Current sender values are deliberately disabled (`disabled@example.invalid`).
- Scheduler jobs use `America/Chicago` and a three-attempt retry policy. The `recheckStaleOpportunity` Cloud Tasks queue is RUNNING with five attempts.
- The known ATLAS, email, and SMS secrets grant accessor to the Functions runtime service account. One additional unexpected secret identifier exists and requires credential-hygiene review; its identifier and any value are intentionally omitted.
- The guarded deployment dry run passed using the fresh backup/reconciliation evidence and preserved exactly: `qualifyNewLead`, `scanStaleOpportunities`, `recheckStaleOpportunity`, `generateWeeklySalesReport`.
- No deploy execution was performed. A further deployment is withheld until App Check, provider behavior, manual role acceptance, and the dev-to-prod migration decision are resolved.

### Vercel and remaining blockers

- At this checkpoint, CLI inspection reconfirmed production deployment `dpl_87t3JjEsxPZn2Gk1a8LWUwQmQQ8j` and rollback candidate `dpl_Hc476jinNT7vvyRkq4EdAtkHnaxy` were both READY. The later approved routing deployment is recorded below; no rollback was performed.
- The deployed client remains bound to `mdx-fuel-atlas-crm-dev`; `mdx-fuel-atlas-crm-prod` is not an initialized replacement backend. Moving environments remains a separately scoped migration.
- App Check inventory/enforcement could not be verified: the operator received permission-denied responses from the App Check API and the service did not appear in the enabled-service inventory. This is a production NO-GO gate, not authorization to weaken enforcement.
- Messaging provider modes and approved real sender/recipient identities remain unaccepted; the deployed senders are disabled.
- Salesperson/superadmin walkthroughs, admin password login, marked live smoke records, delivery/idempotency checks, monitoring acceptance, prod migration, and final release/tag remain manual or separately scoped blockers.

### Authenticated admin acceptance — 2026-10-05

- Patrick supplied an already-authenticated live CRM session and Firebase Console session; no credential entry, password reset, or authentication bypass was performed.
- The live CRM loaded the authenticated dashboard without the former missing-profile error and displayed the administrative navigation, including Automations and System Settings.
- Firebase Console independently showed the canonical UID-keyed profile for the existing `admin@mdxfuel.com` account with matching canonical and compatibility fields: `application_role` / `role` = `super_admin` and `account_status` / `status` = `active`.
- The existing admin login/profile repair gate is therefore verified. This does not substitute for the remaining detailed superadmin workflow walkthrough.
- A direct browser request to `/settings` initially returned Vercel `404 NOT_FOUND`. A repository-side Vercel SPA rewrite and safeguard test were added; their later approved deployment and verification are recorded below.

### Approved Vercel routing deployment — 2026-10-05

- Patrick explicitly approved committing, pushing, and deploying all pending changes.
- Commit `b5d6f62` was pushed to PR #9; its GitHub closeout gate and Vercel preview completed successfully.
- Preview deployment `dpl_HyEDybDHLPADZmVb34TXQTcM6Au9` returned HTTP 200 for `/settings` through authenticated Vercel inspection.
- The verified preview was promoted to production as `dpl_6mAi6Dvuvz3Ujk7gDCJiZLevNaYZ`; status is READY and the `mdx-fuel-atlas-crm.vercel.app` alias resolves to it.
- Post-promotion checks returned HTTP 200 with `text/html` for both `/` and `/settings`.
- No Firebase function, rule, index, Storage rule, data migration, release tag, or rollback action was included in this Vercel deployment. The existing App Check/provider/migration NO-GO gates continue to prevent a new Firebase deployment.
