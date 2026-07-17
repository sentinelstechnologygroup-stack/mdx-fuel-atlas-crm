# Decision Log

## 2026-07-17 — Baseline authority

Decision: commit `45ef9b8` and tag `base44-final-baseline-2026-07-17` are the immutable Base44 migration baseline.

## 2026-07-17 — Incremental replacement

Decision: Base44 dependencies remain active until each path has an independently implemented and verified replacement. Reference definitions remain available through parity and reconciliation.

## 2026-07-17 — Firebase platform

Decision: preserve React/Vite; use Firebase Auth, Firestore, Storage, Functions/Cloud Run, App Check, default-deny rules, and emulator testing. Cloudflare is deferred and requires a later decision.

## 2026-07-17 — Authorization boundary

Decision: permissions are enforced in Firestore/Storage rules and trusted backend services. Frontend visibility is not security. Admin SDK and privileged secrets are prohibited in browser code.

## 2026-07-17 — ATLAS identity

Decision: exactly one user-facing assistant, ATLAS, attributed to Aurora Intelligence Systems. `SalesAssistant` remains only as a legacy internal identifier until replacement.

## 2026-07-17 — Base44 folder rename deferred

Decision: do not rename `base44/` to `atlas/` now. The directory contains Base44 platform schemas, functions, workflows, config, and agent reference—not merely the ATLAS assistant—and the current Vite/runtime code still depends on Base44. After parity, separate reference material under `legacy/base44/`; reserve `atlas` naming for provider-neutral assistant code. Any move requires repository-wide path verification, production build, emulator tests, and visual/regression checks.

## 2026-07-17 — Branch strategy

Decision: one `migration/phase-N-short-description` branch per phase. Phase 0 documentation uses `migration/phase-0-baseline-audit`; Phase 1 uses `migration/phase-1-firebase-foundation` after Phase 0 acceptance.


## 2026-07-17 — Phase 2 authentication shadow mode

Decision: Firebase Authentication, employee profile lookup, and the native ATLAS CRM login screen are verified locally in shadow mode. Base44 remains the active authentication provider because authenticated dashboard workflows still depend on legacy Base44 entities. Authentication cutover is not approved.

## 2026-07-17 — Full functional parity required

Decision: no CRM feature may be deleted, reduced, or silently disabled during Base44 replacement. Existing forms, routes, dashboards, entities, tasks, reports, workflows, automations, permissions, ownership controls, imports, notifications, file operations, AI capabilities, email, and SMS must receive independently implemented and verified replacements before their Base44 paths are retired.

## 2026-07-17 — Provider replacement boundaries

Decision: Firebase Authentication, Firestore, Cloud Functions, and Firebase Storage are the approved replacements for Base44 identity, entity data, trusted server workflows, and file storage. Dedicated providers will be selected for AI, email, and SMS capabilities. Provider credentials must remain server-side and may not be placed in browser code.
