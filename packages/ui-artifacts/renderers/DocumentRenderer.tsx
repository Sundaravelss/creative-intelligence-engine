import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../shared/cn";
import type { DocumentArtifact } from "../types";

interface DocumentRendererProps {
  artifact: DocumentArtifact;
  className?: string;
}

const PROSE = [
  "max-w-none",
  "leading-relaxed",
  "[&_h1]:hc-serif-headline [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h1]:mt-2 [&_h1]:mb-6",
  "[&_h2]:hc-serif-headline [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h2]:mt-8 [&_h2]:mb-3",
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2",
  "[&_p]:my-3",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3",
  "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3",
  "[&_li]:my-1",
  "[&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[color:var(--hc-accent-coral)] [&_blockquote]:my-4",
  "[&_code]:rounded [&_code]:bg-[oklch(0.96_0_0)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_code]:font-mono",
  "[&_pre]:rounded-lg [&_pre]:bg-[oklch(0.97_0_0)] [&_pre]:p-4 [&_pre]:my-4 [&_pre]:overflow-x-auto",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:w-full [&_table]:my-4 [&_table]:border-collapse",
  "[&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:py-2 [&_th]:px-3",
  "[&_td]:border-b [&_td]:py-2 [&_td]:px-3",
  "[&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full",
  "[&_hr]:my-6 [&_hr]:border-t",
].join(" ");

export function DocumentRenderer({ artifact, className }: DocumentRendererProps) {
  return (
    <article className={cn("hc-display", PROSE, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
    </article>
  );
}
