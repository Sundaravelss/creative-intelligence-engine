// Minimal model registry. Forked from Open-Gen-AI packages/studio/models.js.
// TODO WS-C: expand to 200+ models from Open-Gen-AI fork (FAL, Replicate,
// OpenAI Image, Gemini Imagen, Stability, Veo, Kling, Sora 2, Nano-Banana, etc.).

/**
 * @typedef {Object} StudioModel
 * @property {string} id
 * @property {"image" | "video"} kind
 * @property {string} provider
 * @property {Record<string, unknown>} params
 */

/** @type {StudioModel[]} */
export const models = [
  {
    id: "fal-ai/flux/dev",
    kind: "image",
    provider: "fal",
    params: { width: 1024, height: 1024, num_inference_steps: 28 },
  },
  {
    id: "fal-ai/flux/schnell",
    kind: "image",
    provider: "fal",
    params: { width: 1024, height: 1024, num_inference_steps: 4 },
  },
  {
    id: "fal-ai/sora-2",
    kind: "video",
    provider: "fal",
    params: { duration: 8, aspect_ratio: "9:16" },
  },
  {
    id: "openai/gpt-image-2",
    kind: "image",
    provider: "openai",
    params: { size: "1024x1024", quality: "high" },
  },
];

/** @param {string} id */
export function findModel(id) {
  return models.find((m) => m.id === id) ?? null;
}

/** @param {"image" | "video"} kind */
export function modelsByKind(kind) {
  return models.filter((m) => m.kind === kind);
}
