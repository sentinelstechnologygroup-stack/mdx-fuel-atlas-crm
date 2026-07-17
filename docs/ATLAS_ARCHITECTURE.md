# ATLAS Architecture

## Identity

There is exactly one user-facing assistant:

- Name: **ATLAS**
- Attribution: **Powered by Aurora Intelligence Systems**
- Legacy Base44 identifier: `SalesAssistant` (reference only during migration)

No independent migration component may introduce a second assistant or expose `SalesAssistant` in user-facing text.

## Provider-neutral design

The React UI calls a trusted `atlasRequest` backend contract. The backend selects a configured provider adapter (for example OpenAI or Anthropic), with provider/model policy held server-side. Provider keys live in Secret Manager and are never returned to the browser.

## Authorization and context

ATLAS authenticates the user and resolves effective module permissions before retrieving CRM context. Retrieval queries use the same own/team/all constraints as ordinary record access. The model never receives records the caller could not retrieve directly. Tool calls repeat authorization at execution time to prevent confused-deputy and stale-permission issues.

Write-capable tools require explicit typed contracts, validation, authorization, audit logging, and user confirmation for material actions. Permanent deletion is excluded without explicit authorization.

## Required usage record

Every request writes an immutable server-side usage event with user ID, provider, model, input tokens, output tokens, estimated cost, request type, timestamp, correlation ID, status, and latency. Do not store full prompts/responses by default; define redaction, retention, and privileged diagnostic access before enabling content logging.

## Migration mapping

Current AI paths include the Base44 conversation agent, lead scoring/analysis, activity summaries, stale follow-up summaries, report insights, import extraction/vision, email drafting, automation generation, and opportunity coaching. Each path remains Base44-backed until its independent equivalent passes permission, quality, cost-logging, failure, and UI parity tests.

