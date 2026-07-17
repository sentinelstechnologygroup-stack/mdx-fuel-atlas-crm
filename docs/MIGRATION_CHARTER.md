# Migration Charter

## Objective

Replace Base44 services systematically while preserving the approved MDX Fuel ATLAS CRM frontend and all observable behavior. Replacement means independently operated, backend-authorized, tested functionality—not a visual mock or client-only substitute.

## Baseline

- Repository: `sentinelstechnologygroup-stack/mdx-fuel-atlas-crm`
- Baseline commit: `45ef9b81d09227554b28f7d3ff3591b60b1459a5`
- Baseline tag: `base44-final-baseline-2026-07-17`
- Baseline branch at audit: `main`, aligned with `origin/main`
- Baseline tree at audit: clean before documentation work

## Scope and invariants

The migration preserves pages, routes, design, layout, responsive behavior, theme toggle, CRM modules, import/export, uploads, notifications, email, automations, reports, role hierarchy, record ownership, and ATLAS. No Base44 runtime component may be removed before documented parity.

The approved platform is:

- React/Vite frontend
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Cloud Functions for Firebase and/or Cloud Run for trusted operations
- Firebase App Check
- Default-deny Firestore and Storage Security Rules
- Emulator Suite for integration and authorization testing
- Secret Manager/environment configuration for production secrets
- Optional Cloudflare later, only after a separate architecture decision

## Definition of parity

A replacement reaches parity only when:

1. its inputs, outputs, side effects, error behavior, permissions, audit trail, and UI behavior are mapped;
2. implementation exists without a Base44 runtime call on that path;
3. positive and negative tests pass in emulators for all applicable roles and ownership scopes;
4. production build and relevant automated tests pass;
5. visual/interaction behavior is verified against the baseline;
6. data reconciliation and rollback are documented; and
7. `WORKFLOW_PARITY_MATRIX.md` and `MIGRATION_STATUS.md` record evidence.

## Phases

0. Preserve and document baseline
1. Firebase structure and emulators
2. Authentication and user profiles
3. Schema, ownership, and security rules
4. Leads vertical migration
5. Companies and contacts
6. Opportunities, pipeline, tasks, activities
7. Products, pricing, quotes, approvals
8. Customer service, calendar, reports, remaining modules
9. Files, import/export, notifications, email
10. Workflows and automations
11. Independent ATLAS
12. Data migration and reconciliation
13. Remove Base44 runtime dependencies
14. Full security, role, workflow, visual, and production audit

## Gates

Each phase uses its own branch, preserves unrelated changes, records test evidence, and ends with an explicit go/no-go. Phase 13 is blocked until every inventory item has an accepted replacement or an explicitly approved retirement. Renaming/rebranding the `base44/` folder is also blocked until Phase 13 cleanup confirms that the directory contains reference material only and all path/build/deployment dependencies have been removed.

