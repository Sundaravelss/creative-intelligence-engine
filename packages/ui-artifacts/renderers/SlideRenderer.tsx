"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../shared/cn";
import type { SlidesArtifact } from "../types";

interface SlideRendererProps {
  artifact: SlidesArtifact;
  className?: string;
}

export function SlideRenderer({ artifact, className }: SlideRendererProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const slide = artifact.slides[activeIdx];
  if (!slide) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}>
        No slides
      </div>
    );
  }

  const prev = () => setActiveIdx((i: number) => Math.max(0, i - 1));
  const next = () => setActiveIdx((i: number) => Math.min(artifact.slides.length - 1, i + 1));

  return (
    <div className={cn("flex w-full h-full gap-4", className)}>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 hc-card p-8 overflow-y-auto">
          {slide.title && (
            <h2 className="hc-serif-headline text-3xl font-semibold mb-4">{slide.title}</h2>
          )}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide.content}</ReactMarkdown>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            disabled={activeIdx === 0}
            className="hc-pill px-3 py-1.5 text-xs hc-glass disabled:opacity-40 flex items-center gap-1"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-xs text-muted-foreground">
            {activeIdx + 1} / {artifact.slides.length}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={activeIdx === artifact.slides.length - 1}
            className="hc-pill px-3 py-1.5 text-xs hc-glass disabled:opacity-40 flex items-center gap-1"
            aria-label="Next slide"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <aside className="w-32 flex flex-col gap-2 overflow-y-auto hc-scrollbar-none">
        {artifact.slides.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveIdx(idx)}
            className={cn(
              "h-20 hc-card text-left p-2 text-[10px] leading-tight transition",
              idx === activeIdx
                ? "ring-2 ring-[color:var(--hc-accent-coral)]"
                : "opacity-70 hover:opacity-100",
            )}
            aria-current={idx === activeIdx}
            aria-label={`Slide ${idx + 1}: ${s.title ?? ""}`}
          >
            <span className="font-semibold line-clamp-1">{s.title ?? `Slide ${idx + 1}`}</span>
          </button>
        ))}
      </aside>
    </div>
  );
}
