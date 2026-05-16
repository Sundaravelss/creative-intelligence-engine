// Typed fetch wrapper for the Creative Intelligence Engine.
// Mirrors my_paperclip/apps/hyperclip-ui/src/lib/api.ts but talks to the
// FastAPI gateway via NEXT_PUBLIC_API_BASE_URL (default http://localhost:8100).

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}`);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8100";

function joinUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${trimmed}`;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, signal } = opts;
  const init: RequestInit = {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(joinUrl(path), init);
  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      parsed,
      typeof parsed === "object" && parsed && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : `HTTP ${res.status}`,
    );
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T,>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, opts),
  post: <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  put: <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T,>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};

export const API_BASE_URL = BASE_URL;
