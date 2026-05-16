"use client";

// Phase 2/3 chat surface — coral asterisk + bot bubble + waiting/scanning copy.
// During phase 2 we show "Hey! I'm CIE…"; during phase 3 we show the live
// "Got it — scanning {url}…" line. Layout is identical so the transition is
// just a copy swap.

import { Asterisk } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface BrandIntakeChatProps {
  variant: "intake" | "scanning";
  url?: string;
  children?: React.ReactNode;
}

export function BrandIntakeChat({
  variant,
  url,
  children,
}: BrandIntakeChatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="mx-auto w-full max-w-2xl px-6"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background:
              "color-mix(in oklch, var(--hc-accent-coral) 14%, transparent)",
            color: "var(--hc-accent-coral)",
          }}
          aria-hidden="true"
        >
          <Asterisk className="size-5" strokeWidth={2.4} />
        </div>

        <div className="flex-1 space-y-3">
          <div
            className={cn(
              "rounded-2xl border border-white/40 bg-white/85 px-5 py-4 text-base text-foreground shadow-sm backdrop-blur-md",
            )}
          >
            {variant === "intake" ? (
              <p>
                Hi, I&apos;m Sage. I&apos;ll be helping you set up your brand
                today — once we know your story, the rest of the team can pick
                things up from there. Mind sharing where you sell?
              </p>
            ) : (
              <p>
                Got it — scanning{" "}
                <span className="font-medium text-foreground">
                  {url ?? "your store"}
                </span>
                …
              </p>
            )}
          </div>

          {variant === "intake" ? (
            <p className="px-1 text-sm italic text-muted-foreground">
              <span className="font-semibold not-italic text-foreground/80">
                Waiting
              </span>{" "}
              for{" "}
              <span className="font-semibold not-italic text-foreground/80">
                your inputs
              </span>
              …
            </p>
          ) : null}

          {children}
        </div>
      </div>
    </motion.div>
  );
}
