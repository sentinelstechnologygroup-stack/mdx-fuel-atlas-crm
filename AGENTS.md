# Repository Operating Rules

- Preserve all existing CRM functionality, layouts, schemas, workflow logic, assistant definitions, permissions, and historical work.
- Do not delete or retire a file until its replacement is implemented, tested, and approved.
- Use Firebase Authentication, Cloud Firestore, Firebase Storage, Firebase Functions or Cloud Run, App Check, and default-deny security rules.
- Keep privileged operations and provider credentials server-side.
- Do not deploy unless Patrick explicitly authorizes deployment.
- Do not run `npm audit fix` or `npm audit fix --force`.
- Validate changes with the production build, emulator tests, Functions build/lint, and focused manual regression testing.
