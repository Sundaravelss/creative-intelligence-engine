// Cross-cutting types shared by frontend (apps/web, packages/canvas-nodes,
// packages/ui-artifacts) and backend (services/api/schemas.py mirrors these).
//
// IMPORTANT: this file is frozen at end of WS-0. Adding fields is OK;
// renaming or removing fields requires a coordinated change across all
// consumers and a mirror update in services/api/schemas.py.

export type ArtifactKind = "image" | "video" | "document" | "code";

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  url?: string;
  name: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
  costUsd?: number;
  /** Shot id this artifact is a variant of. Artifacts sharing the same
   *  `variantOf` are grouped into a VariantStack on the canvas.
   *  Pre-WS-V1 callers may omit this. */
  variantOf?: string;
  /** Human-readable variant label (e.g. "editorial", "golden-hour"). */
  variantLabel?: string;
}

export type ConnectorStatus = "connected" | "not-connected" | "coming-soon";

export type ConnectorCategory =
  | "ad-platforms"
  | "social"
  | "analytics"
  | "commerce"
  | "research"
  | "email-crm"
  | "ai-backends";

export interface Connector {
  id: string;
  name: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  lastSync?: string;
  icon?: string;
  description?: string;
}

export interface BrandProduct {
  id: string;
  name: string;
  sku?: string;
}

export interface BrandProfile {
  id: string;
  name: string;
  logoUrl?: string;
  palette: string[];
  voice?: string;
  products: BrandProduct[];
}

export interface Brief {
  url?: string;
  keyword?: string;
  audience?: string;
  competitors?: string[];
  positioning?: string;
  hooks: string[];
}

export interface ScoreBreakdown {
  aspect: number;
  motion: number;
  hookDensity: number;
  contrast: number;
  novelty: number;
}

export interface ScoreResult {
  viralScore: number;
  hookScore: number;
  holdRate: number;
  breakdown: ScoreBreakdown;
}

export type CampaignFormat = "reel" | "square" | "story" | "banner" | "carousel";

// WS-C — generation router request body. Mirror of
// services/api/schemas.py::GenerateRequest.
export type GenerateKind = "image" | "video";

export interface GenerateRequest {
  kind: GenerateKind;
  model: string;
  params: Record<string, unknown>;
  references?: string[];
}
