"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Columns3, Grid2x2, Layers } from "lucide-react";
import { cn } from "./shared/cn";
import type { Artifact, ViewMode } from "./types";
import { ArtifactCard } from "./ArtifactCard";
import { ArtifactRenderer } from "./renderers/ArtifactRenderer";
import { ArtifactTabBar } from "./ArtifactTabBar";

interface ArtifactCarouselProps {
  artifacts: Artifact[];
  focusId?: string | null;
  onFocusChange?: (id: string) => void;
  className?: string;
  defaultViewMode?: ViewMode;
}

export function ArtifactCarousel({
  artifacts,
  focusId,
  onFocusChange,
  className,
  defaultViewMode = "focus",
}: ArtifactCarouselProps) {
  const [internalActive, setInternalActive] = useState<string | null>(
    focusId ?? artifacts[0]?.id ?? null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const activeId = focusId ?? internalActive;

  const select = useCallback(
    (id: string) => {
      setInternalActive(id);
      onFocusChange?.(id);
    },
    [onFocusChange],
  );

  useEffect(() => {
    if (!activeId && artifacts[0]) {
      select(artifacts[0].id);
    }
  }, [artifacts, activeId, select]);

  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-artifact-id="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId, viewMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== "[" && e.key !== "]") return;
      if (artifacts.length === 0) return;
      e.preventDefault();
      const idx = artifacts.findIndex((a) => a.id === activeId);
      const nextIdx =
        e.key === "]"
          ? Math.min(artifacts.length - 1, idx + 1)
          : Math.max(0, idx - 1);
      select(artifacts[nextIdx].id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [artifacts, activeId, select]);

  if (artifacts.length === 0) return null;

  return (
    <section
      className={cn(
        "flex flex-col h-full min-w-[420px] w-[44vw] max-w-[760px] hc-glass border-l border-[color:var(--color-border,oklch(0.92_0_0))] hc-slide-in-right",
        className,
      )}
      aria-label="Artifacts"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border,oklch(0.92_0_0))]">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {artifacts.length} {artifacts.length === 1 ? "artifact" : "artifacts"}
        </span>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </header>

      <div
        ref={scrollerRef}
        className={cn(
          "flex-1 min-h-0 overflow-auto p-4",
          viewMode === "focus" && "flex gap-4 hc-snap-x overflow-y-hidden hc-scrollbar-none",
          viewMode === "grid" && "grid grid-cols-2 gap-4 auto-rows-[28rem]",
          viewMode === "stack" && "flex flex-col gap-4",
        )}
      >
        {artifacts.map((a) => (
          <div
            key={a.id}
            data-artifact-id={a.id}
            className={cn(
              viewMode === "focus" && "shrink-0 w-full max-w-full h-full hc-snap-center",
              viewMode === "stack" && "h-[32rem]",
              viewMode === "grid" && "h-full",
            )}
            onClick={() => select(a.id)}
          >
            <ArtifactCard artifact={a} isActive={a.id === activeId}>
              <ArtifactRenderer artifact={a} />
            </ArtifactCard>
          </div>
        ))}
      </div>

      <ArtifactTabBar artifacts={artifacts} activeId={activeId} onSelect={select} />
    </section>
  );
}

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}

function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  const opts: Array<{ id: ViewMode; icon: typeof Columns3; label: string }> = [
    { id: "focus", icon: Columns3, label: "Focus" },
    { id: "grid", icon: Grid2x2, label: "Grid" },
    { id: "stack", icon: Layers, label: "Stack" },
  ];
  return (
    <div className="hc-pill hc-glass-strong p-0.5 flex items-center" role="tablist" aria-label="View mode">
      {opts.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "hc-pill px-2.5 py-1 text-xs flex items-center gap-1 transition",
            value === id ? "bg-[color:var(--hc-surface-elevated)] shadow-sm" : "opacity-60 hover:opacity-100",
          )}
          aria-label={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
