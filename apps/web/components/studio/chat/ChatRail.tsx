"use client";

import type { ChatMessage, GenerationChipData, SuggestedFollowupItem } from "./types";
import { ChatHeader } from "./ChatHeader";
import { ThreadMessageList } from "./ThreadMessageList";
import { ComposerFooter } from "./ComposerFooter";

interface ChatRailProps {
  thread: ChatMessage[];
  projectName: string;
  live: boolean;
  modelLabel?: string;
  adapter: string;
  setAdapter: (id: string) => void;
  onSubmit: (text: string) => void;
  onSchedule?: (currentText: string) => void;
  onChipFocus?: (chip: GenerationChipData) => void;
  onFollowup?: (item: SuggestedFollowupItem) => void;
  disabled?: boolean;
  isRunning?: boolean;
  onStop?: () => void;
}

export function ChatRail({
  thread,
  projectName,
  live,
  modelLabel,
  adapter,
  setAdapter,
  onSubmit,
  onSchedule,
  onChipFocus,
  onFollowup,
  disabled,
  isRunning,
  onStop,
}: ChatRailProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-black/5 bg-background/60 backdrop-blur-md">
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
        onSchedule={onSchedule}
        disabled={disabled}
        isRunning={isRunning}
        onStop={onStop}
      />
    </aside>
  );
}
