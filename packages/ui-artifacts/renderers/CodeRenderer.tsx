"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../shared/cn";
import type { CodeArtifact } from "../types";

interface CodeRendererProps {
  artifact: CodeArtifact;
  className?: string;
}

export function CodeRenderer({ artifact, className }: CodeRendererProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("relative h-full overflow-hidden rounded-lg", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--color-border,oklch(0.92_0_0))]">
        <span className="text-xs font-mono text-muted-foreground">
          {artifact.language ?? "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="hc-pill px-2 py-1 text-xs hc-glass flex items-center gap-1"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="h-full overflow-auto p-4 text-xs leading-relaxed font-mono bg-[oklch(0.97_0_0)]">
        <code>{artifact.content}</code>
      </pre>
    </div>
  );
}
