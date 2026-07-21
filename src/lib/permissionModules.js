// ---------------------------------------------------------------------------
// MDX portable module registry (Phase 3C.1)
//
// Centralized, dependency-free definition of every permission module in the
// CRM. This file is intentionally portable — it contains no ATLAS imports —
// so it travels unchanged when the app is exported and deployed independently.
//
// Future reserved modules are DECLARED here only (no pages/entities are built
// for them in this phase). Permission records are seeded ONLY for active
// modules; future modules are not activated merely by existing here.
// ---------------------------------------------------------------------------

export const MODULE_CATEGORIES = [
  { key: 'core_crm', label: 'Core CRM' },
  { key: 'sales_tools', label: 'Sales Tools' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'customer_success_cat', label: 'Customer Success' },
  { key: 'data_management', label: 'Data Management' },
  { key: 'system_management', label: 'System Management' },
  { key: 'future_reserved', label: 'Future Reserved (not active)' }
];

export const MODULES = [
  // -- Core CRM
  { key: 'dashboard', name: 'Dashboard', category: 'core_crm', description: 'Sales dashboard and overview widgets', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },
  { key: 'leads', name: 'Leads', category: 'core_crm', description: 'Lead pipeline and lead records', active: true, supports_ownership: true, supports_approval: false, supports_configuration: false },
  { key: 'opportunities', name: 'Opportunities', category: 'core_crm', description: 'Deal pipeline and opportunities', active: true, supports_ownership: true, supports_approval: true, supports_configuration: false },
  { key: 'tasks', name: 'Tasks', category: 'core_crm', description: 'Tasks and follow-ups', active: true, supports_ownership: true, supports_approval: false, supports_configuration: false },
  { key: 'activities', name: 'Activities', category: 'core_crm', description: 'Calls, emails, meetings and activity log', active: true, supports_ownership: true, supports_approval: false, supports_configuration: false },
  { key: 'clients', name: 'Clients', category: 'core_crm', description: 'Converted client records', active: true, supports_ownership: true, supports_approval: false, supports_configuration: false },

  // -- Sales Tools
  { key: 'reports', name: 'Reports', category: 'sales_tools', description: 'Sales reports and analytics', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },
  { key: 'automations', name: 'Automations', category: 'sales_tools', description: 'Automation rules and sequences', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'sales_galaxy', name: 'Sales Galaxy', category: 'sales_tools', description: 'Sales Galaxy visualization', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },
  { key: 'atlas', name: 'ATLAS Assistant', category: 'sales_tools', description: 'ATLAS AI sales assistant', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },

  // -- Marketing
  { key: 'marketing_sequences', name: 'Marketing Sequences', category: 'marketing', description: 'Outbound marketing sequences', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'marketing_templates', name: 'Marketing Templates', category: 'marketing', description: 'Email/SMS/LinkedIn templates', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },

  // -- Customer Success
  { key: 'customer_success', name: 'Customer Success', category: 'customer_success_cat', description: 'Client success management and onboarding', active: true, supports_ownership: true, supports_approval: false, supports_configuration: false },

  // -- Data Management
  { key: 'imports', name: 'Imports', category: 'data_management', description: 'Bulk record imports', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },
  { key: 'exports', name: 'Exports', category: 'data_management', description: 'Bulk record exports', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },
  { key: 'duplicate_management', name: 'Duplicate Management', category: 'data_management', description: 'Duplicate detection and merge', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },

  // -- System Management
  { key: 'users', name: 'User Management', category: 'system_management', description: 'Employee directory and user accounts', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'teams', name: 'Teams', category: 'system_management', description: 'Team definitions', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'territories', name: 'Territories', category: 'system_management', description: 'Sales territories and service areas', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'roles_permissions', name: 'Roles & Permissions', category: 'system_management', description: 'Role definitions and permission matrix', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'pipeline_configuration', name: 'Pipeline Configuration', category: 'system_management', description: 'Pipeline stages and checklists', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'custom_fields', name: 'Custom Fields', category: 'system_management', description: 'Custom data fields', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'system_tags', name: 'System Tags', category: 'system_management', description: 'Global tag library', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'workflow_configuration', name: 'Workflow Configuration', category: 'system_management', description: 'Workflows and scheduled tasks', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'organization_settings', name: 'Organization Settings', category: 'system_management', description: 'Company branding and organization config', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'audit_logs', name: 'Audit Logs', category: 'system_management', description: 'System audit trail', active: true, supports_ownership: false, supports_approval: false, supports_configuration: false },
  { key: 'integrations', name: 'Integrations', category: 'system_management', description: 'External service connectors', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'security_settings', name: 'Security Settings', category: 'system_management', description: 'Security and ownership controls (Super Administrator)', active: true, supports_ownership: false, supports_approval: false, supports_configuration: true },

  // -- Future Reserved (declared only, NOT active — no pages or entities yet)
  { key: 'companies', name: 'Companies', category: 'future_reserved', description: 'Company/account records (future)', active: false, supports_ownership: true, supports_approval: false, supports_configuration: false },
  { key: 'contacts', name: 'Contacts', category: 'future_reserved', description: 'Standalone contacts (future)', active: false, supports_ownership: true, supports_approval: false, supports_configuration: false },
  { key: 'products', name: 'Products', category: 'future_reserved', description: 'Product catalog (future)', active: false, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'pricing', name: 'Pricing', category: 'future_reserved', description: 'Pricing rules (future)', active: false, supports_ownership: false, supports_approval: false, supports_configuration: true },
  { key: 'quotes', name: 'Quotes', category: 'future_reserved', description: 'Quotes and approvals (future)', active: false, supports_ownership: true, supports_approval: true, supports_configuration: false },
  { key: 'cases', name: 'Cases', category: 'future_reserved', description: 'Support cases (future)', active: false, supports_ownership: true, supports_approval: false, supports_configuration: false },
  { key: 'calendar', name: 'Calendar', category: 'future_reserved', description: 'Shared calendar (future)', active: false, supports_ownership: false, supports_approval: false, supports_configuration: false },
  { key: 'website_integration', name: 'Website Integration', category: 'future_reserved', description: 'Website lead capture (future)', active: false, supports_ownership: false, supports_approval: false, supports_configuration: true }
];

export const ACTIVE_MODULES = MODULES.filter((m) => m.active);
export const ACTIVE_MODULE_KEYS = ACTIVE_MODULES.map((m) => m.key);
export const MODULE_KEYS = MODULES.map((m) => m.key);
export const MODULE_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m]));
export const CATEGORY_BY_KEY = Object.fromEntries(MODULE_CATEGORIES.map((c) => [c.key, c.label]));

export function isValidModuleKey(key) {
  return MODULE_KEYS.includes(key);
}
export function isActiveModuleKey(key) {
  return ACTIVE_MODULE_KEYS.includes(key);
}

// Centralized action names.
export const PERMISSION_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'assign', 'export', 'approve', 'manage_configuration'
];
export const ACTION_FLAGS = [
  'can_view', 'can_create', 'can_edit', 'can_delete', 'can_assign', 'can_export', 'can_approve', 'can_manage_configuration'
];

export const RECORD_SCOPES = ['none', 'own', 'team', 'all'];
export const SCOPE_RANK = { none: 0, own: 1, team: 2, all: 3 };

// Map of sidebar navigation page -> module key (used for presentation filtering).
// Settings is intentionally omitted: personal Profile and Notifications access
// is always preserved, and the Settings link is never hidden by module scope.
export const NAV_MODULE_MAP = {
  Dashboard: 'dashboard',
  Leads: 'leads',
  Opportunities: 'opportunities',
  ActNow: 'atlas',
  Tasks: 'tasks',
  Reports: 'reports',
  Automations: 'automations',
  SalesGalaxy: 'sales_galaxy',
  CSManagement: 'customer_success',
  MarketingSequences: 'marketing_sequences',
  MarketingTemplates: 'marketing_templates'
};