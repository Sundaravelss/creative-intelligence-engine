"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "./api";

/**
 * Generic typed SSE hook. Mirrors the resilient reconnection logic from
 * my_paperclip/apps/hyperclip-ui/src/components/thread/useThreadEvents.ts
 * but generic over the event payload type.
 *
 * Usage:
 *   const { events, connected, error } = useSSE<{ kind: string }>("/api/agents/campaign/abc");
 */

interface UseSSEReturn<T> {
  events: T[];
  connected: boolean;
  error: Error | null;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

function joinSseUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const trimmed = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${trimmed}`;
}

export function useSSE<T = unknown>(url: string | null | undefined): UseSSEReturn<T> {
  const [events, setEvents] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!url) {
      setEvents([]);
      setConnected(false);
      return;
    }

    function connect(targetUrl: string) {
      cleanup();

      const es = new EventSource(joinSseUrl(targetUrl));
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
        backoffRef.current = INITIAL_BACKOFF_MS;
      };

      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data) as T;
          setEvents((prev) => [...prev, parsed]);
        } catch {
          setEvents((prev) => [...prev, { raw: event.data } as unknown as T]);
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        esRef.current = null;

        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
        setError(new Error(`SSE connection lost. Reconnecting in ${delay / 1000}s...`));

        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect(targetUrl);
        }, delay);
      };
    }

    connect(url);

    return () => {
      mountedRef.current = false;
      cleanup();
      setConnected(false);
    };
  }, [url, cleanup]);

  return { events, connected, error };
}
