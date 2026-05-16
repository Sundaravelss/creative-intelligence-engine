// Stub MuAPI client. Real provider wiring happens in WS-C inside
// services/api/adapters_gen/{fal,openai_image}.py. This file exists so the
// frontend can import a stable surface today.

/**
 * Submit a generation job. Wired in WS-C.
 * @param {string} _model
 * @param {Record<string, unknown>} _params
 * @returns {Promise<{ id: string }>}
 */
export async function submit(_model, _params) {
  return Promise.reject(new Error("muapi.submit() not implemented — wired in WS-C"));
}

/**
 * Poll a generation job. Wired in WS-C.
 * @param {string} _id
 * @returns {Promise<{ status: string, url?: string }>}
 */
export async function poll(_id) {
  return Promise.reject(new Error("muapi.poll() not implemented — wired in WS-C"));
}
