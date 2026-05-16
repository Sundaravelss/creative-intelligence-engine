import type { LucideIcon } from "lucide-react";
import type { AgentId } from "@/lib/agentAvatars";

export type GenerationStatus = "running" | "complete" | "error";

export type AgentStepSubstepStatus = "joined" | "done" | "failed";

export interface AgentStepSubstep {
  label: string;
  status: AgentStepSubstepStatus;
}

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
  | { kind: "followups"; id: string; items: SuggestedFollowupItem[] }
  | { kind: "started"; id: string; ts: string }
  | {
      kind: "thought";
      id: string;
      agentId: AgentId | string;
      summary: string;
      fullText: string;
      elapsedSec: number;
      collapsed?: boolean;
    }
  | {
      kind: "agent_step";
      id: string;
      agentId: AgentId | string;
      label: string;
      completed: number;
      total: number;
      substeps: AgentStepSubstep[];
      collapsed?: boolean;
    }
  | {
      // Transient — appears while a node's adapter is streaming tokens.
      // The studio page mutates `finalized` per `text_delta` event and
      // flips `isStreaming` to false on `text_done`. The next canonical
      // event for the same agentId (`thought` / `agent_step_complete`)
      // replaces it in place via matching `id` (= node id).
      kind: "live_stream";
      id: string;
      agentId: AgentId | string;
      label: string;
      finalized: string;
      isStreaming: boolean;
    };
