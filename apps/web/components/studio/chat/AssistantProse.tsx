"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantProseProps {
  text: string;
}

export function AssistantProse({ text }: AssistantProseProps) {
  return (
    <div className="prose prose-sm max-w-none text-[13.5px] leading-relaxed text-foreground prose-p:my-2 prose-p:text-foreground prose-strong:text-foreground prose-a:text-[oklch(0.66_0.18_25)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
