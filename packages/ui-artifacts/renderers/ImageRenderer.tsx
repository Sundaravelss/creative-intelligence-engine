"use client";

import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { cn } from "../shared/cn";
import type { ImageArtifact } from "../types";

interface ImageRendererProps {
  artifact: ImageArtifact;
  className?: string;
}

export function ImageRenderer({ artifact, className }: ImageRendererProps) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className={cn("relative flex items-center justify-center w-full h-full", className)}>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="group relative max-w-full max-h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hc-accent-coral)] rounded-lg"
        aria-label={`Open ${artifact.alt ?? artifact.name} full screen`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artifact.url}
          alt={artifact.alt ?? artifact.name}
          width={artifact.width}
          height={artifact.height}
          className="max-w-full max-h-[70vh] rounded-lg object-contain"
          loading="lazy"
        />
        <span className="absolute top-3 right-3 hc-glass hc-pill px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Maximize2 className="h-3 w-3" /> Expand
        </span>
      </button>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 hc-fade-in"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artifact.url}
            alt={artifact.alt ?? artifact.name}
            className="max-w-[95vw] max-h-[95vh] object-contain"
          />
          <button
            type="button"
            className="absolute top-4 right-4 hc-glass hc-pill p-2"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(false);
            }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
