# Workflow Parity Matrix

Status values: `Legacy`, `In progress`, `Verified`, `Approved for cutover`, `Retired by approval`.

| Workflow | Trigger and schedule | Legacy steps | Independent target | Required verification | Status |
|---|---|---|---|---|---|
| New Lead Qualification | Lead create | `scoreNewLead` → threshold 70 → `handleHighScoreLead` | Firestore trigger plus trusted ATLAS scoring and atomic task/notification/status update | low/high scores, missing discovery data, permission context, idempotency, AI usage/cost record, retry behavior | Legacy |
| Stale Opportunity Follow-up | Daily 08:00 America/Chicago | `findStaleOpportunities` → wait 3 days → `recheckAndFollowUp` | Scheduler + Cloud Tasks delayed recheck | 14-day boundary, activity cancellation, owner notification, exactly-once follow-up task, timezone/DST, retry/dead-letter, AI audit | Legacy |
| Weekly Sales Report | Monday 09:00 America/Chicago | `generateWeeklySalesReport` → `emailReportSummary` | Scheduler + report service + export service + email provider | recipient authorization, figures/export parity, Monday timezone/DST, email result, retry/idempotency, audit | Legacy |

## Integration parity register

| Capability | Observed legacy API | Replacement phase | Status |
|---|---|---:|---|
| Authentication/session | `base44.auth.*` | 2 | Legacy |
| Entity CRUD/query/schema | `base44.entities.*` | 3–8 | Legacy |
| Privileged functions | `base44.functions.invoke` | 2–10 | Legacy |
| File upload | `Core.UploadFile` | 9 | Legacy |
| Structured file extraction | `Core.ExtractDataFromUploadedFile` | 9/11 | Legacy |
| Email | `Core.SendEmail` | 9 | Legacy |
| SMS | `Core.SendSMS` | 9 or approved scope decision | Legacy |
| General AI | `Core.InvokeLLM` | 11 | Legacy |
| Image generation | `Core.GenerateImage` | 11 or approved retirement | Legacy |
| Conversation agent | `base44.agents.*` / `SalesAssistant` | 11 | Legacy |
| App usage logging | `base44.appLogs.*` | 1/8 | Legacy |

No row may be marked Verified without linked test evidence and permission checks.

