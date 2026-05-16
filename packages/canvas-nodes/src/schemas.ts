import { z } from "zod";

/**
 * Zod schemas for the 9 CIE canvas node kinds.
 * Each schema describes the shape of `node.data` for a React Flow node.
 *
 * Mirror these shapes into services/api/schemas.py if/when the backend
 * needs to round-trip a graph. WS-B owns these definitions.
 */

export const formatSchema = z.enum(["reel", "square", "story", "banner"]);
export type CanvasFormat = z.infer<typeof formatSchema>;

export const briefNodeSchema = z.object({
  url: z.string().url().optional(),
  keyword: z.string().optional(),
  audience: z.string().optional(),
  hooks: z.array(z.string()).default([]),
});
export type BriefNodeData = z.infer<typeof briefNodeSchema>;

export const audienceNodeSchema = z.object({
  description: z.string(),
  demographics: z.string(),
  psychographics: z.string(),
});
export type AudienceNodeData = z.infer<typeof audienceNodeSchema>;

export const hookNodeSchema = z.object({
  text: z.string(),
  score: z.number().min(0).max(100).optional(),
});
export type HookNodeData = z.infer<typeof hookNodeSchema>;

export const imageGenNodeSchema = z.object({
  prompt: z.string(),
  model: z.string(),
  references: z.array(z.string()).default([]),
  format: formatSchema,
  artifactUrl: z.string().url().optional(),
});
export type ImageGenNodeData = z.infer<typeof imageGenNodeSchema>;

export const videoGenNodeSchema = z.object({
  prompt: z.string(),
  model: z.string(),
  duration: z.number().positive(),
  motion: z.string().optional(),
  camera: z.string().optional(),
  artifactUrl: z.string().url().optional(),
});
export type VideoGenNodeData = z.infer<typeof videoGenNodeSchema>;

export const variantNodeSchema = z.object({
  artifactId: z.string(),
  label: z.string(),
  artifactUrl: z.string().url().optional(),
});
export type VariantNodeData = z.infer<typeof variantNodeSchema>;

export const scoreNodeSchema = z.object({
  artifactId: z.string(),
  viralScore: z.number().min(0).max(100).optional(),
  hookScore: z.number().min(0).max(100).optional(),
  holdRate: z.number().min(0).max(1).optional(),
});
export type ScoreNodeData = z.infer<typeof scoreNodeSchema>;

export const scheduleNodeSchema = z.object({
  cron: z.string(),
  channel: z.string(),
  label: z.string(),
});
export type ScheduleNodeData = z.infer<typeof scheduleNodeSchema>;

export const adReferenceNodeSchema = z.object({
  url: z.string().url(),
  extracted: z.record(z.string(), z.unknown()).optional(),
});
export type AdReferenceNodeData = z.infer<typeof adReferenceNodeSchema>;

/**
 * Discriminated union of all node-data shapes, keyed by kind.
 * Use this when persisting / hydrating graphs.
 */
export const nodeDataByKind = {
  brief: briefNodeSchema,
  audience: audienceNodeSchema,
  hook: hookNodeSchema,
  imageGen: imageGenNodeSchema,
  videoGen: videoGenNodeSchema,
  variant: variantNodeSchema,
  score: scoreNodeSchema,
  schedule: scheduleNodeSchema,
  adReference: adReferenceNodeSchema,
} as const;

export type NodeKind = keyof typeof nodeDataByKind;

export type NodeDataByKind = {
  brief: BriefNodeData;
  audience: AudienceNodeData;
  hook: HookNodeData;
  imageGen: ImageGenNodeData;
  videoGen: VideoGenNodeData;
  variant: VariantNodeData;
  score: ScoreNodeData;
  schedule: ScheduleNodeData;
  adReference: AdReferenceNodeData;
};

/**
 * Returns a safe default `data` payload for a freshly-dropped node of a
 * given kind. Defaults are deliberately incomplete so the inspector can
 * prompt the user to fill them in.
 */
export function defaultDataFor<K extends NodeKind>(kind: K): NodeDataByKind[K] {
  switch (kind) {
    case "brief":
      return { hooks: [] } as unknown as NodeDataByKind[K];
    case "audience":
      return {
        description: "",
        demographics: "",
        psychographics: "",
      } as unknown as NodeDataByKind[K];
    case "hook":
      return { text: "" } as unknown as NodeDataByKind[K];
    case "imageGen":
      return {
        prompt: "",
        model: "fal-ai/flux/dev",
        references: [],
        format: "square",
      } as unknown as NodeDataByKind[K];
    case "videoGen":
      return {
        prompt: "",
        model: "fal-ai/sora-2",
        duration: 6,
      } as unknown as NodeDataByKind[K];
    case "variant":
      return { artifactId: "", label: "Variant" } as unknown as NodeDataByKind[K];
    case "score":
      return { artifactId: "" } as unknown as NodeDataByKind[K];
    case "schedule":
      return {
        cron: "0 9 * * MON",
        channel: "instagram",
        label: "Weekly drop",
      } as unknown as NodeDataByKind[K];
    case "adReference":
      return { url: "https://" } as unknown as NodeDataByKind[K];
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown node kind: ${String(_exhaustive)}`);
    }
  }
}
