"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy } from "lucide-react";
import { cn } from "../shared/cn";
import type { TableArtifact, TableCell } from "../types";

interface TableRendererProps {
  artifact: TableArtifact;
  className?: string;
}

type SortDir = "asc" | "desc" | null;

function compare(a: TableCell, b: TableCell): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function toCsv(columns: string[], rows: TableCell[][]): string {
  const escape = (v: TableCell) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columns.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
}

export function TableRenderer({ artifact, className }: TableRendererProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const sortedRows = useMemo(() => {
    if (sortCol == null || sortDir == null) return artifact.rows;
    const copy = [...artifact.rows];
    copy.sort((a, b) => {
      const r = compare(a[sortCol], b[sortCol]);
      return sortDir === "asc" ? r : -r;
    });
    return copy;
  }, [artifact.rows, sortCol, sortDir]);

  const onHeaderClick = (idx: number) => {
    if (sortCol !== idx) {
      setSortCol(idx);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(toCsv(artifact.columns, sortedRows));
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <div className="flex items-center justify-end px-2 pb-2">
        <button
          type="button"
          onClick={onCopy}
          className="hc-pill px-3 py-1 text-xs hc-glass flex items-center gap-1"
          aria-label="Copy as CSV"
        >
          <Copy className="h-3 w-3" /> Copy CSV
        </button>
      </div>
      <div className="flex-1 overflow-auto rounded-lg border border-[color:var(--color-border,oklch(0.92_0_0))]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[color:var(--hc-surface-glass-strong)] backdrop-blur">
            <tr>
              {artifact.columns.map((col, idx) => (
                <th
                  key={`${col}-${idx}`}
                  className="text-left font-semibold px-3 py-2 border-b cursor-pointer select-none"
                  onClick={() => onHeaderClick(idx)}
                  aria-sort={
                    sortCol === idx
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col}
                    {sortCol === idx && sortDir === "asc" && <ArrowUp className="h-3 w-3" />}
                    {sortCol === idx && sortDir === "desc" && <ArrowDown className="h-3 w-3" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row: unknown[], ri: number) => (
              <tr key={ri} className="even:bg-[oklch(0.985_0_0)]">
                {row.map((cell: unknown, ci: number) => (
                  <td key={ci} className="px-3 py-2 border-b align-top">
                    {cell == null ? "" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
