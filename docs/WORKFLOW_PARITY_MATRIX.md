# Workflow Parity Matrix

Status values: `Legacy`, `In progress`, `Verified`, `Approved for cutover`, `Retired by approval`.

| Workflow | Trigger and schedule | Legacy steps | Independent target | Required verification | Status |
|---|---|---|---|---|---|
| New Lead Qualification | Lead create | `scoreNewLead` → threshold 70 → `handleHighScoreLead` | Firestore trigger plus trusted ATLAS scoring and atomic task/notification/status update | low/high scores, missing discovery data, permission context, idempotency, AI usage/cost record, retry behavior | Legacy |
| Stale Opportunity Follow-up | Daily 08:00 America/Chicago | `findStaleOpportunities` → wait 3 days → `recheckAndFollowUp` | Scheduler + Cloud Tasks delayed recheck | 14-day boundary, activity cancellation, owner notification, exactly-once follow-up task, timezone/DST, retry/dead-letter, AI audit | Legacy |
| Weekly Sales Report | Monday 09:00 America/Chicago | `generateWeeklySalesReport` → `emailReportSummary` | Scheduler + report service + export service + email provider | recipient authorization, figures/export parity, Monday timezone/DST, email result, retry/idempotency, audit | Legacy |


## Phase 2 checkpoint evidence

- Firebase email/password authentication and own-profile lookup were verified against local emulators.
- Active and inactive employee-profile behavior is covered by deterministic fixtures.
- Firestore profile rules passed 33 automated tests.
- The Firebase-authenticated dashboard is not approved for cutover because CRM entities still use legacy provider.
- No legacy provider authentication or entity path is retired by the Phase 2 checkpoint.
- Full application functionality must remain available until each replacement row reaches verified parity and receives cutover approval.

## Integration parity register

| Capability | Observed legacy API | Replacement phase | Status |
|---|---|---:|---|
| Authentication/session | `legacy_provider.auth.*` | 2 | Verified locally - Firebase Auth, own-profile lookup, active/inactive behavior, and user directory callables covered by emulator tests; production state follows Phase 11 closeout |
| Entity CRUD/query/schema | `legacy_provider.entities.*` | 3-8 | Verified locally - Firestore entity adapter, scoped queries, ownership rules, configuration rules, notifications, and module permission tests are in the Phase 12 emulator suite |
| Privileged functions | `legacy_provider.functions.invoke` | 2-10 | Verified locally with focused direct/emulator tests; Functions-emulator-only callable and trigger rerun is pending harness resolution; no broad production deploy authorized |
| File upload | `Core.UploadFile` | 9 | Verified locally - Firebase Storage rules cover owner paths, metadata, MIME type, size limits, generated image provenance, and cross-user denial |
| Structured file extraction | `Core.ExtractDataFromUploadedFile` | 9/11 | Verified — owned CSV/text/Excel extraction and negative authorization tests pass locally |
| Email | `Core.SendEmail` | 9 | Verified locally - provider abstraction, safe-disabled runtime config, idempotent delivery records, notification delivery bridge, and automation email routing covered by tests |
| SMS | `Core.SendSMS` | 9 or approved scope decision | Verified locally - optional Twilio provider path, safe-disabled config, idempotency, retry metadata, and callable validation covered by tests |
| General AI | `Core.InvokeLLM` | 11 | Verified — provider contract, structured output, authorization, auditing, rate-limit, failure, and frontend safe-state tests pass locally |
| Image generation | `Core.GenerateImage` | 11 or approved retirement | Verified — provider contract, private Storage persistence, provenance, ownership, and forgery-denial tests pass locally |
| Conversation agent | `legacy_provider.agents.*` / `SalesAssistant` | 11 | Verified — stateless bounded ATLAS adapter and authenticated safe-unavailable UI behavior verified locally |
| App usage logging | `legacy_provider.appLogs.*` | 1/8 | Gap documented - app usage logging remains reference-only/unreplaced unless explicitly retired or implemented before Phase 13 |

No row may be marked Verified without linked test evidence and permission checks.
