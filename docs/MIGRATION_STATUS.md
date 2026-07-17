# Migration Status

Last updated: 2026-07-17

## Current state

- Active phase: Phase 0 — baseline audit and documentation
- Baseline verified: tag and commit identity verified; working tree was clean at audit start
- Base44 removed: no
- Firebase runtime added: no
- Production cutover authorized: no
- `base44/` rename authorized: no; unsafe until runtime and reference material are separated and Phase 13 gates pass

## Phase status

| Phase | Status | Exit evidence |
|---:|---|---|
| 0 | Audit complete; documentation uncommitted | Inventory/docs created; production build passed; baseline typecheck and lint failures recorded |
| 1–14 | Not started | None |

## Audit results

- Repository contains 266 tracked files and one commit in the supplied Git history.
- `main`, `origin/main`, and tag `base44-final-baseline-2026-07-17` point to `45ef9b8`.
- No tracked environment files, detected API keys, private keys, Firebase Admin credentials, or service-account material were found by pattern scan.
- No apparent customer dataset was found. Four email-like values are synthetic/example strings: `alex@corp.com`, `lisa@studio.io`, `jim@tech.net`, and `unknown@example.com`; UI placeholders also contain examples.
- This is a pattern-based source/history scan, not proof that no secret exists. Add automated secret scanning and GitHub push protection in Phase 1.
- Static audit found 70 frontend files mentioning Base44, 155 explicit static entity operations plus dynamic entity operations, 23 frontend function invocations, 23 direct Core integration call sites, 21 auth method call sites, 34 backend function definitions, 32 entity definitions, 3 workflows, and 1 legacy agent definition.
- The first `npm ci` attempt failed because the environment could not create its default cache and reported corrupted tarballs. Retrying with an isolated writable cache succeeded and installed 639 packages.
- `npm run build`: **passed**. Warnings: Base44 proxy disabled without `VITE_BASE44_APP_BASE_URL`, stale browser compatibility data, and ambiguous Tailwind class `duration-[10s]`.
- `npm run typecheck`: **failed** with exit 2. The baseline checks JavaScript dependencies/source broadly and reports extensive existing errors, including `three` package checking and application component/React Query typing errors. No migration code caused these errors.
- `npm run lint`: **failed** with exit 1: 416 existing findings (343 errors, 73 warnings), dominated by unused imports/variables. These were not altered because Phase 0 prohibits unrelated code changes.

## Exact next implementation step

Create branch `migration/phase-1-firebase-foundation` from the accepted Phase 0 commit. Add Firebase CLI configuration, separate dev/staging/prod environment conventions, Functions TypeScript skeleton, default-deny Firestore/Storage rules, Auth/Firestore/Functions/Storage emulators, deterministic role fixtures, and the first deny-by-default emulator tests—without changing any existing Base44 runtime path.
