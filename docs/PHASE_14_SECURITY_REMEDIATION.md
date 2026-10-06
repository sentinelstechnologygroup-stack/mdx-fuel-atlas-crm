# Phase 14 security remediation plan

Last verified: 2026-10-05

## Verified state

- The live frontend uses `mdx-fuel-atlas-crm-dev`.
- No App Check provider is registered for the web app and the App Check API is not enabled in the project service inventory.
- Anonymous Firestore and Storage requests are rejected with HTTP 403.
- The active Firestore and Storage rulesets exactly match `firestore.rules` and `storage.rules`.
- The deployed composite-index and field-override configuration exactly matches `firestore.indexes.json` (both are empty).
- The four guarded Functions produced zero ERROR-level log entries in the last 30 days.
- Their implementation files match the deployed source. The only source-archive difference is the unrelated `createAtlasPortalSession` export in the shared index, so another guarded deployment is not required.
- The default Functions runtime service account has `roles/editor`, plus Eventarc receiver and Cloud Run invoker. `roles/editor` is broader than required.
- The three expected provider secrets grant accessor only to the runtime service account. One unexpected secret has no accessor and no enabled version; it remains a hygiene item and is not named here.
- The project has no Monitoring alert policies or notification channels. The Cloud Billing Budget API is disabled, so budget state could not be read.

## App Check remediation

1. Create a reCAPTCHA Enterprise web key restricted to the accepted CRM domains.
2. Register the existing Firebase web app with App Check using that key.
3. Add a public `VITE_FIREBASE_APPCHECK_SITE_KEY` setting to the appropriate Vercel environments. The secret/private key remains Google-managed and must not enter the repository.
4. Initialize Firebase App Check before Firestore, Storage, or callable Functions are used, with automatic token refresh enabled.
5. Use App Check debug tokens only for local development and CI; keep them out of Git and production Vercel variables.
6. Deploy to preview with enforcement off and monitor verified/unverified request metrics.
7. Repeat the salesperson and superadmin critical paths in preview.
8. Enable enforcement for Firestore and Storage only after legitimate preview traffic is verified.
9. Enable callable-Function enforcement individually where supported. Scheduled, task-queue, and Firestore-trigger Functions are not browser entry points and must retain their service-to-service controls.
10. Monitor for at least one agreed observation window. If legitimate clients are rejected, disable the affected enforcement gate, retain the evidence, correct registration/client initialization, and retest.

App Check augments Authentication and default-deny Security Rules; it does not replace either control.

## IAM remediation

1. Inventory every Firebase Function by data/service dependency.
2. Create dedicated runtime service accounts by trust boundary rather than sharing the default Compute service account.
3. Grant only the Firestore, Auth, Storage, Cloud Tasks, logging, and per-secret permissions each function actually requires.
4. Deploy one low-risk function to the dedicated account in a controlled window and verify its complete workflow.
5. Move the remaining functions in small groups with log monitoring and rollback points.
6. Remove `roles/editor` from the default runtime account only after no deployed function depends on it.

Do not remove `roles/editor` first; doing so could break existing production Functions.

## Monitoring and budget remediation

Patrick must choose the monthly budget amount, threshold percentages, and recipient addresses. Codex can then:

1. Enable the Cloud Billing Budget API.
2. Create threshold notifications (recommended starting points: 50%, 80%, 100%, and forecasted 100%).
3. Create Monitoring notification channels.
4. Add alert policies for Function errors, Cloud Run 5xx responses, task retries/exhaustion, Scheduler failures, and abnormal invocation volume.
5. Run a controlled notification test and record delivery evidence.

## Production test-record convention

Use records prefixed with `PH14-YYYYMMDD` so they can be isolated and reconciled:

- Lead: `PH14-YYYYMMDD-LEAD-01`
- Opportunity: `PH14-YYYYMMDD-OPP-01`
- Customer: `PH14-YYYYMMDD-CUSTOMER-01`
- Task/activity: `PH14-YYYYMMDD-TASK-01`
- Report: `PH14-YYYYMMDD-REPORT-01`

Record the creator, expected owner, expected side effects, approved delivery recipient, start time, and final disposition before each test.
