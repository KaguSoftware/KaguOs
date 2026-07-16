"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Quote a CSV cell if it contains a comma, quote, or newline. */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns: string[], rows: (string | number | null)[][]): string {
  const head = columns.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return `${head}\n${body}`;
}

/**
 * Downloads the given rows as a CSV file, built entirely client-side from data
 * already on the page — no server round-trip. `filenameBase` gets a stamped
 * date appended by the caller (renders can't call Date.now()).
 */
export function ExportButton({
  filename,
  columns,
  rows,
  label = "Export",
}: {
  filename: string;
  columns: string[];
  rows: (string | number | null)[][];
  label?: string;
}) {
  const toast = useToast();

  function download() {
    if (rows.length === 0) {
      toast.error("Nothing to export yet.");
      return;
    }
    const csv = toCsv(columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}.`);
  }

  return (
    <Button variant="ghost" size="sm" onClick={download}>
      <Download className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}
