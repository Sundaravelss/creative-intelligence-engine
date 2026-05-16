"use client";

import type { ChatMessage, GenerationChipData, SuggestedFollowupItem } from "./types";
import { ChatHeader } from "./ChatHeader";
import { ThreadMessageList } from "./ThreadMessageList";
import { ComposerFooter } from "./ComposerFooter";

interface ChatRailProps {
  thread: ChatMessage[];
  projectName: string;
  live: boolean;
  modelLabel: string;
  adapter: string;
  setAdapter: (id: string) => void;
  onSubmit: (text: string) => void;
  onChipFocus?: (chip: GenerationChipData) => void;
  onFollowup?: (item: SuggestedFollowupItem) => void;
  disabled?: boolean;
}

export function ChatRail({
  thread,
  projectName,
  live,
  modelLabel,
  adapter,
  setAdapter,
  onSubmit,
  onChipFocus,
  onFollowup,
  disabled,
}: ChatRailProps) {
  return (
    <aside className="flex h-full flex-col border-r border-black/5 bg-background/60 backdrop-blur-md">
      <ChatHeader
        projectName={projectName}
        live={live}
        modelLabel={modelLabel}
      />
      <ThreadMessageList
        thread={thread}
        onChipFocus={onChipFocus}
        onFollowup={onFollowup}
      />
      <ComposerFooter
        adapter={adapter}
        setAdapter={setAdapter}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    </aside>
  );
}
