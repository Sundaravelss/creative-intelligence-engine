"use client";

// SplashScreen — boot wordmark for /splash.
//
// W0 didn't ship a splash MP4 (per plan R1 fallback path) so this is a
// CSS-only fade-in: a centered serif "CIE" wordmark over the blurred Tavily
// landscape backdrop, with a soft radial halo behind the letters.

import { motion } from "framer-motion";

export function SplashScreen() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <img
          src="/splash/landscape-bg.webp"
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-110 object-cover opacity-60 blur-3xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/70 to-white/90" />
      </div>

      <div className="relative flex flex-col items-center">
        {/* Soft radial halo behind the wordmark */}
        <div
          aria-hidden="true"
          className="absolute -inset-32 rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.62 0.21 27 / 0.18), transparent 70%)",
          }}
        />
        <motion.h1
          initial={{ opacity: 0, y: 12, letterSpacing: "0.06em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "-0.02em" }}
          transition={{ duration: 1.6, ease: [0.32, 0.72, 0, 1] }}
          className="hc-serif-headline relative text-[120px] font-light leading-none text-foreground"
        >
          Sage
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.8, duration: 1.0 }}
          className="relative mt-4 text-sm uppercase tracking-[0.32em] text-muted-foreground"
        >
          Creative Intelligence Engine
        </motion.p>
      </div>
    </div>
  );
}
