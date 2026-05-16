"use client";

/**
 * Chat history sidebar for Studio.
 *
 * Lists prior persisted sessions from `/api/chat/sessions`. Top-of-list
 * "New chat" button creates a fresh session and bumps the page to
 * `/studio?session=<id>`. Click a row to load its thread.
 *
 * Self-contained — no upstream `studio/page.tsx` edits needed. Drop into
 * the AppShell sidebar slot or render directly inside Studio when other
 * sessions stop editing the page.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { chat, type ChatSessionSummary } from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatHistorySidebarProps {
  className?: string;
  /** Called after a session is created so the page can clear its in-memory thread. */
  onCreate?: (sessionId: string) => void;
  /** Called after a row is clicked so the page can hydrate from server state. */
  onSelect?: (sessionId: string) => void;
}

export function ChatHistorySidebar({
  className,
  onCreate,
  onSelect,
}: ChatHistorySidebarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("session");

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await chat.listSessions();
      setSessions(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onNewChat = useCallback(async () => {
    try {
      const created = await chat.createSession({});
      onCreate?.(created.id);
      router.replace(`/studio?session=${encodeURIComponent(created.id)}`);
      void refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }, [onCreate, refresh, router]);

  const onClickRow = useCallback(
    (id: string) => {
      onSelect?.(id);
      router.replace(`/studio?session=${encodeURIComponent(id)}`);
    },
    [onSelect, router],
  );

  const onDeleteRow = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await chat.deleteSession(id);
        if (activeId === id) router.replace("/studio");
        void refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to delete session");
      }
    },
    [activeId, refresh, router],
  );

  return (
    <aside
      data-testid="cie-chat-history"
      className={cn(
        "flex h-full flex-col gap-3 px-3 py-4 text-sm",
        className,
      )}
    >
      <Button
        type="button"
        variant="default"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={onNewChat}
        data-testid="cie-new-chat-btn"
      >
        <Plus className="h-4 w-4" />
        New chat
      </Button>

      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Recent
      </div>

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {loading && sessions.length === 0 ? (
          <li className="text-xs text-muted-foreground">Loading…</li>
        ) : null}
        {!loading && sessions.length === 0 ? (
          <li className="text-xs text-muted-foreground">No chats yet.</li>
        ) : null}
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onClickRow(s.id)}
              data-testid="cie-chat-row"
              data-active={activeId === s.id ? "true" : "false"}
              className={cn(
                "group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left",
                "hover:bg-muted/60",
                activeId === s.id && "bg-muted/80 ring-1 ring-border",
              )}
            >
              <span className="line-clamp-1 flex-1">{s.title}</span>
              <span
                role="button"
                aria-label={`Delete ${s.title}`}
                onClick={(e) => void onDeleteRow(s.id, e)}
                className="hidden text-muted-foreground transition hover:text-red-500 group-hover:inline"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
