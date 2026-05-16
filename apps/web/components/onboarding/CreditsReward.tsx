"use client";

// Phase 4 — "You've got 250 credits on us!" headline card.
// Auto-advances after ~1.8s via parent timer (this component just renders).

import { motion } from "framer-motion";

export function CreditsReward() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
      className="relative mx-auto w-full max-w-2xl rounded-3xl border border-white/50 bg-white/90 p-8 shadow-xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-6">
        <h2 className="hc-serif-headline flex-1 text-4xl font-light leading-tight sm:text-[44px]">
          You&apos;ve got{" "}
          <span className="text-purple-500">250</span>{" "}
          <span className="text-orange-300">credits</span>{" "}
          <span className="text-muted-foreground">on us!</span>
        </h2>

        {/* Decorative pastel-circle cluster — pure SVG */}
        <svg
          viewBox="0 0 120 100"
          aria-hidden="true"
          className="size-28 shrink-0"
        >
          <circle cx="42" cy="46" r="28" fill="oklch(0.85 0.13 65 / 0.7)" />
          <circle cx="74" cy="36" r="22" fill="oklch(0.78 0.12 95 / 0.7)" />
          <circle cx="86" cy="66" r="20" fill="oklch(0.78 0.10 235 / 0.6)" />
          <circle cx="58" cy="72" r="18" fill="oklch(0.80 0.12 305 / 0.7)" />
        </svg>
      </div>
    </motion.div>
  );
}
