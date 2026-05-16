import type { LucideIcon } from "lucide-react";

export type GenerationStatus = "running" | "complete" | "error";

export interface GenerationChipData {
  id: string;
  label: string;
  promptSummary: string;
  modelName: string;
  status: GenerationStatus;
  elapsedSec: number;
  etaSec: number;
  shotId?: string;
  variantId?: string;
  artifactId?: string;
}

export interface SuggestedFollowupItem {
  icon: LucideIcon;
  label: string;
  query: string;
}

export type ChatMessage =
  | { kind: "user"; id: string; text: string; timestamp: string }
  | {
      kind: "reasoning";
      id: string;
      text: string;
      collapsed?: boolean;
      title?: string;
    }
  | { kind: "generation"; id: string; chips: GenerationChipData[] }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "followups"; id: string; items: SuggestedFollowupItem[] };
