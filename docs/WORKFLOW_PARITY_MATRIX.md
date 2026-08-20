# Workflow Parity Matrix

Status values: `Legacy`, `In progress`, `Verified`, `Approved for cutover`, `Retired by approval`.

| Workflow | Trigger and schedule | Legacy steps | Independent target | Required verification | Status |
|---|---|---|---|---|---|
| New Lead Qualification | Lead create | `scoreNewLead` → threshold 70 → `handleHighScoreLead` | `qualifyNewLead` Firestore trigger plus trusted ATLAS scoring and atomic task/notification/status/audit update | Focused Phase 13 emulator tests pass for high, low, unavailable-provider, and retry/idempotency paths; full trigger and approved production activation remain | In progress |
| Stale Opportunity Follow-up | Daily 08:00 America/Chicago | `findStaleOpportunities` → wait 3 days → `recheckAndFollowUp` | `scanStaleOpportunities` scheduler + deterministic Cloud Tasks dispatch to `recheckStaleOpportunity` | Focused Phase 13 emulator tests pass for stale selection, notification, queue idempotency, activity cancellation, unavailable-ATLAS fallback, and exactly-once task creation; deployed scheduler/task acceptance remains | In progress |
| Weekly Sales Report | Monday 09:00 America/Chicago | `generateWeeklySalesReport` → `emailReportSummary` | `generateWeeklySalesReport` scheduler + controlled report/XLSX service + idempotent email delivery | Focused Phase 13 emulator tests pass for America/Chicago week key, management recipients, figures/export generation, delivery, and idempotency; deployed scheduler/provider acceptance remains | In progress |


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
| Privileged functions | `legacy_provider.functions.invoke` | 2-10 | Verified locally with focused direct/emulator tests; the full Phase 12 Functions emulator callable/trigger suite passed; no broad production deploy authorized |
| File upload | `Core.UploadFile` | 9 | Verified locally - Firebase Storage rules cover owner paths, metadata, MIME type, size limits, generated image provenance, and cross-user denial |
| Structured file extraction | `Core.ExtractDataFromUploadedFile` | 9/11 | Verified — owned CSV/text/Excel extraction and negative authorization tests pass locally |
| Email | `Core.SendEmail` | 9 | Verified locally - provider abstraction, safe-disabled runtime config, idempotent delivery records, notification delivery bridge, and automation email routing covered by tests |
| SMS | `Core.SendSMS` | 9 or approved scope decision | Verified locally - optional Twilio provider path, safe-disabled config, idempotency, retry metadata, and callable validation covered by tests |
| General AI | `Core.InvokeLLM` | 11 | Verified — provider contract, structured output, authorization, auditing, rate-limit, failure, and frontend safe-state tests pass locally |
| Image generation | `Core.GenerateImage` | 11 or approved retirement | Verified — provider contract, private Storage persistence, provenance, ownership, and forgery-denial tests pass locally |
| Conversation agent | `legacy_provider.agents.*` / `SalesAssistant` | 11 | Verified — stateless bounded ATLAS adapter and authenticated safe-unavailable UI behavior verified locally |
| App usage logging | `legacy_provider.appLogs.*` | 1/8 | Retired by Phase 13 scope decision: repository scan found no callers; the Firebase compatibility facade remains a no-network no-op returning `logged: false`, avoiding a new employee telemetry/retention store |

## Phase 13 cutover checkpoint

The repository-wide Phase 13 scan initially confirmed that all three workflow rows remained preserved Base44 reference implementations. All three now have Firebase-native implementations and focused local evidence, but none is deployed or approved for cutover. The preserved Base44 project is currently under `atlas/`; it is reference material and must remain unmoved until every replacement or retirement is accepted. See `docs/PHASE_13_CUTOVER_PLAN.md` for the dependency register, retry review, PR #4 findings, rollback runbook, and exit gates.

No row may be marked Verified without linked test evidence and permission checks.
