"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../../../lib/api";
import { LoopForm } from "../../../components/loops/LoopForm";
import { LoopList } from "../../../components/loops/LoopList";
import { RunHistory } from "../../../components/loops/RunHistory";
import type { CreateLoopInput, Loop, LoopRun } from "../../../components/loops/types";

export default function LoopsPage() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<LoopRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetchLoops = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get<Loop[]>("/api/loops");
      setLoops(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Failed to load loops");
    } finally {
      setLoading(false);
    }
  }, []);

  const refetchRuns = useCallback(async (loopId: string) => {
    setRunsLoading(true);
    try {
      const data = await api.get<LoopRun[]>(`/api/loops/${loopId}/runs`);
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetchLoops();
  }, [refetchLoops]);

  useEffect(() => {
    if (!selectedId) {
      setRuns([]);
      return;
    }
    void refetchRuns(selectedId);
  }, [selectedId, refetchRuns]);

  const handleCreate = useCallback(
    async (input: CreateLoopInput) => {
      const created = await api.post<Loop>("/api/loops", input);
      await refetchLoops();
      if (created?.id) setSelectedId(created.id);
    },
    [refetchLoops],
  );

  const handleRunNow = useCallback(
    async (id: string) => {
      await api.post(`/api/loops/${id}/run-now`);
      setSelectedId(id);
      await refetchRuns(id);
    },
    [refetchRuns],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await api.delete(`/api/loops/${id}`);
      if (selectedId === id) setSelectedId(null);
      await refetchLoops();
    },
    [selectedId, refetchLoops],
  );

  return (
    <main className="min-h-screen p-8 md:p-10">
      <header className="mb-8">
        <h1 className="hc-serif-headline text-3xl font-semibold">Loops</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Recurring publishing jobs scheduled with cron. Each loop runs the orchestrator and
          publishes to its target channel.
        </p>
      </header>

      {error ? (
        <div className="hc-card border-destructive/30 mb-6 border p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <LoopForm onCreate={handleCreate} />
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading loops…</div>
          ) : (
            <LoopList
              loops={loops}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRunNow={handleRunNow}
              onDelete={handleDelete}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="hc-display text-lg font-semibold">
            Run history{selectedId ? ` · ${selectedId}` : ""}
          </h2>
          {selectedId ? (
            <RunHistory runs={runs} loading={runsLoading} />
          ) : (
            <div className="hc-card text-muted-foreground p-5 text-sm">
              Select a loop to view its run history.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
