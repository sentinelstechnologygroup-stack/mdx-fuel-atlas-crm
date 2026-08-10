# Patch Engine

PowerShell orchestrates this repository-local Node tool, which applies reviewed deterministic source changes.

It rejects path traversal and symlinks; preserves UTF-8 without BOM and LF content; requires exact single anchors; supports before/after SHA-256 checks; writes atomically; backs up modified files; rolls back a failed patch; and validates Git state plus the protected `src/pages/ActNow.jsx` hash. Patch definitions cannot target that protected file. It never merges, deploys, manages secrets, or mutates Git.

## Production secret boundary

Patch definitions may declare secret bindings in source, but they must never contain secret values or invoke deployment/secret-management commands.

```powershell
node tools/patch-engine/applyPatch.js phase10-notification-bridge
```

Definitions live in `tools/patch-engine/patches/`. Local backups are stored under `.patch-engine-backups/<patch-id>/` with a `.bak` suffix so test runners never discover them as executable source.
