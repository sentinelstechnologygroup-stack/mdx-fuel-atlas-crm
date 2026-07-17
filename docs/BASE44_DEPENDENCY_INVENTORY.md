# Base44 Dependency Inventory

Audit baseline: commit `45ef9b8`, 2026-07-17. This inventory records static source references. Dynamic entity dispatch means raw regex counts are lower than total runtime operations; update this file when a path is migrated.

## Platform and bootstrap dependencies

| Location | Dependency | Replacement |
|---|---|---|
| `package.json` | `@base44/sdk`, `@base44/vite-plugin` | Firebase web SDK/provider-neutral adapters; remove only Phase 13 |
| `vite.config.js` | Base44 Vite plugin | plain Vite after import/runtime parity |
| `src/api/base44Client.js` | client creation | Firebase/browser API composition |
| `src/lib/app-params.js` | Base44 URL/token/session parameters | Firebase environment/auth initialization |
| `src/lib/AuthContext.jsx` | Base44 auth and internal axios helper | Firebase Auth context |
| `src/lib/NavigationTracker.jsx` | Base44 app logs | independent analytics/audit event |
| `base44/config.jsonc` | Base44 application config | legacy reference through Phase 13 |

## Static frontend usage summary

- 70 source files contain `base44` references.
- 155 explicit static `base44.entities.<Entity>.<operation>` call sites were counted; additional calls use `base44.entities[entityName]` or `[config.entity_type]` dynamically.
- 23 `base44.functions.invoke(...)` call sites target 17 distinct named functions.
- 23 direct `base44.integrations.Core.*` call sites were counted: InvokeLLM 10, UploadFile 5, ExtractDataFromUploadedFile 2, SendEmail 2, GenerateImage 1, SendSMS 1, plus two additional extraction/export-style occurrences identified by the static matcher.
- 21 auth method call sites: `me` 12, `logout` 4, `updateMe` 1, `redirectToLogin` 1, with remaining auth references/configuration captured in source mapping.
- Conversation operations: create, subscribe, and add message through `base44.agents`.

### Entity references by observed static frequency

| Entity | Calls | Entity | Calls | Entity | Calls |
|---|---:|---|---:|---|---:|
| Activity | 7 | AuditLog | 1 | AutomationLog | 2 |
| AutomationRule | 6 | Client | 4 | CustomField | 5 |
| DiscoveryData | 3 | Invite | 3 | Lead | 27 |
| MarketingSequence | 3 | MarketingTemplate | 4 | ModulePermission | 1 |
| Notification | 3 | NotificationSettings | 4 | OnboardingTemplate | 4 |
| Opportunity | 18 | OrganizationSettings | 3 | Query | 1 |
| ReportConfig | 6 | RoleDefinition | 2 | SequenceStep | 3 |
| StepTransition | 3 | Task | 20 | Team | 6 |
| Territory | 5 | User | 11 | UserPermissionOverride | 1 |

Dynamic report, transfer, and automation paths can address other entities and must be tested separately.

## Frontend named function invocations

`bootstrapSuperAdmin`, `bulkTransferRecords`, `convertOpportunityToClient`, `createCustomRole`, `deactivateUserWithTransfer`, `deleteAccount`, `exportReport`, `getEffectivePermissions`, `initializePermissionModel`, `listUsers`, `ownershipMigrationReview`, `reassignRecord`, `summarizeActivity`, `updateModulePermission`, `updateRoleDefinition`, `updateUserAccount`, and `updateUserPermissionOverride`.

Backend-only/workflow functions not directly invoked by a static frontend name include authorized CRUD/count/export helpers, scoring and workflow handlers, report/email jobs, demo/date maintenance, and historical synchronization.

## Base44 entity definitions (32)

`Activity`, `AuditLog`, `AutomationLog`, `AutomationRule`, `AutomationTrigger`, `Client`, `ContactPersona`, `CustomField`, `DiscoveryData`, `Invite`, `Lead`, `MarketingSequence`, `MarketingTemplate`, `ModulePermission`, `Notification`, `NotificationSettings`, `OnboardingTemplate`, `Opportunity`, `OrganizationSettings`, `RecordTransferHistory`, `ReportConfig`, `RoleDefinition`, `SalesTarget`, `SequenceActivityLog`, `SequenceEnrollment`, `SequenceStep`, `StepTransition`, `Task`, `Team`, `Territory`, `User`, and `UserPermissionOverride`.

Note: the filesystem contains 32 JSONC files despite earlier approximate counts; this list is authoritative for the supplied baseline.

## Base44 backend functions (34)

| Function | Migration responsibility |
|---|---|
| `authorizedRecords` | shared authorization/ownership policy |
| `bootstrapSuperAdmin` | secure one-time bootstrap with lockout/audit |
| `bulkTransferRecords` | atomic/batched ownership transfer |
| `convertOpportunityToClient` | transactional conversion/idempotency |
| `createAuthorizedRecord` | authorized create and controlled metadata |
| `createCustomRole` | privileged role creation/audit |
| `deactivateUserWithTransfer` | Auth disable + retained profile + transfer |
| `deleteAccount` | retention-safe account deactivation/deletion workflow |
| `deleteAuthorizedRecord` | authorized soft delete/retention |
| `emailReportSummary` | trusted email provider operation |
| `exportAuthorizedRecords` | scoped export and audit |
| `exportReport` | scoped report generation/export |
| `findStaleOpportunities` | scheduled stale detection/idempotency |
| `fixDemoDates` | development-only maintenance; production exposure review |
| `generateWeeklySalesReport` | scheduled aggregation/export |
| `getAuthorizedRecord` | scoped single-record read |
| `getAuthorizedRecordCounts` | scoped aggregation/count |
| `getEffectivePermissions` | canonical permission resolution |
| `handleHighScoreLead` | atomic qualified status/task/notification |
| `initializePermissionModel` | controlled seed/migration |
| `listAuthorizedRecords` | scoped queries/pagination |
| `listUsers` | directory visibility policy |
| `ownershipMigrationReview` | ownership reconciliation tooling |
| `reassignRecord` | atomic transfer plus history |
| `recheckAndFollowUp` | delayed stale recheck and ATLAS summary |
| `scoreNewLead` | ATLAS scoring with permission/cost audit |
| `seedDemoData` | emulator/dev-only fixture seeding |
| `summarizeActivity` | ATLAS summary with scoped inputs |
| `syncHistoricalClients` | idempotent migration/reconciliation |
| `updateAuthorizedRecord` | scoped update/protected fields |
| `updateModulePermission` | privileged permission update/audit |
| `updateRoleDefinition` | privileged role lifecycle/audit |
| `updateUserAccount` | privileged Auth/profile update |
| `updateUserPermissionOverride` | privileged override lifecycle/audit |

## Workflows (3)

Detailed acceptance criteria are in `WORKFLOW_PARITY_MATRIX.md`:

1. New Lead Qualification
2. Stale Opportunity Follow-up
3. Weekly Sales Report

## ATLAS and AI dependencies

- `base44/agents/SalesAssistant.jsonc`: single legacy agent definition.
- `src/components/ai/SalesAssistantChat.jsx`: conversation create/subscribe/message path.
- `src/components/ai/atlasConfig.js`: approved public ATLAS branding and legacy identifier boundary.
- InvokeLLM call sites support lead analysis/import, opportunity strategy/objections, report insights, automation assistance, email editing, and Act Now guidance.
- Backend/workflow AI paths include lead scoring, stale follow-up summaries, activity summarization, and report generation.

All independent replacements require server-side provider keys, permission-filtered context, provider neutrality, token/cost usage records, rate limits, redaction, and failure behavior.

## File, messaging, and external integration dependencies

- Uploads: common file upload, client documents, AI lead import, and import wizard.
- Structured extraction: import upload processing and AI lead import.
- Email: automation rules and weekly report backend path.
- SMS and image generation are exported/observed capabilities; confirm whether they are actively reachable before replacement or retirement.
- `SettingsContext.jsx` contains a public Supabase-hosted image URL under a Base44 production path. It is not a credential, but the asset must be copied to controlled storage before Base44/Supabase availability is assumed removable.
- Stripe packages are installed; no Base44 replacement decision is implied. Reachability/configuration must be audited in the relevant module phase.

## High-risk findings

1. Several pages perform direct entity list/create/update/delete operations; backend function protections do not cover all current paths.
2. Dynamic entity access in reports, automation, and bulk transfer expands the authorization surface beyond named static references.
3. Frontend automation code sends email and updates arbitrary entity names; the independent version must move execution to trusted backend code.
4. Current Vite build is coupled to the Base44 plugin.
5. Base44 auth is configured with `requiresAuth: false` at client creation while application context applies auth behavior; exact anonymous behavior must be captured before Phase 2 cutover.
6. The legacy directory name cannot safely become `atlas` now and would misleadingly conflate the whole Base44 backend with the assistant.

## Retirement gate

The SDK, Vite plugin, client, app parameters, auth helpers, entity/function/integration/agent calls, public hosted asset, backend definitions, and workflow definitions remain until their individual parity rows are verified. Only then may Phase 13 remove runtime dependencies and move preserved definitions to `legacy/base44/`.
