/**
 * Canvas-local TS types. Kept narrow on purpose: the shared `Artifact`
 * type from `@cie/ui-artifacts` already covers rendering; the shapes
 * here track the Higgsfield-style canvas state (storyboard shots,
 * pinned references, locked characters, active mode).
 */

export type CanvasMode = "storyboard" | "marketing" | "advanced";

export const STORYBOARD_SHOT_KINDS = [
  "wide",
  "close",
  "side",
  "overhead",
  "tracking",
  "static",
] as const;

export type StoryboardShotKind = (typeof STORYBOARD_SHOT_KINDS)[number];

export interface MoodboardPin {
  id: string;
  url: string;
  label?: string;
  /** Optional source URL the pin was scraped or dropped from. */
  source?: string;
}

export interface CanvasCharacter {
  id: string;
  name: string;
  /** Single-line persona / identity description appended to prompts. */
  persona: string;
  /** 1-3 reference image URLs, kept on the character so the Art Director can pass them through. */
  referenceUrls: string[];
}

export type ExportFormat = "9:16" | "1:1" | "16:9";

export interface ShotVariant {
  id: string;
  label: string;
  url: string;
  /** Optional virality score in [0, 100]. */
  viralScore?: number;
}

export interface StoryboardShot {
  id: string;
  /** Camera-angle identifier (`wide`, `close`, …). */
  kind: StoryboardShotKind;
  /** Variants for this shot, in arrival order. */
  variants: ShotVariant[];
  /** Currently promoted variant id (defaults to highest score, then first). */
  heroVariantId: string | null;
}
