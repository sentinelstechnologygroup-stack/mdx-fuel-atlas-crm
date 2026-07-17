# MDX Fuel ATLAS CRM — Repository Rules

## Authority

These rules apply to the entire repository. GitHub is the source of truth. The immutable migration baseline is commit `45ef9b8`, tag `base44-final-baseline-2026-07-17`.

## Non-negotiable constraints

- Preserve the existing React/Vite application, AnyCRM visual design, routes, layout, colors, dark/light mode, behavior, workflows, permissions, and the single user-facing assistant named ATLAS.
- Never redesign, remove, simplify, disable, or replace working behavior with a placeholder unless Patrick explicitly authorizes it.
- Do not remove a Base44 dependency until its replacement is implemented, tested, documented in the parity matrix, and approved for cutover.
- Keep Base44 definitions as legacy reference until Phase 13. Do not rename `base44/` to `atlas/` while runtime imports, build tooling, workflows, or deployment still depend on Base44. A future rename requires a clean reference/runtime separation and a verified build, test, emulator, and visual-regression pass.
- Use Firebase Authentication, Cloud Firestore, Firebase Storage, Cloud Functions or Cloud Run, App Check, and default-deny Security Rules. Ask before departing from this architecture.
- Never put Firebase Admin SDK code, service credentials, AI provider keys, email credentials, or other secrets in browser code or Git.
- Enforce authorization in trusted backend code and Firestore/Storage rules. UI visibility is not authorization.
- Preserve user and record history. Never permanently delete data without explicit authorization.
- Maintain exactly one user-facing assistant: `ATLAS`, attributed as `Powered by Aurora Intelligence Systems`. `SalesAssistant` is legacy-only and must never become a second user-facing assistant.

## Required workflow

1. Read `docs/MIGRATION_CHARTER.md`, `docs/MIGRATION_STATUS.md`, `docs/DECISION_LOG.md`, and the relevant parity/inventory documents.
2. Run `git status --short --branch` before editing; preserve unrelated work.
3. Use one dedicated branch per migration phase, based on the latest accepted branch.
4. Change only the files required for the active phase.
5. Add or update automated tests for every material behavior and permission boundary.
6. Run the production build, relevant tests, lint/type checks, Firebase Emulator Suite tests, and role-based permission tests as applicable.
7. Update the dependency inventory, parity matrix, migration status, and decision log in the same change.
8. Report every changed file, command run, pass/fail result, limitation, and exact next step.

## Branch convention

- `migration/phase-0-baseline-audit`
- `migration/phase-1-firebase-foundation`
- Continue as `migration/phase-N-short-description` through Phase 14.

Do not combine phases merely to reduce branch count.

## Code and handoff rules

- Prefer direct repository edits. If Patrick must edit manually, provide PowerShell commands and complete files only.
- Every manually supplied file starts with a comment containing its exact repository path. Clearly state whether it is new or replaces an existing file.
- Never provide partial files, ellipses, “rest unchanged,” or unchanged files.
- Do not claim functionality, workflow parity, security, or a migration phase is complete without recorded verification.

