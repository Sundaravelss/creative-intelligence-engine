"use client";

import { useRouter } from "next/navigation";
import { type LucideIcon } from "lucide-react";

interface SpaceCardProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind gradient classes for the card thumbnail. */
  gradient: string;
}

/**
 * Single Space tile. 240×280-ish aspect ratio, gradient thumbnail with
 * subtle film-grain/icon overlay, title + 1-line description below.
 *
 * Click navigates to /spaces/[id] which kicks off the 2-step flow.
 */
export function SpaceCard({
  id,
  name,
  description,
  icon: Icon,
  gradient,
}: SpaceCardProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/spaces/${id}`)}
      data-testid="cie-space-card"
      className={[
        "group relative flex h-[280px] w-full flex-col overflow-hidden rounded-xl border",
        "border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)]",
        "text-left transition-all duration-200 hover:-translate-y-1",
        "hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hc-accent-coral)]",
      ].join(" ")}
    >
      {/* Gradient thumbnail (top ~60%) */}
      <div
        className={[
          "relative h-[170px] w-full overflow-hidden",
          gradient,
        ].join(" ")}
      >
        {/* Faint noise / grain — pure CSS */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' /></svg>\")",
          }}
        />
        {/* Floating icon medallion */}
        <div
          aria-hidden
          className={[
            "absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center",
            "rounded-full border border-white/40 bg-white/30 backdrop-blur-md",
            "text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
            "transition-transform group-hover:scale-110",
          ].join(" ")}
        >
          <Icon size={18} strokeWidth={2} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold leading-tight tracking-tight">
            {name}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--hc-accent-coral)] opacity-0 transition-opacity group-hover:opacity-100">
          Open space →
        </span>
      </div>
    </button>
  );
}
