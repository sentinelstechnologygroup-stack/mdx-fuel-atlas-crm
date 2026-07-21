<!-- README.md -->
# MDX Fuel ATLAS CRM

**Enterprise CRM Platform for MDX Fuel**

Built and maintained by **Sentinels Design Lab (SDL)**  
A division of **Sentinels Technology Group (STG)**

---

## Project Overview

MDX Fuel ATLAS CRM is a custom customer relationship management platform designed for MDX Fuel's sales, customer service, operations, reporting, ownership, workflow, and administrative needs.

The platform is being migrated to an independently operated Firebase architecture while preserving the approved interface, existing CRM behavior, prior schemas, workflow logic, assistant definitions, permission concepts, and operational functionality.

ATLAS is the platform's user-facing intelligent CRM assistant.

**Assistant identity:** ATLAS  
**Attribution:** Powered by Aurora Intelligence Systems

---

## Project Ownership

| Category | Owner |
|---|---|
| Client / Operating Company | MDX Fuel |
| Product Strategy | Sentinels Technology Group |
| Design and Engineering | Sentinels Design Lab |
| Platform Intelligence | Aurora Intelligence Systems |
| Repository | `sentinelstechnologygroup-stack/mdx-fuel-atlas-crm` |
| Primary Maintainer | Sentinels Technology Group |

This repository contains proprietary project work developed for MDX Fuel and maintained by Sentinels Technology Group / Sentinels Design Lab.

---

## Current Project Status

**Status:** Active Development  
**Current Workstream:** Firebase migration and ATLAS platform hardening  
**Deployment Authorization:** Development only unless explicitly approved  
**Production Cutover:** Not yet authorized

Completed foundation work includes:

- Firebase project and Emulator Suite foundation
- Firebase Authentication integration
- Firestore entity adapter foundation
- Firebase-compatible ATLAS application client
- Removal of legacy runtime package dependencies
- Localized MDX Fuel branding assets
- Preserved schemas, workflows, assistant definitions, and backend logic under `atlas/`
- Initial application-role and permission architecture
- Production frontend build validation

The next implementation stage includes:

- Employee user profiles
- Role hierarchy and account status
- Firestore collection creation
- Security Rules enforcement
- Ownership and team scope
- Trusted administrative operations
- Permission overrides
- Audit logging
- Workflow and backend function migration
- Emulator test coverage for all user levels

---

## Core User Levels

The approved hierarchy is:

1. **Super Administrator**
2. **Administrator**
3. **Supervisor / Sales Manager**
4. **Salesperson**
5. **Viewer / Support User**

Roles provide default capabilities. Final authorization must also consider:

- Account status
- Module permissions
- User-specific overrides
- Record ownership
- Team and supervisor scope
- Protected fields
- Trusted backend enforcement

Frontend permission controls are presentation logic only and are not security boundaries.

---

## Technology Stack

### Frontend

- React
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Component-based ATLAS CRM interface

### Backend and Infrastructure

- Firebase Authentication
- Cloud Firestore
- Firebase Functions
- Firebase Storage
- Firebase Emulator Suite
- Firebase Security Rules
- Google Secret Manager for protected provider credentials

### Planned Trusted Services

- Backend-authorized administrative operations
- Record transfer and ownership services
- Workflow execution
- Export and reporting services
- Email and notification providers
- ATLAS orchestration and approved AI providers
- Immutable audit and usage logging

---

## Repository Structure

```text
atlas/
  agents/                preserved assistant definitions
  entities/              preserved CRM schemas
  functions/             preserved backend logic for Firebase porting
  workflows/             preserved workflow definitions
  config.jsonc           preserved platform configuration reference

src/
  api/                   frontend application adapters
  auth/                  Firebase authentication and session handling
  components/            CRM interface and shared components
  firebase/              browser Firebase initialization and entity adapter
  lib/                   permissions, roles, routing, and shared utilities
  pages/                 application pages

functions/
  src/                   trusted Firebase Functions implementation
  emulator-tests/        backend and rules integration tests

docs/
  ATLAS_ARCHITECTURE.md
  FIREBASE_ARCHITECTURE.md
  FIREBASE_LOCAL_DEVELOPMENT.md
  PERMISSION_MODEL.md

public/
  images/                project-controlled branding assets
```

The `atlas/` directory preserves prior project work for controlled migration. Files in that directory must not be removed until their Firebase-native replacements are implemented, tested, and accepted.

---

## Local Development

### Prerequisites

- Node.js
- npm
- Firebase CLI
- Access to the approved development environment configuration

### Install Dependencies

```powershell
npm install
npm --prefix functions install
```

Do not run:

```powershell
npm audit fix
npm audit fix --force
```

Dependency changes must be reviewed deliberately to avoid breaking the application or migration work.

### Start Firebase Emulators

```powershell
firebase emulators:start --only "auth,firestore,functions,storage"
```

### Start the Frontend

```powershell
npm run dev
```

### Seed Local Test Accounts

```powershell
npm run seed:emulators
```

Seeded local accounts use the test-only password:

```text
AtlasTest!2026
```

Available emulator roles:

- `superadmin@example.test`
- `admin@example.test`
- `supervisor@example.test`
- `salesperson@example.test`
- `viewer@example.test`
- `inactive@example.test`

These credentials are for local emulator use only.

---

## Validation Commands

### Frontend Build

```powershell
npm run build
```

### Firestore Rules Tests

```powershell
npm run test:rules:emulator
```

### Test an Existing Emulator Session

```powershell
npm run test:rules
```

### Firebase Functions Build

```powershell
npm --prefix functions run build
```

### Firebase Functions Lint

```powershell
npm --prefix functions run lint
```

A project phase is not complete until the relevant build, tests, permission checks, and manual regression checks pass.

---

## Security Doctrine

The application follows a deny-by-default security posture.

Required controls include:

- Authentication for all protected CRM access
- Inactive-account denial
- Least-privilege role assignment
- Collection-specific Firestore Rules
- Storage Rules with narrow grants
- Trusted backend enforcement for privileged operations
- Server-controlled audit and ownership fields
- Append-only audit and transfer history
- Environment separation for development, staging, and production
- Secret Manager for protected provider credentials
- No administrative credentials in browser code
- No service-account files committed to source control
- No unapproved production deployment

Queries must be shaped to match authorized scope. Security Rules are not filters.

---

## Record Ownership and Scope

Major CRM records must support controlled ownership and lifecycle metadata, including:

- `ownerId`
- `createdBy`
- `lastModifiedBy`
- `teamId`
- `supervisorId`
- `createdAt`
- `updatedAt`
- `lastActivityAt`
- lifecycle or deletion state where retention is required

Assignment and transfer operations must use trusted backend services and write append-only transfer history.

User deactivation preserves historical identity and record history. Cascading deletion is not permitted.

---

## ATLAS Intelligence Architecture

ATLAS is the only user-facing assistant identity in the CRM.

The frontend communicates with trusted backend contracts. Provider selection, model policy, credentials, permission checks, CRM context retrieval, tool execution, cost logging, and audit logging are handled server-side.

ATLAS must never receive CRM records the authenticated user is not authorized to access.

Write-capable assistant tools require:

- Typed request contracts
- Input validation
- Permission validation
- Ownership and team-scope validation
- Audit logging
- User confirmation for material actions
- Explicit authorization for deletion or irreversible actions

---

## Environment and Secrets

Never commit:

- `.env.local`
- Firebase Admin credentials
- Service-account files
- API keys
- Access tokens
- Email provider credentials
- AI provider credentials
- Private keys
- Production secrets

Firebase browser configuration may be stored in environment-specific Vite variables, but it must never be treated as an authorization boundary.

---

## Deployment Policy

Development, staging, and production must use separate Firebase projects.

No deployment is permitted unless explicitly approved by the project owner.

Before any production cutover:

- Build must pass
- Security Rules tests must pass
- Functions build and lint must pass
- Role and ownership tests must pass
- Workflow parity must be verified
- Visual and responsive regression checks must pass
- Backup and recovery procedures must exist
- Secrets and environment bindings must be verified
- Production approval must be recorded

---

## Documentation

Project architecture and implementation rules are maintained in:

- `docs/ATLAS_ARCHITECTURE.md`
- `docs/FIREBASE_ARCHITECTURE.md`
- `docs/FIREBASE_LOCAL_DEVELOPMENT.md`
- `docs/PERMISSION_MODEL.md`

These documents are part of the project record and must remain aligned with the active implementation.

---

## Development Rules

- Preserve approved UI, layout, responsive behavior, and functionality.
- Do not remove prior project work merely because it is not yet Firebase-native.
- Port preserved schemas, workflows, and functions systematically.
- Do not replace working functionality with placeholders.
- Use one controlled migration step at a time.
- Validate every changed path before proceeding.
- Do not deploy without explicit authorization.
- Do not run automated destructive dependency remediation.
- Keep privileged logic out of browser code.
- Record significant architecture and security decisions.

---

## License and Confidentiality

**Proprietary and Confidential**

This repository and its contents are not open-source unless a separate written license states otherwise.

© 2026 Sentinels Technology Group. All rights reserved.  
Sentinels Design Lab is the design and engineering division of Sentinels Technology Group.

Project work is developed for MDX Fuel under the applicable client and service agreements.