# Firebase Architecture

## Proposed repository layout

```text
src/
  api/                 provider-neutral frontend adapters
  firebase/            browser Firebase initialization only
functions/             trusted Firebase Functions TypeScript project
  src/authz/            permission and ownership enforcement
  src/callable/         user-initiated privileged operations
  src/triggers/         Firestore event handlers
  src/scheduled/        scheduled workflows
  src/atlas/            provider-neutral ATLAS orchestration
firebase/
  firestore.rules
  firestore.indexes.json
  storage.rules
  emulator-tests/
legacy/base44/          eventual reference-only location; not created/renamed yet
```

The current `base44/` directory remains untouched while it is runtime/deployment reference. The proposed `legacy/base44/` move occurs only after path consumers are eliminated and verified; it must not be renamed to `atlas/`, because Base44 schemas and functions are not the ATLAS assistant.

## Runtime boundaries

The browser may use Firebase Auth and allowed Firestore/Storage operations through the web SDK. It must not contain Admin SDK imports or privileged credentials. Callable/HTTP functions validate Firebase ID tokens, App Check, input schemas, effective permissions, ownership/team scope, and rate limits before using the Admin SDK.

Privileged operations—including user administration, record transfer, exports, workflow execution, email, AI, bulk writes, account deactivation, and audit-sensitive changes—run only in trusted code.

## Environments

Use separate Firebase projects for development, staging, and production. Keep public web configuration in environment-specific Vite variables; although Firebase web configuration is not a secret, it must not grant authority. Store AI/email/provider secrets in Google Secret Manager and bind only the functions that require them.

## Emulator baseline

Phase 1 adds Auth, Firestore, Functions, Storage, and Emulator UI configuration plus deterministic seed fixtures. CI should run build/typecheck/lint/unit tests and emulator integration tests. Tests must include unauthenticated denial, inactive-user denial, each of five roles, own/team/all scope, privilege escalation attempts, cross-team access, forged ownership fields, protected-field mutation, and App Check policy where emulation permits.

## Data model direction

Use top-level collections for major CRM records to support reporting and scoped queries. Every major record carries immutable creator metadata and controlled assignment metadata:

- `ownerId`, `createdBy`, `lastModifiedBy`
- `teamId`, `supervisorId`
- `createdAt`, `updatedAt`, `lastActivityAt`
- `isDeleted`/lifecycle state where retention is required

Transfer events are append-only documents in `recordTransferHistory`; audit events are append-only in `auditLogs`. Server timestamps and backend-controlled fields prevent client forgery. Final collection names and field mappings are locked in Phase 3 after schema reconciliation.

## Security posture

Rules start with global denial and add narrow collection-specific grants. Queries must be shaped to match authorization scope; rules are not filters. Custom claims may cache coarse role/status, but Firestore remains the source for configurable module permissions and overrides. Sensitive permission changes use trusted functions and append audit events.

## Reliability and operations

Use idempotency keys for workflow steps and external side effects, Cloud Scheduler for recurring jobs, Cloud Tasks for retryable/delayed work (including the three-day stale-opportunity recheck), structured logs with correlation IDs, dead-letter handling, and budget/usage alerts. Backups, point-in-time recovery where available, export schedules, retention, and restore drills are required before production cutover.

