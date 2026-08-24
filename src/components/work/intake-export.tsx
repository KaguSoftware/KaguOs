"use client";

import { useMemo } from "react";
import { Braces, Download, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  answersCsv,
  buildBundle,
  exportFilename,
  exportTables,
  tableCsv,
} from "@/lib/intake-export";
import type { IntakePack } from "@/lib/data/intake";
import { todayLocal } from "@/lib/utils";

/**
 * The pack, on its way out.
 *
 * Everything the client typed has to end up in the database of the thing being
 * built for them, and until this panel existed the only route was reading the
 * review page and retyping a hundred and forty recipe lines. That is not a
 * tedious job, it is a job with a defect rate.
 *
 * ── Why one file per table rather than a single spreadsheet ─────────────────
 *
 * Because the tables have nothing in common. Recipes are (product, size,
 * ingredient, quantity, unit); courts are (name, surface, indoor); opening
 * hours are (day, open, close). One sheet holding all of them would need a
 * union of every column, which is a shape no importer wants and no schema
 * matches. Each table maps to one target table, so each gets one file.
 *
 * The JSON bundle is the exception and the one to reach for when writing an
 * import script: it carries every table AND the catalogue's column definitions
 * (kinds, required flags, the legal tokens of each choice column), which is
 * enough to generate the target schema rather than guess at it.
 *
 * ── Why this is client-side ─────────────────────────────────────────────────
 *
 * The data is already on the page — the review below renders every row of it.
 * A download route would re-authenticate, re-query and re-derive the same
 * bytes, and would be a second place for the export format to live. Blob +
 * anchor, no round-trip.
 */

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function IntakeExport({
  pack,
  projectId,
  projectName,
}: {
  pack: IntakePack;
  projectId: string;
  projectName: string;
}) {
  const toast = useToast();

  const tables = useMemo(
    () => exportTables(pack.pack, pack.rows),
    [pack.pack, pack.rows]
  );

  const answered = useMemo(
    () =>
      Object.values(pack.answers).filter((value) => value.trim() !== "").length,
    [pack.answers]
  );

  const filledTables = tables.filter((table) => table.count > 0);
  const totalRows = tables.reduce((sum, table) => sum + table.count, 0);

  // The clock is read on CLICK, never during render — a render body that calls
  // Date.now() is impure, and this one would put a date into a filename that
  // disagreed with the one the server rendered.
  function stampedName(part: string, extension: string) {
    return exportFilename(projectName, part, extension, todayLocal());
  }

  function downloadTable(index: number) {
    const table = tables[index];
    download(
      stampedName(table.cardKey, "csv"),
      tableCsv(table),
      "text/csv"
    );
    toast.success(
      `${table.count} ${table.count === 1 ? "line" : "lines"} exported.`
    );
  }

  function downloadAnswers() {
    download(
      stampedName("answers", "csv"),
      answersCsv(pack.pack, pack.answers),
      "text/csv"
    );
    toast.success(`${answered} answers exported.`);
  }

  function downloadBundle() {
    const bundle = buildBundle({
      project: { id: projectId, name: projectName },
      pack: pack.pack,
      answers: pack.answers,
      rows: pack.rows,
      progress: pack.progress,
      submittedAt: pack.header?.submitted_at ?? null,
      outstanding: pack.checks
        .filter((check) => !check.ok)
        .map((check) => ({
          label: check.label,
          due: check.due,
          note: check.note,
          optional: check.optional,
        })),
      now: new Date().toISOString(),
    });
    download(
      stampedName("pack", "json"),
      `${JSON.stringify(bundle, null, 2)}\n`,
      "application/json"
    );
    toast.success("Full pack exported.");
  }

  const nothingYet = answered === 0 && totalRows === 0;

  return (
    <Panel>
      <PanelHeader
        title="Export for import"
        action={
          <span className="font-mono text-xs text-faint">
            {totalRows} {totalRows === 1 ? "line" : "lines"} · {answered}{" "}
            answers
          </span>
        }
      />

      <div className="space-y-4 p-4">
        <p className="max-w-[70ch] text-[calc(13px*var(--text-scale,1))] text-muted">
          Machine-readable copies of what the client typed. CSV headers are the{" "}
          <span className="font-mono text-faint">column keys</span>, not the
          labels, so each file maps straight onto a table. Start from the JSON
          bundle if you are writing an import script — it carries the column
          definitions as well as the data.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={downloadBundle} disabled={nothingYet}>
            <Braces className="size-3.5" aria-hidden />
            Whole pack (JSON)
          </Button>
          <Button variant="outline" size="sm" onClick={downloadAnswers} disabled={answered === 0}>
            <Download className="size-3.5" aria-hidden />
            Answers (CSV)
          </Button>
        </div>

        {nothingYet ? (
          <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
            Nothing to export yet — the client hasn&apos;t answered anything.
          </p>
        ) : (
          <div className="rounded-md border border-line">
            {/* Every table, including the empty ones. A list that hid them
                could not answer "have they done the recipes yet?" — the gap
                has to be visible, so an empty table shows a dash and a dead
                button rather than vanishing. */}
            <ul className="divide-y divide-line">
              {tables.map((table, index) => (
                <li
                  key={table.storageKey}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5"
                >
                  <Table2
                    className={
                      table.count > 0 ? "size-3.5 text-primary-dim" : "size-3.5 text-faint"
                    }
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[calc(13px*var(--text-scale,1))] text-ink">
                      {table.title}
                    </span>
                    <span className="block truncate font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                      {table.columns.map((column) => column.key).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-faint">
                    {table.count > 0 ? `${table.count} rows` : "—"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={table.count === 0}
                    onClick={() => downloadTable(index)}
                    aria-label={`Export ${table.title} as CSV`}
                  >
                    <Download className="size-3.5" aria-hidden />
                    CSV
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {filledTables.length > 0 && (
          <p className="font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
            Files are UTF-8 with a BOM — Excel reads the Arabic correctly
          </p>
        )}
      </div>
    </Panel>
  );
}
