# ATLAS Reference Definitions

This directory preserves the complete entity schemas, assistant definition, workflow definitions, and backend function logic created before the Firebase-native implementation. Nothing in this directory is deleted or discarded.

The files under `functions/` are parity references, not deployed Firebase Functions. Port each function into `functions/src/` using Firebase Admin SDK services, then verify authorization, side effects, audit logging, error behavior, and UI parity before marking the reference as implemented.

The files under `entities/` are the source model for Firestore collection and validation design. The files under `workflows/` preserve automation behavior for the Firebase workflow engine.
