# Login Portal Release Control

The employee login portal is closed by default while ATLAS CRM is under construction.

## Current behavior

- Without configuration, the application displays a build-in-progress screen.
- Login and password-reset controls are not rendered.
- The UI does not mount the Firebase Auth provider while the portal is closed.
- Firebase Authentication code, Firestore rules, permissions, routes, and historical implementation remain preserved.

## Reopening the portal

Set the following build-time environment variable only after Patrick approves reopening:

```text
VITE_LOGIN_PORTAL_ENABLED=true
```

Then produce and validate a new deployment candidate. Values other than the exact lowercase string `true`, including a missing variable, keep the portal closed.

Reopening still requires the normal production build, emulator regression tests, role walkthroughs, App Check/configuration confirmation, and an explicitly authorized deployment. This switch is a presentation/release control; it does not replace Firebase security rules.
