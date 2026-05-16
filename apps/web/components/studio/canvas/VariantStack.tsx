"use client";

import { ChevronDown, Eye, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artifact } from "@cie/ui-artifacts";
import { ArtifactRenderer } from "@cie/ui-artifacts";
import { ScoreChip } from "../../canvas/ScoreChip";
import type { CanvasViewMode } from "./ViewModeToggle";

interface VariantStackProps {
  shotId: string;
  variants: Artifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  viewMode: CanvasViewMode;
}

function variantLabel(a: Artifact): string {
  const meta = a.source ?? "";
  if (meta) return meta;
  return a.name;
}

function viralScoreOf(a: Artifact): number | undefined {
  // Artifact (ui-artifacts) doesn't carry meta; the carousel page level
  // injects scores into the source artifact.meta when scoring completes.
  // Read score off `a` defensively via a structural cast.
  const meta = (a as unknown as { meta?: { viralScore?: number } }).meta;
  return meta?.viralScore;
}

export function VariantStack({
  shotId,
  variants,
  selectedId,
  onSelect,
  viewMode,
}: VariantStackProps) {
  if (variants.length === 0) return null;

  if (viewMode === "stack") {
    return (
      <div className="relative h-[460px] w-[340px]" data-shot-id={shotId}>
        {variants.map((v, idx) => {
          const offset = idx - Math.floor(variants.length / 2);
          const isSelected = v.id === selectedId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className={cn(
                "absolute inset-0 transition-transform",
                isSelected ? "z-30" : "z-10",
              )}
              style={{
                transform: isSelected
                  ? "rotate(0deg) translateY(0)"
                  : `rotate(${offset * 3}deg) translateY(${Math.abs(offset) * 6}px)`,
              }}
            >
              <ArtifactCardFrame
                artifact={v}
                isSelected={isSelected}
                showLabel={isSelected}
              />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-4",
        viewMode === "grid" && "flex-wrap",
      )}
      data-shot-id={shotId}
    >
      {variants.map((v) => {
        const isSelected = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={cn(
              "shrink-0 transition-all",
              viewMode === "carousel" &&
                (isSelected ? "scale-100" : "scale-95 opacity-70 hover:opacity-90"),
            )}
            style={{
              width: viewMode === "grid" ? "calc(50% - 0.5rem)" : "340px",
            }}
          >
            <ArtifactCardFrame artifact={v} isSelected={isSelected} showLabel />
          </button>
        );
      })}
    </div>
  );
}

interface ArtifactCardFrameProps {
  artifact: Artifact;
  isSelected: boolean;
  showLabel: boolean;
}

function ArtifactCardFrame({
  artifact,
  isSelected,
  showLabel,
}: ArtifactCardFrameProps) {
  const score = viralScoreOf(artifact);
  return (
    <article
      className={cn(
        "group relative aspect-[3/4] w-full overflow-visible rounded-2xl",
        "border border-white/30 bg-white/60 shadow-2xl backdrop-blur-sm",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-3xl",
        isSelected && "ring-2 ring-[oklch(0.66_0.18_25)] ring-offset-2 ring-offset-transparent",
      )}
    >
      {showLabel ? (
        <span className="absolute -top-3 left-3 z-20 inline-flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
          <span className="truncate">{variantLabel(artifact)}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
        </span>
      ) : null}
      <div className="absolute right-2 top-2 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
          <Eye className="h-3 w-3" />
        </span>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
          <Maximize2 className="h-3 w-3" />
        </span>
      </div>
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <ArtifactRenderer artifact={artifact} />
      </div>
      {score !== undefined ? (
        <div className="absolute bottom-2 right-2 z-20">
          <ScoreChip score={score} size="sm" />
        </div>
      ) : null}
    </article>
  );
}
