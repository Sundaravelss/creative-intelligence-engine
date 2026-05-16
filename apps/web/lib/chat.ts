/**
 * Typed client for the Studio chat-session persistence API.
 *
 * Backend: `services/api/routers/chat.py` (SQLite via SQLModel).
 * Endpoints under `/api/chat/sessions`. The frontend stores `kind` + `payload`
 * for each event; on hydrate we reconstruct the original `ChatMessage`
 * discriminated union from `apps/web/components/studio/chat/types.ts`.
 */

import { api } from "@/lib/api";
import type { ChatMessage } from "@/components/studio/chat/types";

export interface ChatSessionSummary {
  id: string;
  title: string;
  brand_id: string | null;
  adapter: string | null;
  fallback: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SessionWithMessages {
  session: ChatSessionSummary;
  messages: ChatMessageRow[];
}

export interface CreateSessionInput {
  title?: string;
  brand_id?: string;
  adapter?: string;
  fallback?: string;
}

export interface PatchSessionInput {
  title?: string;
  adapter?: string;
  fallback?: string;
}

export const chat = {
  listSessions: (limit = 50): Promise<ChatSessionSummary[]> =>
    api.get<ChatSessionSummary[]>(`/api/chat/sessions?limit=${limit}`),
  createSession: (input: CreateSessionInput = {}): Promise<ChatSessionSummary> =>
    api.post<ChatSessionSummary>("/api/chat/sessions", input),
  getSession: (id: string): Promise<SessionWithMessages> =>
    api.get<SessionWithMessages>(`/api/chat/sessions/${encodeURIComponent(id)}`),
  patchSession: (id: string, input: PatchSessionInput): Promise<ChatSessionSummary> =>
    api.patch<ChatSessionSummary>(
      `/api/chat/sessions/${encodeURIComponent(id)}`,
      input,
    ),
  deleteSession: (id: string): Promise<void> =>
    api.delete<void>(`/api/chat/sessions/${encodeURIComponent(id)}`),
  appendMessage: (
    id: string,
    body: { kind: string; payload: Record<string, unknown> },
  ): Promise<ChatMessageRow> =>
    api.post<ChatMessageRow>(
      `/api/chat/sessions/${encodeURIComponent(id)}/messages`,
      body,
    ),
};

/**
 * Reconstruct a `ChatMessage` (the frontend discriminated union) from a
 * persisted `{ kind, payload }` row. The Studio page uses this on hydrate.
 *
 * Falls back to the wrapped `payload` when the kind isn't recognized so
 * future event kinds added by the orchestrator don't break old sessions.
 */
export function chatMessageFromRow(row: ChatMessageRow): ChatMessage {
  return { kind: row.kind, ...(row.payload as object) } as ChatMessage;
}

/**
 * Convert an in-memory `ChatMessage` back into the `{kind, payload}` shape
 * the persistence API expects. Strips `kind` from payload to avoid duplicate
 * data on reload.
 */
export function chatMessageToAppendInput(message: ChatMessage): {
  kind: string;
  payload: Record<string, unknown>;
} {
  const { kind, ...rest } = message as Record<string, unknown> & {
    kind: string;
  };
  return { kind, payload: rest };
}
