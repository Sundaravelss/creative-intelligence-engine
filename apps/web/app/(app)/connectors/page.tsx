"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../../lib/api";
import { ConnectorsGrid } from "../../../components/connectors/ConnectorsGrid";
import { ConnectModal } from "../../../components/connectors/ConnectModal";
import type { Connector } from "../../../components/connectors/types";

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get<Connector[]>("/api/connectors");
      // Allowlist: show only the demo-essential connectors, no matter what
      // the backend fixture currently contains. Keeps the page tight and
      // resilient to fixture-rewriting workflows. To surface more, append
      // here — keep ai-backends out (driven by adapter chain, not OAuth).
      const allow = new Set([
        "meta-ads",
        "tiktok-ads",
        "google-ads",
        "instagram",
        "shopify",
      ]);
      const filtered = Array.isArray(data)
        ? data.filter((c) => allow.has(c.id))
        : [];
      setConnectors(filtered);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to load connectors";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleConnectClick = useCallback((id: string) => {
    setModalId(id);
  }, []);

  const handleSubmit = useCallback(
    async (id: string, payload: { username?: string; api_key?: string }) => {
      await api.post(`/api/connectors/${id}/connect`, payload);
      await refetch();
    },
    [refetch],
  );

  const handleDisconnect = useCallback(
    async (id: string) => {
      await api.delete(`/api/connectors/${id}/connect`);
      await refetch();
    },
    [refetch],
  );

  const modalConnectorName = useMemo(() => {
    return connectors.find((c) => c.id === modalId)?.name ?? null;
  }, [connectors, modalId]);

  const summary = useMemo(() => {
    // Exclude ai-backends so the summary matches the visible grid (the
    // ai-backends category is hidden — see CATEGORY_ORDER in
    // components/connectors/types.ts).
    const visible = connectors.filter((c) => c.category !== "ai-backends");
    const connected = visible.filter((c) => c.status === "connected").length;
    return `${connected} connected · ${visible.length} total`;
  }, [connectors]);

  return (
    <main className="min-h-screen p-8 md:p-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="hc-serif-headline text-3xl font-semibold">Connectors</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Connect your marketing stack — ad platforms, social, analytics, commerce, research,
            and CRM.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">{summary}</div>
      </header>

      {error ? (
        <div className="hc-card border-destructive/30 mb-6 border p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading connectors…</div>
      ) : (
        <ConnectorsGrid
          connectors={connectors}
          onConnect={handleConnectClick}
          onDisconnect={handleDisconnect}
        />
      )}

      <ConnectModal
        connectorId={modalId}
        connectorName={modalConnectorName}
        onClose={() => setModalId(null)}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
