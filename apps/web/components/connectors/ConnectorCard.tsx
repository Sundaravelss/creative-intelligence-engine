"use client";

import { useState } from "react";
import {
  Search,
  Brain,
  Image as ImageIcon,
  Terminal,
  Facebook,
  Music2,
  Linkedin,
  Instagram,
  Twitter,
  Youtube,
  BarChart3,
  TrendingUp,
  ShoppingBag,
  ShoppingCart,
  Bug,
  Mail,
  Users,
  GitBranch,
  Plug,
  type LucideIcon,
} from "lucide-react";

import type { Connector } from "./types";

interface ConnectorCardProps {
  connector: Connector;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  brain: Brain,
  image: ImageIcon,
  terminal: Terminal,
  facebook: Facebook,
  music: Music2,
  linkedin: Linkedin,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  "bar-chart": BarChart3,
  "trending-up": TrendingUp,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  spider: Bug,
  mail: Mail,
  users: Users,
  "git-branch": GitBranch,
};

function StatusBadge({ status }: { status: Connector["status"] }) {
  const styles: Record<Connector["status"], string> = {
    connected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "not-connected": "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
    "coming-soon": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  };
  const label: Record<Connector["status"], string> = {
    connected: "Connected",
    "not-connected": "Not connected",
    "coming-soon": "Coming soon",
  };
  return (
    <span
      className={`hc-pill inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {label[status]}
    </span>
  );
}

function formatLastSync(iso?: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `Synced ${date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "";
  }
}

export function ConnectorCard({ connector, onConnect, onDisconnect }: ConnectorCardProps) {
  const [busy, setBusy] = useState(false);
  const Icon = ICONS[connector.icon] ?? Plug;
  const isConnected = connector.status === "connected";
  const isComingSoon = connector.status === "coming-soon";

  const handleClick = async () => {
    if (isComingSoon) return;
    setBusy(true);
    try {
      if (isConnected) {
        await onDisconnect(connector.id);
      } else {
        onConnect(connector.id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hc-card hc-fade-in flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
            <Icon className="h-5 w-5 text-foreground/70" aria-hidden />
          </div>
          <div>
            <div className="font-medium text-foreground">{connector.name}</div>
            {connector.description ? (
              <div className="text-xs text-muted-foreground line-clamp-1">
                {connector.description}
              </div>
            ) : null}
          </div>
        </div>
        <StatusBadge status={connector.status} />
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-xs text-muted-foreground">
          {isConnected ? formatLastSync(connector.lastSync) : ""}
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || isComingSoon}
          className={`hc-pill px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isConnected
              ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
              : "bg-foreground text-background hover:opacity-90"
          }`}
        >
          {isComingSoon ? "Coming soon" : isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>
    </div>
  );
}
