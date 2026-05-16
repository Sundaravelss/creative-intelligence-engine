"use client";

// Phase 1 — "Assembling your agents".
// 5 stylized PNG avatars appear sequentially (200ms stagger). After the last
// one is visible we wait an additional ~500ms then call onAdvance() so the
// reveal feels finished before phase 2 takes over.

import { useEffect } from "react";
import { motion } from "framer-motion";

interface AgentsAssemblyProps {
  onAdvance: () => void;
}

const AGENTS: { src: string; label: string }[] = [
  { src: "/agents/assistant.png", label: "Strategist" },
  { src: "/agents/marketing.png", label: "Creative Director" },
  { src: "/agents/social-media.png", label: "Copywriter" },
  { src: "/agents/commercial.png", label: "Art Director" },
  { src: "/agents/customer-care.png", label: "Publisher" },
];

export function AgentsAssembly({ onAdvance }: AgentsAssemblyProps) {
  useEffect(() => {
    // 5 avatars × 200ms = 1000ms reveal + 500ms grace = 1500ms total
    const t = setTimeout(onAdvance, 1500);
    return () => clearTimeout(t);
  }, [onAdvance]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex flex-col items-center justify-center px-6"
    >
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="hc-serif-headline text-center text-5xl font-light text-foreground sm:text-6xl"
      >
        Assembling your agents
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="mt-5 max-w-xl text-center text-base text-muted-foreground"
      >
        Meet the team that&apos;ll work alongside you — they handle content,
        manage your assets, watch what sells, and learn from every campaign.
      </motion.p>

      <ul
        className="mt-12 flex items-center justify-center gap-5"
        aria-label="Agent roster"
      >
        {AGENTS.map((agent, i) => (
          <motion.li
            key={agent.label}
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: i * 0.2,
              duration: 0.5,
              ease: [0.32, 0.72, 0, 1],
            }}
            className="flex flex-col items-center gap-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={agent.src}
              alt={agent.label}
              className="size-24 rounded-full object-cover shadow-lg ring-2 ring-white/60"
            />
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
