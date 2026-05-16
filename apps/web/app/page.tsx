import Link from "next/link";
import {
  Boxes,
  CalendarClock,
  Network,
  Palette,
  Plug,
  Users,
  type LucideIcon,
} from "lucide-react";

interface NavTile {
  href: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
}

const TILES: NavTile[] = [
  {
    href: "/canvas",
    label: "Canvas",
    blurb: "Node-based moodboard. Drag, connect, generate.",
    icon: Network,
  },
  {
    href: "/studio",
    label: "Studio",
    blurb: "Prompt → asset bundle in five formats.",
    icon: Boxes,
  },
  {
    href: "/loops",
    label: "Loops",
    blurb: "Recurring drops. APScheduler + Run now.",
    icon: CalendarClock,
  },
  {
    href: "/connectors",
    label: "Connectors",
    blurb: "Ad platforms, social, analytics, AI backends.",
    icon: Plug,
  },
  {
    href: "/brand",
    label: "Brand",
    blurb: "Logo, palette, voice — injected everywhere.",
    icon: Palette,
  },
  {
    href: "/agents",
    label: "Agents",
    blurb: "Six specialists. Swap adapters at will.",
    icon: Users,
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 10%, var(--hc-accent-coral-soft) 0%, transparent 60%), radial-gradient(ellipse 55% 40% at 90% 90%, oklch(0.78 0.14 240 / 0.18) 0%, transparent 60%)",
        }}
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-12 p-6 sm:p-10">
        <header className="flex flex-col gap-4 pt-6 sm:pt-12">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Creative Intelligence Engine
          </p>
          <h1 className="hc-serif-headline text-5xl font-semibold tracking-tight sm:text-6xl">
            Agentic Marketing OS.
            <br />
            <span className="hc-accent-coral">Brief in, campaign out.</span>
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Canvas, agents, loops, and connectors in one liquid-glass surface.
            Plug a brand, write a brief, watch six specialists ship.
          </p>
        </header>

        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Primary navigation"
        >
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="hc-glass hc-card group relative flex flex-col gap-3 overflow-hidden border border-[color:var(--color-border)] p-6"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, var(--hc-accent-coral) 50%, transparent 100%)",
                    opacity: 0.5,
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="hc-pill inline-flex h-10 w-10 items-center justify-center border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] text-[color:var(--hc-accent-coral)] transition-transform group-hover:scale-105">
                    <Icon size={16} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {tile.href}
                  </span>
                </div>
                <h2 className="hc-serif-headline text-2xl font-semibold tracking-tight">
                  {tile.label}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {tile.blurb}
                </p>
              </Link>
            );
          })}
        </section>

        <footer className="mt-auto pt-8 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          built at TechEurope · Paris
        </footer>
      </div>
    </main>
  );
}
