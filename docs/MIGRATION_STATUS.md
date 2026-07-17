# Migration Status

Last updated: 2026-07-17

## Current state

- Active phase: Phase 1 — Firebase structure and emulators
- Baseline verified: tag and commit identity verified
- Firebase development project: `mdx-fuel-atlas-crm-dev` (`485940537312`)
- Firestore location: `nam5`
- Firebase foundation added: yes; configuration and Functions scaffold only
- Frontend connected to Firebase runtime: no
- Base44 removed: no
- Production cutover authorized: no
- `base44/` rename authorized: no; unsafe until runtime and reference material are separated and Phase 13 gates pass
- Deployment performed: no

## Phase status

| Phase | Status | Exit evidence |
|---:|---|---|
| 0 | Complete | Baseline inventory and migration documentation committed; baseline production build passed; pre-existing typecheck and lint findings recorded |
| 1 | In progress — foundation checkpoint verified; commit pending | Firebase dev project configured; Auth enabled; Firestore created; Functions scaffold builds; four emulators verified; default-deny rules manually verified |
| 2–14 | Not started | None |

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
- No existing Base44 runtime path was changed.
- No staging or production Firebase project was touched.
- No Firebase deployment was performed.

## Phase 1 verification evidence

- Functions lint: **passed**
- Functions TypeScript build: **passed**
- Frontend production build: **passed** with exit code `0`
- Frontend build retained the existing non-blocking warnings:
  - Base44 proxy disabled because `VITE_BASE44_APP_BASE_URL` was not set
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

## Phase 1 remaining work

Before Phase 1 receives its final exit approval:

1. Add deterministic emulator fixtures for the planned user roles and authorization scopes.
2. Add durable automated emulator tests instead of relying only on manual REST probes.
3. Add automated secret scanning and GitHub push protection where repository administration permits.
4. Record the final Phase 1 commit and remote branch identity.
5. Issue an explicit Phase 1 go/no-go decision.

## Original baseline audit results

- Repository contained 266 tracked files and one commit in the supplied Git history.
- `main`, `origin/main`, and tag `base44-final-baseline-2026-07-17` pointed to `45ef9b8`.
- No tracked environment files, detected API keys, private keys, Firebase Admin credentials, or service-account material were found by pattern scan.
- No apparent customer dataset was found. Four email-like values were synthetic/example strings: `alex@corp.com`, `lisa@studio.io`, `jim@tech.net`, and `unknown@example.com`; UI placeholders also contained examples.
- This was a pattern-based source/history scan, not proof that no secret exists.
- Static audit found 70 frontend files mentioning Base44, 155 explicit static entity operations plus dynamic entity operations, 23 frontend function invocations, 23 direct Core integration call sites, 21 auth method call sites, 34 backend function definitions, 32 entity definitions, 3 workflows, and 1 legacy agent definition.
- The first `npm ci` attempt failed because the environment could not create its default cache and reported corrupted tarballs. Retrying with an isolated writable cache succeeded and installed 639 packages.
- Baseline `npm run build`: **passed**.
- Baseline `npm run typecheck`: **failed** with extensive pre-existing errors.
- Baseline `npm run lint`: **failed** with 416 pre-existing findings (343 errors and 73 warnings).

## Exact next implementation step

Review every Phase 1 changed and generated file, confirm that only intended Firebase foundation and migration-status changes are present, and inspect the diff for secrets or unrelated modifications before creating the checkpoint commit.
