"use client";

import type { UserAttachment } from "./types";

interface UserMessageBubbleProps {
  text: string;
  timestamp: string;
  attachments?: UserAttachment[];
}

export function UserMessageBubble({
  text,
  timestamp,
  attachments,
}: UserMessageBubbleProps) {
  // Strip any sentinel-style tags from the prose for display — they're
  // routing metadata, not user-visible content.
  const visibleText = text
    .replace(/<attached_image\s+[^>]*\/>/gi, "")
    .trim();

  return (
    <div className="flex flex-col items-end gap-1">
      {attachments && attachments.length > 0 ? (
        <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
          {attachments.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.url}
              src={a.preview ?? a.url}
              alt={a.filename}
              className="h-28 w-28 rounded-xl object-cover shadow-sm ring-1 ring-black/10"
              title={a.filename}
            />
          ))}
        </div>
      ) : null}
      {visibleText ? (
        <div className="max-w-[80%] rounded-2xl bg-[oklch(0.94_0.04_240)] px-4 py-2.5 text-[13.5px] leading-relaxed text-[oklch(0.3_0.12_240)] shadow-sm">
          {visibleText}
        </div>
      ) : null}
      <span className="pr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {timestamp}
      </span>
    </div>
  );
}
