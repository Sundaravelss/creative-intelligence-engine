"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import {
  briefNodeSchema,
  nodeKindByName,
  type BriefNodeData,
} from "@cie/canvas-nodes";
import { NodeShell, NodeField } from "./NodeShell";

function BriefNodeInner({ data, selected }: NodeProps<BriefNodeData>) {
  // Tolerant parse — partial data during drag-drop creation is OK.
  const safe = briefNodeSchema.partial().safeParse(data);
  const d = safe.success ? safe.data : { hooks: [] as string[] };

  return (
    <NodeShell
      meta={nodeKindByName.brief}
      selected={selected}
      showTarget={false}
    >
      <NodeField label="URL" value={d.url} />
      <NodeField label="Keyword" value={d.keyword} />
      <NodeField label="Audience" value={d.audience} />
      <NodeField
        label="Hooks"
        value={d.hooks && d.hooks.length > 0 ? `${d.hooks.length} drafted` : undefined}
      />
    </NodeShell>
  );
}

export const BriefNode = memo(BriefNodeInner);
