"use client";

import {
  Copy,
  Globe,
  Monitor,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react";

const ICON_BUTTON =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground";

export function FeedbackRow() {
  return (
    <div className="flex items-center gap-1 pt-1">
      <button type="button" aria-label="Helpful" className={ICON_BUTTON}>
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Not helpful" className={ICON_BUTTON}>
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Copy" className={ICON_BUTTON}>
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Share" className={ICON_BUTTON}>
        <Share2 className="h-3.5 w-3.5" />
      </button>
      <span className="flex-1" />
      <button type="button" aria-label="Open globe" className={ICON_BUTTON}>
        <Globe className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Open in new window" className={ICON_BUTTON}>
        <Monitor className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Sound" className={ICON_BUTTON}>
        <Volume2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
