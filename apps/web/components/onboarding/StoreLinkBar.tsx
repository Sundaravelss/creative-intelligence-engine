"use client";

// Sticky bottom bar with the gradient halo for Phase 2.
// Renders a glass card containing the URL input + Skip + Scan buttons.

import { useState } from "react";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StoreLinkBarProps {
  onScan: (url: string) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function StoreLinkBar({ onScan, onSkip, disabled }: StoreLinkBarProps) {
  const [url, setUrl] = useState("");
  const trimmed = url.trim();
  const canScan = trimmed.length > 3;

  return (
    <div className="pointer-events-none fixed bottom-8 left-0 right-0 z-30 flex justify-center px-4">
      <div className="pointer-events-auto relative w-full max-w-[640px]">
        {/* Purple → peach halo */}
        <div
          aria-hidden="true"
          className="absolute -inset-6 -z-10 rounded-[2rem] opacity-90 blur-2xl"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.75 0.16 305 / 0.45) 0%, transparent 45%, transparent 55%, oklch(0.85 0.13 65 / 0.55) 100%)",
          }}
        />

        <div
          className={cn(
            "rounded-2xl border border-white/50 bg-white/90 p-4 shadow-xl",
            "backdrop-blur-xl",
          )}
        >
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="size-4" />
            <span>Add your store link</span>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canScan && !disabled) onScan(trimmed);
            }}
          >
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.allbirds.com"
              autoFocus
              disabled={disabled}
              aria-label="Store URL"
              className={cn(
                "flex-1 bg-transparent px-3 py-2 text-base text-foreground outline-none",
                "placeholder:text-muted-foreground/70",
                "disabled:opacity-50",
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSkip}
              disabled={disabled}
              className="rounded-full px-4 text-muted-foreground hover:text-foreground"
            >
              Skip
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canScan || disabled}
              className="rounded-full bg-foreground px-4 text-background hover:bg-foreground/90"
            >
              Scan Website
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
