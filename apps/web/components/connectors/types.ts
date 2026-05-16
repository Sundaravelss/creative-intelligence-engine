export type ConnectorStatus = "connected" | "not-connected" | "coming-soon";

export type ConnectorCategory =
  | "ai-backends"
  | "ad-platforms"
  | "social"
  | "analytics"
  | "commerce"
  | "research"
  | "email-crm";

export interface Connector {
  id: string;
  name: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  icon: string;
  description?: string;
  lastSync?: string;
}

export const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  "ai-backends": "AI Backends",
  "ad-platforms": "Ad Platforms",
  social: "Social",
  analytics: "Analytics",
  commerce: "Commerce",
  research: "Research",
  "email-crm": "Email & CRM",
};

// "ai-backends" is intentionally omitted: AI provider connectivity is
// driven by the agent runtime's adapter chain (services/agents/runtime.py)
// rather than user-facing OAuth toggles, so it shouldn't appear here.
//
// We also drop categories that have no surfaced connectors in the trimmed
// fixture (analytics / research / email-crm) so we don't render empty
// section headers. Add categories back as connectors are reintroduced.
export const CATEGORY_ORDER: ConnectorCategory[] = [
  "ad-platforms",
  "social",
  "commerce",
];
