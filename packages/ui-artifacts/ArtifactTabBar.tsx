"use client";

import { useEffect, useRef } from "react";
import { cn } from "./shared/cn";
import type { Artifact } from "./types";

interface ArtifactTabBarProps {
  artifacts: Artifact[];
  activeId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

function previewSnippet(artifact: Artifact): string {
  switch (artifact.type) {
    case "document":
    case "code":
      return artifact.content.slice(0, 80);
    case "image":
      return artifact.alt ?? "Image";
    case "video":
      return "Video";
    case "slides":
      return `${artifact.slides.length} slides`;
    case "table":
      return `${artifact.rows.length} rows · ${artifact.columns.length} cols`;
    case "webpage":
      return artifact.snippet ?? artifact.url;
  }
}

export function ArtifactTabBar({
  artifacts,
  activeId,
  onSelect,
  className,
}: ArtifactTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-artifact-tab="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  return (
    <div
      className={cn(
        "hc-glass border-t border-[color:var(--color-border,oklch(0.92_0_0))] px-3 py-2",
        className,
      )}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto hc-scrollbar-none hc-snap-x"
        role="tablist"
        aria-label="Artifacts"
      >
        {artifacts.map((a) => (
          <button
            key={a.id}
            data-artifact-tab={a.id}
            type="button"
            role="tab"
            aria-selected={activeId === a.id}
            onClick={() => onSelect(a.id)}
            className={cn(
              "hc-snap-center shrink-0 w-44 text-left rounded-lg px-3 py-2 transition border",
              activeId === a.id
                ? "bg-[color:var(--hc-surface-elevated)] border-[color:var(--hc-accent-coral)] shadow-sm"
                : "bg-transparent border-transparent hover:bg-[oklch(0.96_0_0)] opacity-80 hover:opacity-100",
            )}
          >
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--hc-accent-coral)]">
              {a.type}
            </div>
            <div className="text-xs font-medium truncate">{a.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {previewSnippet(a)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
