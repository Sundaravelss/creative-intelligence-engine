/**
 * Model registry — single source of truth for image / video / lipsync /
 * upscale / edit models surfaced by the canvas.
 *
 * Forked + typed from `apps/studio/models.js` and the Open-Generative-AI
 * registry (Anil-matcha/Open-Generative-AI). Backend mirrors this in
 * `services/api/model_registry.py`; keep the two in sync.
 */

export type ModelKind =
  | "image"
  | "image-edit"
  | "video"
  | "video-edit"
  | "lipsync"
  | "upscale"
  | "audio";

export type ModelProvider = "fal" | "openai" | "bedrock";

export interface ModelEntry {
  /** Provider-prefixed id; FAL ids are e.g. `fal-ai/flux/dev`. */
  id: string;
  /** Short display name surfaced in pickers. */
  name: string;
  kind: ModelKind;
  provider: ModelProvider;
  /**
   * `single` accepts only one input (text prompt or one reference).
   * `dual` swaps modes (t2i ↔ i2i, t2v ↔ i2v) when refs are supplied.
   * `multi` accepts up to `multiImageLimit` references.
   */
  inputMode: "single" | "dual" | "multi";
  multiImageLimit?: number;
  /** Default per-model parameters used when the inspector hasn't overridden anything. */
  params: Record<string, unknown>;
  /** Free-form tags surfaced in filters (`viral`, `cinema`, `fast`, etc.). */
  tags?: ReadonlyArray<string>;
}

export const MODELS: ReadonlyArray<ModelEntry> = [
  // -- Image (fast) ---------------------------------------------------------
  {
    id: "fal-ai/flux/schnell",
    name: "Flux Schnell",
    kind: "image",
    provider: "fal",
    inputMode: "single",
    params: { width: 1024, height: 1024, num_inference_steps: 4 },
    tags: ["fast", "default"],
  },
  {
    id: "fal-ai/flux/dev",
    name: "Flux Dev",
    kind: "image",
    provider: "fal",
    inputMode: "single",
    params: { width: 1024, height: 1024, num_inference_steps: 28 },
    tags: ["quality"],
  },
  {
    id: "fal-ai/nano-banana-2",
    name: "Nano Banana 2 (Flash Im)",
    kind: "image",
    provider: "fal",
    inputMode: "dual",
    multiImageLimit: 6,
    params: { aspect_ratio: "9:16" },
    tags: ["viral", "default-canvas"],
  },
  // -- Image edit / multi-ref ----------------------------------------------
  {
    id: "fal-ai/flux-kontext-edit",
    name: "Flux Kontext Edit",
    kind: "image-edit",
    provider: "fal",
    inputMode: "multi",
    multiImageLimit: 14,
    params: {},
    tags: ["edit"],
  },
  {
    id: "openai/gpt-image-2",
    name: "GPT Image 2",
    kind: "image",
    provider: "openai",
    inputMode: "single",
    params: { size: "1024x1024", quality: "high" },
    tags: ["text", "fallback"],
  },
  // -- Video ---------------------------------------------------------------
  {
    id: "fal-ai/sora-2",
    name: "Sora 2",
    kind: "video",
    provider: "fal",
    inputMode: "dual",
    params: { duration: 8, aspect_ratio: "9:16" },
    tags: ["cinema", "default-video"],
  },
  {
    id: "fal-ai/kling-video/v2",
    name: "Kling Video 2",
    kind: "video",
    provider: "fal",
    inputMode: "dual",
    params: { duration: 5, aspect_ratio: "9:16" },
    tags: ["motion"],
  },
  {
    id: "fal-ai/veo-3",
    name: "Veo 3",
    kind: "video",
    provider: "fal",
    inputMode: "dual",
    params: { duration: 8, aspect_ratio: "16:9" },
    tags: ["quality"],
  },
  {
    id: "fal-ai/seedance-2",
    name: "Seedance 2.0",
    kind: "video",
    provider: "fal",
    inputMode: "dual",
    params: { duration: 6, aspect_ratio: "9:16" },
    tags: ["fast"],
  },
  // -- Lipsync -------------------------------------------------------------
  {
    id: "fal-ai/sync-lipsync",
    name: "Sync Lipsync",
    kind: "lipsync",
    provider: "fal",
    inputMode: "multi",
    multiImageLimit: 2,
    params: {},
    tags: ["talking-head"],
  },
  // -- Upscale -------------------------------------------------------------
  {
    id: "fal-ai/topaz-upscale",
    name: "Topaz Upscale",
    kind: "upscale",
    provider: "fal",
    inputMode: "single",
    params: { scale: 2 },
    tags: [],
  },
];

export function findModel(id: string): ModelEntry | null {
  return MODELS.find((m) => m.id === id) ?? null;
}

export function modelsByKind(kind: ModelKind): ReadonlyArray<ModelEntry> {
  return MODELS.filter((m) => m.kind === kind);
}

export function defaultModelFor(kind: ModelKind): ModelEntry | null {
  const tagged = MODELS.find(
    (m) => m.kind === kind && m.tags?.includes("default-canvas"),
  );
  if (tagged) return tagged;
  const taggedDefault = MODELS.find(
    (m) => m.kind === kind && m.tags?.includes("default"),
  );
  if (taggedDefault) return taggedDefault;
  const first = MODELS.find((m) => m.kind === kind);
  return first ?? null;
}
