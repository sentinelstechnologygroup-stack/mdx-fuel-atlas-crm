# Phase 13 Controlled Base44 Cutover

Last updated: 2026-08-20

## Baseline and authority

- Phase 13 branch: `migration/phase-13-controlled-base44-cutover`
- Baseline: `57fbf374953150e2d9560bcb5aeac7aa11739f40`
- Phase 12 PR #3: merged
- PR #4 remains a separate draft on `followup/mdx-fuel-forms-walkthrough` at `0ee770b`; it is not merged or included in this branch.
- Patrick approved the Phase 14 four-function manifest on 2026-08-18, conditional on target-project confirmation and successful backup/reconciliation evidence.
- No broad Functions deployment, unrelated retry-policy activation, Base44 reference movement, or historical deletion is authorized.

## Current decision

**No-go for production cutover until the remaining gates pass.** Firebase-backed entity, authorization, file, messaging, notification, conversion, automation, ATLAS, and all three preserved workflow paths now have local implementations and automated evidence. The exact four-function Phase 14 manifest is approved but remains undeployed pending target-project confirmation and backup/reconciliation evidence. Unused legacy app usage logging is retired by scope decision without creating a replacement employee telemetry store; the no-network compatibility stub remains. Base44 material has an approved preserve-in-place disposition. PR #4 remains separate, and authenticated visual walkthroughs remain open.

## Dependency disposition register

| Area | Current location | Runtime classification | Phase 13 disposition |
|---|---|---|---|
| Firebase application facade | `src/api/atlasClient.js` | Active Firebase runtime | Keep; entities, auth, callables, ATLAS, and safe-disabled app logging route through Firebase |
| `Core.*` compatibility facade | `src/api/integrations.js` and frontend callers | Active compatibility names; supported methods route to `invokeAtlasAi` or messaging | Keep until call sites are renamed and regression-tested; names are not evidence of a Base44 network dependency |
| `SalesAssistant*` React files | `src/components/ai/` | Active UI components with legacy internal names; user-facing identity is ATLAS | Rename only in a focused, tested cleanup after workflow closure |
| `SalesAssistant` agent identifier | `src/components/ai/atlasConfig.js`, conversation request | Compatibility metadata sent through the Firebase ATLAS adapter | Keep until the callable contract is updated and tested; never expose it to users |
| Preserved Base44 project | `atlas/` | Reference schemas, workflows, functions, agent, and reference client; not imported by the production source/build configuration found in the Phase 13 scan | Preserve in place. Do not rename, move, or delete before replacements are accepted and Patrick approves retirement |
| Historical documentation | `docs/` and baseline tags | Evidence only | Preserve permanently as migration history |
| App usage logging | `atlas.appLogs.logUserInApp` | No callers found; no-network Firebase stub returning `logged: false` | Retired by scope decision; retain the compatibility stub until final cleanup so historical imports cannot generate network failures |
| Base44 packages/environment | root and Functions package manifests, Vite/Firebase configuration | No Base44 package or active Base44 environment dependency found | Recheck after all cleanup with repository-wide scans and production build |

## Production-critical path audit

| Path | Firebase implementation/evidence | State |
|---|---|---|
| Authentication and profiles | Firebase Auth, `userProfiles`, active/inactive enforcement, emulator fixtures | Verified locally in Phase 12 |
| Entity CRUD and scope | Firestore entity adapter, default-deny rules, own/team/all tests | Verified locally in Phase 12 |
| Lead notifications | `createNewLeadNotifications`, deterministic notification IDs, recipient preferences and role scope | Verified locally; retry-enabled deployment decision required |
| Daily reminders | `createDailyReminderNotifications`, America/Chicago schedule, deterministic daily notifications | Verified locally; scheduler retry count is 3 |
| Lead and opportunity conversions | Trusted callables plus audit records and emulator tests | Verified locally in Phase 12 |
| Files/import/export | Firebase Storage and trusted extraction/export paths | Verified locally in Phase 12 |
| Email/SMS | Server-side providers, safe-disabled configuration, idempotent delivery records | Verified locally in Phase 12 |
| Configurable automations | Firestore trigger, server-side condition/action enforcement, idempotent logs | Verified locally in Phase 12 |
| ATLAS | `invokeAtlasAi`, App Check, authorization, bounded context, immutable usage records, safe failure | Verified locally; only the scoped callable was activated in Phase 11 |
| New Lead Qualification workflow | `qualifyNewLead` plus `processLeadQualification`; trusted structured ATLAS scoring, fail-closed behavior, deterministic task/notification/audit/usage writes | In progress; focused emulator evidence passes, deployment and full trigger acceptance pending |
| Stale Opportunity Follow-up workflow | `scanStaleOpportunities` plus deterministic three-day Cloud Tasks dispatch to `recheckStaleOpportunity`; activity cancellation, fallback/ATLAS summary, audit and exactly-once task | In progress; focused emulator evidence passes, deployment acceptance pending |
| Weekly Sales Report workflow | `generateWeeklySalesReport`; Chicago week boundaries, controlled management recipients, XLSX Storage artifact, idempotent email delivery and durable run record | In progress; focused emulator evidence passes, deployment/provider acceptance pending |

## Workflow replacement requirements

### New Lead Qualification

Implemented locally as `qualifyNewLead` and `processLeadQualification`. The replacement loads the lead and discovery data server-side, requests structured ATLAS scoring, records privacy-safe usage without prompt/response content, fails closed when the provider is unavailable, qualifies only scores of 70 or above, and uses deterministic task/notification/audit records for trigger retries. It is not deployed or approved for production cutover.

### Stale Opportunity Follow-up

Implemented locally with an America/Chicago daily scheduler and deterministic Cloud Tasks IDs for the three-day recheck. Pending cycles are anchored to the most recent activity, owner notifications are deterministic, new activity cancels the delayed action, and task/audit writes are transactionally exactly-once. ATLAS summary failure falls back to a safe task while retaining privacy-safe usage evidence. Deployment and live queue/scheduler acceptance remain pending.

### Weekly Sales Report

Implemented locally with an America/Chicago Monday 09:00 scheduler, active administrator/superadmin recipients loaded server-side, deterministic Monday run keys, configured report aggregation, a private server-controlled XLSX Storage artifact, idempotent provider delivery, and a durable run record. No recipient or provider credential is supplied by the browser. Deployment and live provider acceptance remain pending.

## Retry and deployment review

| Function | Current retry setting | Side effects and protection | Phase 13 decision |
|---|---|---|---|
| `createNewLeadNotifications` | Firestore trigger `retry: true` | Deterministic notification documents and transaction create-if-missing | Locally acceptable; production activation still requires an explicit scoped deployment approval |
| `deliverNotificationEmail` | Firestore trigger `retry: true` | Idempotent delivery repository and provider result record | Locally acceptable; confirm provider failure/retry runbook before deployment |
| `createDailyReminderNotifications` | Scheduler `retryCount: 3` | Run-date deterministic notification IDs | Locally acceptable; confirm scheduler deployment scope before activation |
| `qualifyNewLead` | Firestore trigger `retry: true` | Deterministic usage/task/notification/audit IDs; unavailable provider performs no lead mutation | Locally acceptable; deploy only with explicit ATLAS secret/mode and scoped activation review |
| `scanStaleOpportunities` | Scheduler `retryCount: 3` | Activity-anchored cycle IDs, deterministic notifications and Cloud Task IDs | Locally acceptable; live Cloud Tasks permissions/queue behavior require acceptance |
| `recheckStaleOpportunity` | Task queue `maxAttempts: 5` | Pending-state transaction, activity cancellation, deterministic task/audit IDs | Locally acceptable; dead-letter/operations response must be approved before activation |
| `generateWeeklySalesReport` | Scheduler `retryCount: 3` | Monday run key, deterministic delivery keys, private XLSX path and durable run record | Locally acceptable; live provider and Storage artifact checks require acceptance |

Never use an unreviewed broad `firebase deploy --only functions`. Any proposed deployment must enumerate exact function names, expected retry changes, rollback actions, and monitoring.

## PR #4 pre-cutover review

PR #4 changes Lead, Opportunity, and Customer screens and remains intentionally isolated. It must not merge without Patrick's approval after salesperson and superadmin walkthroughs.

Compatibility findings to resolve on its branch:

1. `lead_temperature` changes from `Hot/Warm/Cold` to `A/B/C/Unrated`, while Automations and existing lead displays still use the former values.
2. New fuel/customer fields require Firestore rules, import/export, conversion, report, and historical-record compatibility evidence.
3. Customer creation needs visible mutation failure handling and explicit role/permission tests.
4. Reinterpreting customer segment, health, onboarding, and renewal views requires regression coverage for existing records.
5. Opportunity field changes require automation, search, pipeline, dashboard, and ATLAS prompt regression checks.

Current decision: **do not merge before the walkthrough and compatibility fixes are approved.**

## Controlled cutover and rollback runbook

Before any authorized production cutover:

1. Record source commit, approved deployment manifest, Firebase project ID, Vercel deployment, and operators.
2. Export Firestore and record collection counts, representative ownership/permission samples, Storage object counts, and Authentication/profile reconciliation.
3. Confirm App Check, Secret Manager bindings, provider kill switches, budgets, alerts, and log access.
4. Deploy only the explicitly approved rules/indexes/functions/hosting targets in dependency order.
5. Run unauthenticated, inactive, salesperson, supervisor, administrator, superadmin, and viewer smoke checks.
6. Verify create/update/conversion/file/notification/messaging/ATLAS paths and reconcile counts again.
7. Stop and roll back on authorization widening, data loss, duplicate external delivery, unexplained reconciliation variance, or critical workflow failure.
8. Roll back application traffic to the last known-good Vercel deployment and deploy only previously recorded Firebase artifacts where Firebase rollback is required and explicitly approved.
9. Preserve audit logs, delivery records, usage records, and incident evidence.

## Retirement gate

No `atlas/` file may be deleted, moved, or rebranded until every preserved capability has an accepted Firebase replacement or explicit retirement approval, repository-wide path scans show no consumers, all automated/manual gates pass, rollback evidence is complete, and Patrick approves the exact file operation. Historical tags and migration evidence remain preserved.

## Phase 13 validation checklist

- Production build.
- Phase 12 aggregate suite.
- Full Functions emulator callable/trigger suite.
- Functions build and lint.
- Focused workflow, notification, messaging, automation, rules, and Storage tests.
- Repository-wide dependency/reference scan and `git diff --check`.
- Authenticated salesperson and superadmin walkthroughs.
- PR #4 walkthrough on its separate branch.

## Validation evidence

Executed on 2026-08-18 from the Phase 13 baseline plus documentation-only changes:

| Check | Result |
|---|---|
| `npm run build` | Passed; retained existing browser-data and ambiguous Tailwind-class warnings |
| `npm --prefix functions run lint` | Passed |
| `npm run test:phase12` | Passed: 10 unit files/66 tests, 10 rules-storage files/459 tests, 3 entity files/16 tests, and 5 workflow files/38 tests |
| `npm run test:phase12:functions-emulator` | Passed: 12 files/82 tests |
| `npm run test:phase13:lead-qualification` | Passed: 1 focused emulator file/3 tests covering high score, low score, unavailable provider, and retry idempotency |
| `npm run test:phase13:stale-opportunities` | Passed: 1 focused emulator file/3 tests covering selection, queue idempotency, activity cancellation, and exactly-once fallback task creation |
| `npm run test:phase13:weekly-report` | Passed: 1 focused emulator file/2 tests covering controlled recipients, aggregation/XLSX generation, Chicago week key, delivery, and idempotency |
| `npm run test:phase13` | Passed: all 3 focused files/8 tests |
| Post-workflow full Functions emulator regression | Passed: 12 files/82 tests after hardening unavailable-provider lead scoring to avoid conversion contention |
| Local Vite route smoke | Passed: `/`, `/Dashboard`, `/Leads`, `/Opportunities`, `/Tasks`, `/Reports`, `/Settings`, `/ActNow`, `/ImportLeads`, `/CSManagement`, and SPA fallback returned 200 with the application root and module script |
| `git diff --check` | Passed before evidence reconciliation; run again at final handoff |
| Authenticated browser walkthrough | Not completed in this agent session because browser-control runtime was unavailable; automated role/emulator evidence passed but does not replace visual verification |
| PR #4 salesperson/superadmin walkthrough | Not completed; PR remains separate and unmerged pending Patrick-supervised visual review and the compatibility fixes listed above |

## PR #4 remote-safe follow-up

The isolated `followup/mdx-fuel-forms-walkthrough` worktree was hardened without merging it:

- A/B/C/Unrated is now stored in a separate `lead_rating` field, preserving automated `lead_temperature` values and existing Hot/Warm/Cold consumers.
- Fuel-volume, fuel-type, delivery, tank-rental, industry, source, and rating values propagate through trusted lead-to-opportunity conversion.
- The opportunity form preloads relevant fuel fields from the selected lead.
- Customer creation now shows explicit success and failure feedback.
- Production build and Functions lint/build pass in the isolated worktree.
- Focused Functions emulator execution in the nested worktree timed out during emulator orchestration on repeated attempts; no failing assertion was produced. The modified conversion test adds the MDX field-propagation expectations and must be rerun from the ordinary checkout after the branch is approved/merged or checked out directly for the desktop walkthrough.

PR #4 remains unmerged and requires visual salesperson/superadmin acceptance.

## Exit criteria

Phase 13 can recommend Phase 14 only when all three workflow blockers and the app-logging decision are closed, required production-critical paths pass automated and manual verification, PR #4 has an explicit merge/defer decision, retry/deployment scope is approved, and the cutover/rollback package is complete.
