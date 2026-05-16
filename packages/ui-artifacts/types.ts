export type ArtifactType =
  | "document"
  | "image"
  | "video"
  | "slides"
  | "table"
  | "code"
  | "webpage";

export interface ArtifactBase {
  id: string;
  name: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentArtifact extends ArtifactBase {
  type: "document";
  content: string;
  format?: "markdown" | "html" | "text";
}

export interface ImageArtifact extends ArtifactBase {
  type: "image";
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface VideoArtifact extends ArtifactBase {
  type: "video";
  url: string;
  poster?: string;
  durationSec?: number;
}

export interface Slide {
  id: string;
  title?: string;
  content: string;
  thumbnailUrl?: string;
}

export interface SlidesArtifact extends ArtifactBase {
  type: "slides";
  slides: Slide[];
}

export type TableCell = string | number | boolean | null;

export interface TableArtifact extends ArtifactBase {
  type: "table";
  columns: string[];
  rows: TableCell[][];
}

export interface CodeArtifact extends ArtifactBase {
  type: "code";
  content: string;
  language?: string;
}

export interface WebpageArtifact extends ArtifactBase {
  type: "webpage";
  url: string;
  title?: string;
  snippet?: string;
}

export type Artifact =
  | DocumentArtifact
  | ImageArtifact
  | VideoArtifact
  | SlidesArtifact
  | TableArtifact
  | CodeArtifact
  | WebpageArtifact;

export type ViewMode = "focus" | "grid" | "stack";
