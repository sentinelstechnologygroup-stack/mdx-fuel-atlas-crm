// Centralized ATLAS assistant identity for MDX Fuel Sales CRM.
//
// The internal Base44 agent identifier ("SalesAssistant") is intentionally
// preserved for compatibility with the existing working assistant connection.
// ATLAS is the user-facing brand; "SalesAssistant" must never be shown to users.
//
// This abstraction prepares the architecture for a future Aurora Intelligence
// Systems provider without changing current assistant behavior.
export const ATLAS = {
  displayName: "ATLAS",
  formalName: "ATLAS AI",
  providerAttribution: "Powered by Aurora Intelligence Systems",
  // Preserved internal identifier — do not expose to users.
  legacyAgentIdentifier: "SalesAssistant",
  greeting:
    "Hello. I'm ATLAS, your intelligent CRM and sales assistant. I can help you review leads, analyze opportunities, prepare follow-ups, organize tasks, evaluate sales activity, and work with your authorized CRM information. What would you like to work on?",
};

// App-level brand identity for MDX Fuel (Phase 1 controlled rebrand).
export const MDX_BRAND = {
  fullName: "MDX Fuel Sales CRM",
  shortName: "MDX CRM",
};