# Permission Model

## Roles

Hierarchy, highest to lowest:

1. Super Administrator
2. Administrator
3. Supervisor / Sales Manager
4. Salesperson
5. Viewer / Support User

Roles provide defaults; they do not bypass explicit backend checks. Super Administrator capabilities are powerful but still audited.

## Module permissions

Each module supports `viewOwn`, `viewTeam`, `viewAll`, `create`, `edit`, `delete`, `assign`, `export`, `approve`, and `manageConfiguration`. A permission result is derived from active account status, role definition, module definition, user overrides, record scope, and protected-field rules. Explicit deny overrides allow. Unknown roles/modules/actions deny.

## Enforcement

- Firestore and Storage rules enforce direct browser access.
- Trusted functions independently compute authorization for every privileged operation.
- Frontend permission hooks control presentation only and are never security boundaries.
- List queries must constrain owner/team fields to a scope allowed by rules.
- Administrative writes, role/override edits, transfers, exports, approvals, and hard-delete-like actions are backend-only.

## Ownership and lifecycle

Major records require owner, creator, modifier, team, supervisor, created/updated/last-activity timestamps, and transfer history. Clients cannot change creator/audit fields. Assignment changes occur through a trusted transfer operation that writes the record update and append-only transfer event atomically.

User deactivation disables access but preserves the user profile and historical identifiers. A previewable, atomic transfer process reassigns open records while keeping original creator/modifier history. No cascading deletion is permitted.

## Minimum test matrix

For every migrated module, test anonymous, inactive, Viewer/Support, Salesperson, Supervisor, Administrator, and Super Administrator accounts against own, same-team, other-team, and unassigned records. Test read/list/create/update/delete/assign/export/approve/configuration actions plus forged owner/team/role/audit fields. Both allow and deny evidence are required.

