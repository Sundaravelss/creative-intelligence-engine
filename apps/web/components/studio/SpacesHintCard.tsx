"use client";

import { ArrowRight, Layers } from "lucide-react";

export function SpacesHintCard() {
  return (
    <a
      href="/spaces"
      data-testid="cie-spaces-hint"
      className="group fixed bottom-6 right-6 z-30 w-72 rounded-2xl border border-border/60 bg-white/80 p-4 shadow-xl backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-200 to-pink-200 text-foreground/80">
          <Layers className="size-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium tracking-tight">
              We&apos;ve saved some Space for you
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Spaces are defined workflows that help your brand achieve a specific
            task. Try them out →
          </p>
        </div>
      </div>
    </a>
  );
}
