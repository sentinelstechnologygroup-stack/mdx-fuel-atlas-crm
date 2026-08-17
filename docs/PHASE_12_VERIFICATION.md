# Phase 12 Verification Plan and Evidence

Last updated: 2026-08-17

## Scope

Phase 12 covers full parity, security, role, regression, and emulator testing for the Firebase migration through Phase 11. Manual desktop and browser verification is intentionally deferred until automated remote checks are complete.

Phase 12 does not authorize deployment, `npm audit fix`, broad Firebase Functions deployment, legacy provider removal, or `retired-provider/` movement.

## Automated task list

1. Create a Phase 12 branch from clean `main`. Status: complete.
2. Reconcile migration documents to the current Phase 11 production state and Phase 12 testing scope. Status: complete.
3. Inventory remaining `legacy_provider`, `Core.*`, `SalesAssistant`, and retired-provider references. Status: complete.
4. Verify workflow parity for lead notifications, reminders, conversion flows, messaging delivery, automation delivery, imports, exports, file handling, and ATLAS flows. Status: automated remote coverage complete.
5. Verify core CRM module regression for scoped entities, configuration records, notifications, users, and administrative tools. Status: remote-safe emulator coverage complete.
6. Verify role and permission behavior for unauthenticated, inactive, salesperson, supervisor, administrator, super administrator, and viewer support fixtures. Status: remote-safe rules/entity coverage complete.
7. Harden Firestore rules coverage for server-only telemetry and audit mutation denial. Status: complete; added `tests/firestore.phase12.rules.test.js`.
8. Verify Storage rules for ownership, metadata, MIME type, size, generated ATLAS image provenance, and cross-user denial. Status: complete in emulator suite.
9. Review callable function authorization, input validation, idempotency, and audit behavior. Status: complete; full Functions emulator callable/trigger suite passes.
10. Review trigger and scheduler retry behavior without deploying. Status: complete; retry-enabled handlers documented below.
11. Verify ATLAS auth, App Check configuration, fail-closed provider behavior, server-side usage records, bounded context, document extraction, image authorization, and safe conversation behavior. Status: complete in provider, artifact, gateway, rules, and production build checks.
12. Run emulator coverage for Firestore, Storage, Auth, Functions, workflows, and callable regressions. Status: complete; Firestore, Storage, Auth, Functions, workflows, rules, and callable regression suites pass.
13. Run build and lint gates. Status: Functions build/lint and production build pass; root typecheck/lint reproduce known backlog.
14. Defer manual desktop/browser checks to the final manual verification set. Status: deferred as requested.
15. Capture evidence and remaining gaps. Status: complete in this file.
16. Produce a Phase 12 go/no-go for Phase 13. Status: automated go; Phase 13 remains gated on the intentionally deferred desktop/manual checklist and Patrick's approval.

## Legacy reference inventory

Current source search shows remaining `Core.*` and `SalesAssistant` references in the React compatibility facade and UI component names. The active AI adapter routes AI/document/image/conversation paths through the Firebase `invokeAtlasAi` callable. These references are retained for compatibility and historical continuity during Phase 12; deletion or renaming is Phase 13 work only after approval.

Remaining notable references:

- `src/api/integrations.js` exports provider-neutral compatibility names for existing frontend imports.
- AI UI modules still use `SalesAssistant*` component/file names internally, while user-facing identity remains ATLAS.
- `docs/*` retain historical `legacy_provider`, `Core.*`, and `SalesAssistant` references for migration evidence.
- `legacy_provider.appLogs.*` remains a documented gap unless explicitly implemented or retired before Phase 13.

## Retry and deployment safety

No deployment was performed or authorized in Phase 12.

Do not run a broad Firebase Functions deployment without a reviewed retry-policy decision. Functions discovery confirms retry-enabled handlers:

- `createNewLeadNotifications` uses Firestore trigger retry.
- `deliverNotificationEmail` uses Firestore trigger retry.
- `createDailyReminderNotifications` uses Scheduler retry count `3`.

The Phase 11 production closeout used a scoped deploy for `functions:invokeAtlasAi`; Phase 12 preserves that safety boundary.

## Automated evidence

| Check | Command | Result |
|---|---|---|
| Branch baseline | `git status --short --branch` | Started from clean `main`; Phase 12 branch `migration/phase-12-parity-security-regression-testing` created from `7e30f2e` |
| Functions build | `npm --prefix functions run build` | Passed |
| Functions lint | `npm --prefix functions run lint` | Passed |
| Production build | `npm run build` | Passed; retained existing browser-data/Tailwind warnings |
| Phase 12 unit suite | `npm run test:phase12:unit` | Passed: 10 files, 66 tests |
| Phase 12 aggregate remote-safe suite | `npm run test:phase12` | Passed: Functions build plus 10 unit files/66 tests, 10 rules-storage files/459 tests, 3 entity files/16 tests, 5 workflow files/38 tests |
| Focused new Phase 12 rules test | `tests/firestore.phase12.rules.test.js` | Passed: 13 tests; included in aggregate rules-storage group |
| Full Functions emulator callable/trigger suite | `npm run test:phase12:functions-emulator` | Passed: 12 files, 82 tests; added ignored local emulator env files for non-interactive parameter loading and provider-secret disabling |
| Root typecheck | `npm run typecheck` | Failed with known backlog, led by Three.js/jsconfig and broad JSX/UI typing errors |
| Root lint | `npm run lint` | Failed with known backlog: 254 problems, including generated `functions/lib` rule-resolution errors and unused imports |
| Git diff check | `git diff --check` | Passed after final documentation update |

## Manual verification deferred to end

Complete after returning to the desktop/browser session:

- Firebase-authenticated login/session smoke.
- Core CRM navigation and layout scan.
- Lead create to notification behavior.
- Lead to opportunity conversion UI.
- Closed Won opportunity to client conversion UI.
- File upload/import/export UI path.
- Notification read-state UI.
- ATLAS safe-unavailable UI and, only if configured, authorized provider smoke.

## Local emulator configuration note

The Functions emulator needs ignored local files for non-interactive parameter loading:

- `functions/.env.local`
- `functions/.secret.local`

These files are gitignored and contain placeholder-only values. `MDX_EMULATOR_DISABLE_PROVIDER_SECRETS=true` prevents local emulator runs from using injected provider secrets, keeping email/SMS providers safely disabled unless explicitly configured for a controlled smoke test.

## Phase 12 go/no-go

Phase 12 automated remote verification is complete and ready to commit. Phase 13 should remain blocked until the deferred manual desktop/browser checklist is completed and Patrick explicitly authorizes any deployment or cutover action.
