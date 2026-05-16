import { AgentRoster } from "../../../components/agents/AgentRoster";

export default function AgentsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 50% 35% at 50% 0%, var(--hc-accent-coral-soft) 0%, transparent 60%)",
        }}
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6 sm:p-10">
        <header>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            The roster
          </p>
          <h1 className="hc-serif-headline mt-1 text-4xl font-semibold tracking-tight">
            Six specialists. One canvas.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Every agent has a name, a remit and a backend. Swap adapters per
            agent or globally — the contract is the same.
          </p>
        </header>
        <AgentRoster />
      </div>
    </main>
  );
}
