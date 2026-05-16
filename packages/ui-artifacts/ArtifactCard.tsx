import type { ReactNode } from "react";
import {
  ChevronDown,
  Code,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Table,
  Video,
} from "lucide-react";
import { cn } from "./shared/cn";
import type { Artifact, ArtifactType } from "./types";

interface ArtifactCardProps {
  artifact: Artifact;
  children: ReactNode;
  onExpand?: () => void;
  className?: string;
  isActive?: boolean;
}

const TYPE_LABEL: Record<ArtifactType, string> = {
  document: "Document",
  image: "Image",
  video: "Video",
  slides: "Slides",
  table: "Table",
  code: "Code",
  webpage: "Webpage",
};

function TypeIcon({ type, className }: { type: ArtifactType; className?: string }) {
  switch (type) {
    case "document":
      return <FileText className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <Video className={className} />;
    case "slides":
      return <Layers className={className} />;
    case "table":
      return <Table className={className} />;
    case "code":
      return <Code className={className} />;
    case "webpage":
      return <Globe className={className} />;
  }
}

/**
 * Frosted artifact card — restyled for the hyperagent liquid-canvas look.
 * The "label pill" floats ABOVE the card (top-left, translate-y -50%) and
 * the chrome is hover-only on the top-right. Logic and props are unchanged
 * from v1 — this is class-only.
 */
export function ArtifactCard({
  artifact,
  children,
  onExpand,
  className,
  isActive,
}: ArtifactCardProps) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-visible rounded-2xl",
        "border border-white/30 bg-white/60 shadow-2xl backdrop-blur-sm",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.35)]",
        isActive
          ? "ring-2 ring-[oklch(0.66_0.18_25)] ring-offset-2 ring-offset-transparent"
          : "",
        className,
      )}
      aria-current={isActive}
    >
      {/* floating label pill, above the card border */}
      <span className="absolute -top-3 left-3 z-20 inline-flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
        <TypeIcon type={artifact.type} className="h-3 w-3" />
        <span className="truncate">
          <span className="opacity-70">{TYPE_LABEL[artifact.type]}</span>
          <span className="mx-1.5 opacity-40">·</span>
          {artifact.name}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
      </span>

      {/* hover-only top-right action overlay */}
      {onExpand ? (
        <div className="absolute right-2 top-2 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
            aria-label="Expand artifact"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl">
        {children}
      </div>
    </article>
  );
}
