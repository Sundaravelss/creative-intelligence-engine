"use client";

interface LiveStreamProseProps {
  finalizedText: string;
  streamingTail?: string;
  isStreaming: boolean;
}

// Shimmer keyframes injected inline once. Scoped class name avoids collisions.
const SHIMMER_CSS = `
@keyframes cie-stream-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.cie-stream-shimmer-tail {
  background-image: linear-gradient(
    90deg,
    var(--color-foreground),
    var(--color-muted-foreground),
    var(--color-foreground)
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: cie-stream-shimmer 1.5s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cie-stream-shimmer-tail { animation: none; }
}
`;

export function LiveStreamProse({
  finalizedText,
  streamingTail,
  isStreaming,
}: LiveStreamProseProps) {
  const tail = (streamingTail ?? "").trim();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />
      <p
        data-testid="cie-chat-live-stream"
        className="text-[13.5px] leading-relaxed text-foreground"
      >
        {finalizedText}
        {isStreaming && tail.length > 0 ? (
          <>
            {finalizedText.length > 0 ? " " : ""}
            <span className="cie-stream-shimmer-tail inline-block">{tail}</span>
          </>
        ) : null}
      </p>
    </>
  );
}
