# ATLAS Architecture

## Identity

There is exactly one user-facing assistant:

- Name: **ATLAS**
- Attribution: **Powered by Aurora Intelligence Systems**
- Legacy legacy provider identifier: `SalesAssistant` (reference only during migration)

No independent migration component may introduce a second assistant or expose `SalesAssistant` in user-facing text.

## Provider-neutral design

The React UI calls the trusted `invokeAtlasAi` Firebase callable. The backend selects a provider adapter, with provider/model policy held server-side. The initial adapter uses the OpenAI Responses and Images APIs, but the gateway depends only on the provider-neutral `AtlasAiProvider` contract.

`ATLAS_OPENAI_API_KEY` is a Firebase Secret Manager parameter. `ATLAS_TEXT_MODEL` and `ATLAS_IMAGE_MODEL` are server runtime parameters. None are accepted in callable payloads or returned to the browser. The Firestore `system/aiConfiguration` document remains the server-controlled kill switch. Missing or invalid configuration fails closed.

## Authorization and context

ATLAS authenticates the user and resolves effective module permissions before retrieving CRM context. Retrieval queries use the same own/team/all constraints as ordinary record access. The model never receives records the caller could not retrieve directly. Tool calls repeat authorization at execution time to prevent confused-deputy and stale-permission issues.

The callable accepts record identifiers, not trusted record bodies. Supported Lead, Opportunity, Activity, and Task references are loaded by trusted code and checked against the caller's effective ATLAS scope. Uploaded images and documents are addressed by Firebase Storage paths; the backend verifies the authenticated owner, metadata, size, and media type before reading them.

Write-capable tools require explicit typed contracts, validation, authorization, audit logging, and user confirmation for material actions. Permanent deletion is excluded without explicit authorization.

## Required usage record

Every request writes an immutable server-side usage event with user ID, provider, model, input tokens, output tokens, estimated cost, request type, timestamp, correlation ID, status, and latency. Do not store full prompts/responses by default; define redaction, retention, and privileged diagnostic access before enabling content logging.

Usage events are stored in `atlasAiUsage/{correlationId}`. Firestore rules expose no client read or write path for this collection. Prompts, responses, uploaded file contents, and provider error bodies are not recorded.

## Files and images

- CSV, text, and Excel extraction is deterministic inside trusted Functions code and does not send file contents to an AI provider.
- Vision requests accept only owned JPEG, PNG, or WebP Storage objects and pass bounded in-memory data to the configured provider.
- Generated images are persisted under `users/{uid}/generated/...` with ATLAS provenance and a SHA-256 digest. Storage rules permit only the active owner to read or delete them and deny client creation.

## Conversation and writes

The current conversation adapter is deliberately stateless and keeps at most 20 messages in browser memory; at most 10 recent messages are sent per request. This avoids creating a second, inadequately governed content-retention store. Durable conversation storage requires a separately approved retention policy.

Phase 11 exposes no write-capable CRM tools. ATLAS can analyze and draft, but cannot claim to have changed CRM data. Any future tool must add a typed contract, reauthorization, audit logging, idempotency, and explicit confirmation for material actions.

## Migration mapping

Firebase frontend adapters now route general AI, structured analysis, ATLAS conversation, document extraction, vision import, and image generation through `invokeAtlasAi`. Provider-backed success remains operationally disabled until the server mode and Secret Manager credential are configured and an authorized deployment occurs.
