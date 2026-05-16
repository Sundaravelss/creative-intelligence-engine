"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, GenerationChipData, SuggestedFollowupItem } from "./types";
import { UserMessageBubble } from "./UserMessageBubble";
import { ReasoningBlock } from "./ReasoningBlock";
import { GenerationChip } from "./GenerationChip";
import { AssistantProse } from "./AssistantProse";
import { FeedbackRow } from "./FeedbackRow";
import { SuggestedFollowups } from "./SuggestedFollowups";

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="flex flex-col gap-5">
        {thread.map((msg) => {
          switch (msg.kind) {
            case "user":
              return (
                <UserMessageBubble
                  key={msg.id}
                  text={msg.text}
                  timestamp={msg.timestamp}
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
          }
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
