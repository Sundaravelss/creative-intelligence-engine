"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptInput } from "./PromptInput";
import { FormatPicker, type StudioFormat } from "./FormatPicker";
import { BrandPill } from "./BrandPill";
import { UgcPresetsModal } from "./UgcPresetsModal";
import { AvatarPresetsModal } from "./AvatarPresetsModal";

interface EmptyStateHeroProps {
  brandName: string;
  format: StudioFormat;
  setFormat: (f: StudioFormat) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;

export function EmptyStateHero({
  brandName,
  format,
  setFormat,
  onSubmit,
  disabled,
}: EmptyStateHeroProps) {
  const [draft, setDraft] = useState("Generate the marketing images for bags");

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onSubmit(text);
  }

  return (
    <section className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, #dcd2e6 0%, #e8dde0 50%, #e7d6c5 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{ backgroundImage: `url("${NOISE_SVG}")` }}
      />
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Studio
          </p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-foreground sm:text-5xl">
            Describe your ad script…
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Brief in. Variants out. Pick a winner.
          </p>
        </div>
        <PromptInput
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          disabled={disabled}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FormatPicker value={format} onChange={setFormat} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BrandPill brandName={brandName} />
            <UgcPresetsModal />
            <AvatarPresetsModal />
            <Button
              type="button"
              onClick={submit}
              disabled={disabled || !draft.trim()}
              className="h-9 rounded-full bg-foreground px-4 text-[13px] font-medium text-background hover:bg-foreground/90"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Launch
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
