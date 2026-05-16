import type { Artifact, ArtifactType } from "./types";

export interface ClassifyInput {
  content: string;
  attachments?: Array<{
    type?: string;
    url?: string;
    name?: string;
    contentType?: string;
  }>;
  eventType?: string;
}

export type Routing = "inline" | "canvas";

export interface ClassifyResult {
  routing: Routing;
  reason: string;
  artifactHint?: ArtifactType;
}

const CHARS_THRESHOLD = 1200;
const CODE_BLOCK_LINE_THRESHOLD = 30;
const HEADING_THRESHOLD = 3;

const IMAGE_CT = /^image\//i;
const VIDEO_CT = /^video\//i;

function countMatches(s: string, re: RegExp): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

function longestFencedCodeBlockLineCount(s: string): number {
  const fenceRe = /```[^\n]*\n([\s\S]*?)```/g;
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(s)) !== null) {
    const lines = m[1].split("\n").length;
    if (lines > max) max = lines;
  }
  return max;
}

export function classifyMessage(input: ClassifyInput): ClassifyResult {
  const { content, attachments, eventType } = input;

  if (eventType === "artifact.created" || eventType === "artifact.updated") {
    return { routing: "canvas", reason: "artifact event" };
  }

  if (attachments && attachments.length > 0) {
    const first = attachments[0];
    const ct = first.contentType ?? "";
    if (IMAGE_CT.test(ct)) return { routing: "canvas", reason: "image attachment", artifactHint: "image" };
    if (VIDEO_CT.test(ct)) return { routing: "canvas", reason: "video attachment", artifactHint: "video" };
    return { routing: "canvas", reason: "attachment", artifactHint: "document" };
  }

  const safe = content ?? "";

  const hasImage = /!\[[^\]]*\]\([^)]+\)/.test(safe);
  const hasTable = /(^|\n)\s*\|.+\|.*\n\s*\|[\s\-:|]+\|/m.test(safe);
  const longCode = longestFencedCodeBlockLineCount(safe) >= CODE_BLOCK_LINE_THRESHOLD;
  if (hasImage) return { routing: "canvas", reason: "markdown image", artifactHint: "document" };
  if (hasTable) return { routing: "canvas", reason: "markdown table", artifactHint: "document" };
  if (longCode) return { routing: "canvas", reason: "long code block", artifactHint: "code" };

  const headingCount = countMatches(safe, /^#{1,6}\s+/gm);
  if (safe.length > CHARS_THRESHOLD || headingCount >= HEADING_THRESHOLD) {
    return { routing: "canvas", reason: "long document", artifactHint: "document" };
  }

  return { routing: "inline", reason: "short reply" };
}

export function syntheticArtifactFromMessage(
  messageId: string,
  input: ClassifyInput,
  result: ClassifyResult,
): Artifact | null {
  if (result.routing !== "canvas") return null;

  const baseName = deriveTitle(input.content) ?? "Reply";

  switch (result.artifactHint) {
    case "image": {
      const url = input.attachments?.[0]?.url;
      if (!url) return null;
      return { id: messageId, type: "image", name: baseName, url };
    }
    case "video": {
      const url = input.attachments?.[0]?.url;
      if (!url) return null;
      return { id: messageId, type: "video", name: baseName, url };
    }
    case "code":
      return { id: messageId, type: "code", name: baseName, content: input.content, language: detectLang(input.content) };
    case "document":
    default:
      return {
        id: messageId,
        type: "document",
        name: baseName,
        content: input.content,
        format: "markdown",
      };
  }
}

function deriveTitle(content: string): string | null {
  if (!content) return null;
  const firstHeading = content.match(/^#{1,6}\s+(.+)$/m);
  if (firstHeading) return firstHeading[1].trim().slice(0, 80);
  const firstLine = content.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) return null;
  return firstLine.replace(/[*_`#>]/g, "").trim().slice(0, 80);
}

function detectLang(content: string): string | undefined {
  const m = content.match(/^```([A-Za-z0-9_+-]+)/m);
  return m?.[1];
}
