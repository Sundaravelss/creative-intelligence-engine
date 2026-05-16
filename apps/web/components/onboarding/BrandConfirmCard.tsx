"use client";

// Phase 5 — Brand confirmation card.
// Shows the synthesized BrandProfile from Phase 3 as a Brand.md / Logos /
// Colours / Font tile row plus an optional reference-image gallery, with
// Retry / Proceed at the bottom. Proceed is wired by the parent.

import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { BrandProfileLite } from "./ScanProgress";

interface BrandConfirmCardProps {
  profile: BrandProfileLite;
  onRetry: () => void;
  onProceed: () => void;
  proceeding?: boolean;
}

const FALLBACK_VOICE =
  "We're proceeding with sensible defaults — you can refine your brand voice and palette later from Brand Memory.";

const FALLBACK_PALETTE = ["#1f2937", "#9ca3af", "#fef3c7", "#fed7aa"];

const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro", "Inter", system-ui, sans-serif';

function brandInitial(name: string | undefined): string {
  if (!name) return "B";
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "B";
}

export function BrandConfirmCard({
  profile,
  onRetry,
  onProceed,
  proceeding,
}: BrandConfirmCardProps) {
  const name = profile.name?.trim() || "Your brand";
  const voice = profile.voice?.trim() || FALLBACK_VOICE;
  const palette =
    profile.palette && profile.palette.length > 0
      ? profile.palette.slice(0, 4)
      : FALLBACK_PALETTE;
  const refImages = profile.referenceImages ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
      aria-label={`Brand confirmation for ${name}`}
      className="mx-auto w-full max-w-2xl rounded-3xl border border-white/50 bg-white/95 p-7 shadow-xl backdrop-blur-xl"
    >
      <header className="flex items-center gap-3">
        {profile.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.logoUrl}
            alt={`${name} logo`}
            className="size-10 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full text-base font-medium text-white"
            style={{ background: "var(--hc-accent-coral)" }}
          >
            {brandInitial(name)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            On
          </p>
          <h3 className="hc-serif-headline truncate text-2xl font-light">
            {name}
          </h3>
        </div>
      </header>

      <div className="mt-5 rounded-2xl bg-muted/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Brand.md
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">
          {voice}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {/* Logos */}
        <Tile label="Logos">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logoUrl}
              alt=""
              className="h-12 max-w-full object-contain"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full text-base font-medium text-white"
              style={{ background: "var(--hc-accent-coral)" }}
            >
              {brandInitial(name)}
            </div>
          )}
        </Tile>

        {/* Colours */}
        <Tile label="Colours">
          <div className="flex items-center gap-1.5">
            {palette.map((hex, i) => (
              <span
                key={`${hex}-${i}`}
                title={hex}
                className="size-6 rounded-full ring-1 ring-black/5"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </Tile>

        {/* Font */}
        <Tile label="Font">
          <span
            className="text-2xl font-medium leading-none"
            style={{ fontFamily: SYSTEM_FONT_STACK }}
          >
            Aa
          </span>
          <span className="mt-1 truncate text-[10px] text-muted-foreground">
            System
          </span>
        </Tile>
      </div>

      {refImages.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your Reference Images
          </p>
          <ul className="mt-2 grid grid-cols-4 gap-2">
            {refImages.slice(0, 8).map((src) => (
              <li
                key={src}
                className="aspect-square overflow-hidden rounded-lg ring-1 ring-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="mt-6 flex items-center justify-between gap-2">
        <a
          href="/brand?tab=wiki"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          View Brand.md →
        </a>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={proceeding}
            className="rounded-full px-4 text-muted-foreground hover:text-foreground"
          >
            Retry
          </Button>
          <Button
            size="sm"
            onClick={onProceed}
            disabled={proceeding}
            className={cn(
              "rounded-full bg-foreground px-5 text-background hover:bg-foreground/90",
            )}
          >
            {proceeding ? "Proceeding…" : "Proceed"}
          </Button>
        </div>
      </footer>
    </motion.section>
  );
}

interface TileProps {
  label: string;
  children: React.ReactNode;
}

function Tile({ label, children }: TileProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-white/80 p-4 text-center">
      <div className="flex h-14 items-center justify-center">{children}</div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
