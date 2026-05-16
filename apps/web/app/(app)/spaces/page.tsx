import { SpaceGrid } from "@/components/spaces/SpaceGrid";

export const metadata = {
  title: "Spaces — Creative Intelligence Engine",
};

export default function SpacesPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--hc-accent-coral)]">
          Templates
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Spaces</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Pick a Space to start. Each opens a 2-step flow — upload your inputs,
          configure the brief, then launch a live run on Studio.
        </p>
      </header>

      <SpaceGrid />
    </div>
  );
}
