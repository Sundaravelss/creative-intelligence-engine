"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ConnectModalProps {
  connectorId: string | null;
  connectorName: string | null;
  onClose: () => void;
  onSubmit: (id: string, payload: { username?: string; api_key?: string }) => Promise<void>;
}

export function ConnectModal({
  connectorId,
  connectorName,
  onClose,
  onSubmit,
}: ConnectModalProps) {
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connectorId) {
      setUsername("");
      setApiKey("");
      setError(null);
    }
  }, [connectorId]);

  useEffect(() => {
    if (!connectorId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectorId, onClose]);

  if (!connectorId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(connectorId, {
        username: username.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="hc-card hc-glass-strong hc-fade-in relative z-10 w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 id="connect-modal-title" className="hc-display text-lg font-semibold">
              Connect {connectorName ?? connectorId}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Mock OAuth — credentials are not stored.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground">Username / account</span>
            <input
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-border focus:border-ring focus:ring-ring/30 rounded-md border bg-background px-3 py-2 outline-none focus:ring-2"
              placeholder="me@brand.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground">API key / token</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="border-border focus:border-ring focus:ring-ring/30 rounded-md border bg-background px-3 py-2 font-mono outline-none focus:ring-2"
              placeholder="sk-..."
            />
          </label>

          {error ? (
            <div className="text-destructive text-xs" role="alert">
              {error}
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="hc-pill px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="hc-pill bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Connecting…" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
