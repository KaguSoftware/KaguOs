"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Loader2, Upload } from "lucide-react";
import { importDebugTasks, type ImportTaskRow } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/typed-inputs";
import { cn } from "@/lib/utils";

function pick(row: Record<string, string>, ...keys: string[]): string {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) lower[k.trim().toLowerCase()] = v ?? "";
  for (const key of keys) if (lower[key]) return lower[key];
  return "";
}

export function ImportDebug() {
  const [rows, setRows] = useState<ImportTaskRow[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleParse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage({ ok: false, text: "Choose the CSV export of your sheet first." });
      return;
    }
    setMessage(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = result.data
          .map((row) => ({
            title: pick(row, "title", "task", "name"),
            description: pick(row, "description", "details", "notes"),
            state: pick(row, "state", "status"),
            assignee: pick(row, "assignee", "assigned", "who"),
            priority: pick(row, "priority"),
          }))
          .filter((row) => row.title || row.description);
        setRows(parsed);
        if (parsed.length === 0) {
          setMessage({
            ok: false,
            text: "No rows found — the CSV needs a header row (title/task, state, assignee…).",
          });
        }
      },
      error: (err) => setMessage({ ok: false, text: `Parse failed: ${err.message}` }),
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleParse} className="flex flex-wrap items-center gap-2">
        <FileInput name="file" accept=".csv" />
        <Button type="submit" variant="outline" size="sm">
          <Upload className="size-3.5" aria-hidden />
          Preview
        </Button>
      </form>

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Title", "State", "Assignee", "Priority"].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-medium text-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    <td className="max-w-64 truncate px-3 py-2 text-ink">{row.title}</td>
                    <td className="px-3 py-2 text-muted">{row.state || "open"}</td>
                    <td className="px-3 py-2 text-muted">{row.assignee || "—"}</td>
                    <td className="px-3 py-2 text-muted">{row.priority || "medium"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="px-3 py-2 text-xs text-faint">
                …and {rows.length - 10} more rows.
              </p>
            )}
          </div>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await importDebugTasks(rows);
                if (result) {
                  setMessage({ ok: result.ok, text: result.message });
                  if (result.ok) setRows([]);
                }
              });
            }}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            Import {rows.length} tasks
          </Button>
        </>
      )}

      {message && (
        <p
          role="status"
          className={cn("text-[13px]", message.ok ? "text-primary-dim" : "text-danger")}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
