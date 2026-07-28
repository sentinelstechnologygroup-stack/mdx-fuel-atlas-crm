<!-- docs/FIREBASE_LOCAL_DEVELOPMENT.md -->
# Firebase Local Development

Firebase Authentication and employee profiles operate in Phase 2 shadow mode. legacy provider remains the default provider until dependent CRM entity calls have verified Firebase replacements.

## Commands

- Start emulators: `firebase emulators:start --only "auth,firestore,functions,storage"`
- Seed emulator accounts: `npm run seed:emulators`
- Run isolated rules tests: `npm run test:rules:emulator`
- Test an already-running Firestore emulator: `npm run test:rules`

All emulator accounts use the test-only password `AtlasTest!2026`. Seeded emails are `superadmin@example.test`, `admin@example.test`, `supervisor@example.test`, `salesperson@example.test`, `viewer@example.test`, and `inactive@example.test`.

Never commit `.env.local`, access tokens, Admin credentials, service-account files, or provider secrets. Do not remove `the retired provider client module` until every dependent path has an independently implemented and verified Firebase replacement.
