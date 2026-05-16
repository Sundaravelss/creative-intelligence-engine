"use client";

interface UserMessageBubbleProps {
  text: string;
  timestamp: string;
}

export function UserMessageBubble({ text, timestamp }: UserMessageBubbleProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[80%] rounded-2xl bg-[oklch(0.94_0.04_240)] px-4 py-2.5 text-[13.5px] leading-relaxed text-[oklch(0.3_0.12_240)] shadow-sm">
        {text}
      </div>
      <span className="pr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {timestamp}
      </span>
    </div>
  );
}
