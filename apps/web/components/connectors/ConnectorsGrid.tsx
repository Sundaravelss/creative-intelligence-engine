"use client";

import { useMemo } from "react";

import { ConnectorCard } from "./ConnectorCard";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Connector, type ConnectorCategory } from "./types";

interface ConnectorsGridProps {
  connectors: Connector[];
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export function ConnectorsGrid({ connectors, onConnect, onDisconnect }: ConnectorsGridProps) {
  const grouped = useMemo(() => {
    const buckets = new Map<ConnectorCategory, Connector[]>();
    for (const cat of CATEGORY_ORDER) buckets.set(cat, []);
    for (const c of connectors) {
      const bucket = buckets.get(c.category);
      if (bucket) bucket.push(c);
    }
    return buckets;
  }, [connectors]);

  return (
    <div className="flex flex-col gap-10">
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat}>
            <header className="mb-4 flex items-baseline justify-between">
              <h2 className="hc-display text-lg font-semibold text-foreground">
                {CATEGORY_LABELS[cat]}
              </h2>
              <span className="text-xs text-muted-foreground">
                {items.filter((i) => i.status === "connected").length} of {items.length} connected
              </span>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((c) => (
                <ConnectorCard
                  key={c.id}
                  connector={c}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
