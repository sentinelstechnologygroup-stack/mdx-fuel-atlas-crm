# Migration Status

Last updated: 2026-07-17

## Current state

- Active phase: Phase 2 — Firebase Authentication and employee profiles (shadow-mode checkpoint)
- Baseline verified: tag and commit identity verified
- Firebase development project: `mdx-fuel-atlas-crm-dev` (`485940537312`)
- Firestore location: `nam5`
- Firebase foundation added: yes; Phase 1 foundation commit `c89f440` pushed
- Frontend connected to Firebase runtime: yes, for Phase 2 Auth/profile shadow-mode testing only
- legacy provider removed: no
- Production cutover authorized: no
- `retired-provider/` rename authorized: no; unsafe until runtime and reference material are separated and Phase 13 gates pass
- Deployment performed: no

## Phase status

| Phase | Status | Exit evidence |
|---:|---|---|
| 0 | Complete | Baseline inventory and migration documentation committed; baseline production build passed; pre-existing typecheck and lint findings recorded |
| 1 | Complete | Foundation commit `c89f440` pushed to `migration/phase-1-firebase-foundation`; Firebase dev project and Emulator Suite verified |
| 2 | In progress — implementation verified locally in shadow mode; checkpoint commit pending | Firebase login and employee profile lookup verified; deterministic emulator seeding passed; 33 Firestore rules tests passed; Functions lint/build and frontend production build passed; cutover blocked by legacy provider entity dependencies |
| 3–14 | Not started | None |

## Phase 1 foundation implemented

- `.firebaserc` maps the default Firebase project to `mdx-fuel-atlas-crm-dev`.
- `firebase.json` connects Firestore rules and indexes, Functions, Storage rules, and Emulator Suite configuration.
- Emulator ports:
  - Authentication: `9099`
  - Functions: `5001`
  - Firestore: `8080`
  - Storage: `9199`
  - Emulator UI: `4000`
- `firestore.rules` denies all reads and writes.
- `storage.rules` denies all reads and writes.
- `firestore.indexes.json` contains no indexes yet.
- The Functions TypeScript project targets Node.js 22.
- The Functions lint command uses `cross-env` with `ESLINT_USE_FLAT_CONFIG=false` so `functions/.eslintrc.js` works consistently alongside the root flat ESLint configuration.
- `functions/tsconfig.dev.json` allows ESLint to parse `.eslintrc.js` without emitting JavaScript.
- The unused Firebase Functions scaffold imports were removed.
- No Cloud Function is exported yet.
- No existing legacy provider runtime path was changed.
- No staging or production Firebase project was touched.
- No Firebase deployment was performed.

## Phase 1 verification evidence

- Functions lint: **passed**
- Functions TypeScript build: **passed**
- Frontend production build: **passed** with exit code `0`
- Frontend build retained the existing non-blocking warnings:
  - legacy provider proxy disabled because `LEGACY_PROVIDER_APP_BASE_URL` was not set
  - stale browser compatibility datasets
  - ambiguous Tailwind class `duration-[10s]`
- Emulator Suite startup: **passed**
- Emulator Hub verified:
  - Auth at `127.0.0.1:9099`
  - Functions at `127.0.0.1:5001`
  - Firestore at `127.0.0.1:8080`
  - Storage at `127.0.0.1:9199`
  - UI at `127.0.0.1:4000`
- Default-deny verification:
  - unauthenticated Firestore read returned HTTP `403 PERMISSION_DENIED`
  - unauthenticated Firestore write returned HTTP `403 PERMISSION_DENIED`
  - unauthenticated Storage read returned HTTP `403` with no read permission
  - unauthenticated Storage write returned HTTP `403` with no write permission

## Phase 1 completion

Phase 1 was completed and pushed as commit `c89f440`. Deterministic role fixtures and automated profile-rule tests were implemented during Phase 2.

## Phase 2 Firebase Authentication and employee profiles

- Installed Firebase browser SDK `12.16.0`, Vitest, and Firebase Rules Unit Testing.
- Added Firebase browser initialization for Authentication, Firestore, and Storage with development-only emulator connections.
- Added canonical Phase 2 employee roles and account statuses.
- Added Firebase authentication/profile service, context, unified provider adapter, and native MDX Fuel ATLAS CRM login screen.
- Updated application authentication and navigation tracking to use the selected provider.
- Firebase Auth remains shadow mode; `VITE_AUTH_PROVIDER=legacy` remains the local default.
- Firestore permits authenticated users to get only their own `userProfiles/{uid}` document.
- Browser profile list, create, update, and delete operations remain denied for every role.
- All unrelated Firestore collections remain default-deny.
- Added guarded deterministic emulator seeding for six test-only accounts.
- Added a durable 33-test Firestore Rules Unit Testing suite and automatic emulator wrapper.
- Added `docs/FIREBASE_LOCAL_DEVELOPMENT.md`.
- Firebase login and profile loading were verified locally with the seeded salesperson account.
- Authentication cutover is not approved because Leads, Opportunities, Tasks, and other CRM paths still depend on legacy provider.
- No Firebase deployment was performed, and no staging or production Firebase project was touched.

## Phase 2 verification evidence

- Targeted JavaScript lint: **no errors reported**; the existing root ESLint configuration does not cover the new JSX paths, so JSX validation relied on the production build.
- Functions lint: **passed**
- Functions TypeScript build: **passed**
- Firestore rules wrapper: **passed**, 33 of 33 tests; wrapper exit code `0`; emulator shut down automatically.
- Frontend production build: **passed** with exit code `0` and generated `dist/index.html`.
- Existing non-blocking build warnings remain:
  - legacy provider proxy disabled because local legacy provider configuration is absent
  - stale browser compatibility datasets
  - ambiguous Tailwind class `duration-[10s]`
- Direct Firebase-authenticated dashboard testing confirmed the remaining blocker: legacy legacy provider entity requests fail when direct-local legacy provider app ID/server URL values are absent.
- This blocker must be resolved by implementing and verifying Firebase replacements, not by deleting `the retired provider client module` prematurely.

## Phase 2 cutover decision

**No-go for authentication cutover.** Phase 2 is verified only as a shadow-mode implementation checkpoint. legacy provider remains the active provider until all dependent CRM entity and integration paths have independently implemented and verified replacements.

## Original baseline audit results

- Repository contained 266 tracked files and one commit in the supplied Git history.
- `main`, `origin/main`, and tag `historical-final-baseline-2026-07-17` pointed to `45ef9b8`.
- No tracked environment files, detected API keys, private keys, Firebase Admin credentials, or service-account material were found by pattern scan.
- No apparent customer dataset was found. Four email-like values were synthetic/example strings: `alex@corp.com`, `lisa@studio.io`, `jim@tech.net`, and `unknown@example.com`; UI placeholders also contained examples.
- This was a pattern-based source/history scan, not proof that no secret exists.
- Static audit found 70 frontend files mentioning legacy provider, 155 explicit static entity operations plus dynamic entity operations, 23 frontend function invocations, 23 direct Core integration call sites, 21 auth method call sites, 34 backend function definitions, 32 entity definitions, 3 workflows, and 1 legacy agent definition.
- The first `npm ci` attempt failed because the environment could not create its default cache and reported corrupted tarballs. Retrying with an isolated writable cache succeeded and installed 639 packages.
- Baseline `npm run build`: **passed**.
- Baseline `npm run typecheck`: **failed** with extensive pre-existing errors.
- Baseline `npm run lint`: **failed** with 416 pre-existing findings (343 errors and 73 warnings).

## Exact next implementation step

Complete the Phase 2 secret/unintended-change scan, review the final diff, then commit and push the verified shadow-mode checkpoint. Do not approve authentication cutover.
