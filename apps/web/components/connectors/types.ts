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

export const CATEGORY_ORDER: ConnectorCategory[] = [
  "ai-backends",
  "ad-platforms",
  "social",
  "analytics",
  "commerce",
  "research",
  "email-crm",
];
