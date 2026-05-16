"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, GenerationChipData, SuggestedFollowupItem } from "./types";
import { UserMessageBubble } from "./UserMessageBubble";
import { ReasoningBlock } from "./ReasoningBlock";
import { GenerationChip } from "./GenerationChip";
import { AssistantProse } from "./AssistantProse";
import { FeedbackRow } from "./FeedbackRow";
import { SuggestedFollowups } from "./SuggestedFollowups";
import { StartedPill } from "./StartedPill";
import { ThoughtPill } from "./ThoughtPill";
import { AgentStepBlock } from "./AgentStepBlock";
import { LiveStreamProse } from "./LiveStreamProse";
import { avatarFor, type AgentId } from "@/lib/agentAvatars";

interface ThreadMessageListProps {
  thread: ChatMessage[];
  onChipFocus?: (chip: GenerationChipData) => void;
  onFollowup?: (item: SuggestedFollowupItem) => void;
}

export function ThreadMessageList({
  thread,
  onChipFocus,
  onFollowup,
}: ThreadMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Programmatically scroll the inner container ONLY (not via
    // scrollIntoView, which can hijack the document scroll on WebKit when
    // the overflow chain isn't perfect).
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-scroll overscroll-contain px-4 py-6"
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="flex flex-col gap-5">
        {thread.map((msg) => {
          switch (msg.kind) {
            case "user":
              return (
                <UserMessageBubble
                  key={msg.id}
                  text={msg.text}
                  timestamp={msg.timestamp}
                  attachments={msg.attachments}
                />
              );
            case "started":
              return <StartedPill key={msg.id} ts={msg.ts} />;
            case "thought":
              return (
                <ThoughtPill
                  key={msg.id}
                  summary={msg.summary}
                  fullText={msg.fullText}
                  elapsedSec={msg.elapsedSec}
                  defaultExpanded={msg.collapsed === false}
                />
              );
            case "agent_step":
              return (
                <AgentStepBlock
                  key={msg.id}
                  agentId={msg.agentId}
                  label={msg.label}
                  completed={msg.completed}
                  total={msg.total}
                  substeps={msg.substeps}
                  defaultExpanded={msg.collapsed === false}
                />
              );
            case "reasoning":
              return (
                <ReasoningBlock
                  key={msg.id}
                  text={msg.text}
                  title={msg.title}
                />
              );
            case "generation":
              return (
                <div key={msg.id} className="flex flex-col gap-2">
                  {msg.chips.map((chip) => (
                    <GenerationChip
                      key={chip.id}
                      data={chip}
                      onFocus={onChipFocus}
                    />
                  ))}
                </div>
              );
            case "assistant":
              return (
                <div key={msg.id} className="flex flex-col gap-1">
                  <AssistantProse text={msg.text} />
                  <FeedbackRow />
                </div>
              );
            case "followups":
              return (
                <SuggestedFollowups
                  key={msg.id}
                  items={msg.items}
                  onSelect={(item) => onFollowup?.(item)}
                />
              );
            case "live_stream": {
              // Tail = last ~40 chars of the joined buffer; rendered with
              // shimmer when isStreaming. The `data-agent` attr lets
              // Playwright assert per-agent streaming.
              const finalized = msg.finalized;
              const TAIL_LEN = 40;
              const splitAt = Math.max(0, finalized.length - TAIL_LEN);
              const head = finalized.slice(0, splitAt);
              const tail = finalized.slice(splitAt);
              const avatar = avatarFor(msg.agentId as AgentId);
              return (
                <div
                  key={msg.id}
                  data-testid="cie-chat-live-stream-row"
                  data-agent={msg.agentId}
                  className="flex gap-3"
                >
                  {avatar ? (
                    <img
                      src={avatar.src}
                      alt={msg.label}
                      className="mt-0.5 h-6 w-6 shrink-0 rounded-full"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {msg.label}
                    </span>
                    <LiveStreamProse
                      finalizedText={head}
                      streamingTail={tail}
                      isStreaming={msg.isStreaming}
                    />
                  </div>
                </div>
              );
            }
          }
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
