/**
 * Getting the answers back OUT — the input pack as something you can import.
 *
 * ── What this is for ────────────────────────────────────────────────────────
 *
 * The pack's whole point is that a business types its recipes, its menu, its
 * courts, its rates and its opening hours into KaguOs instead of into a
 * WhatsApp thread. The moment they finish, that data has to become rows in the
 * database of the thing being BUILT for them — a different database, on a
 * different schema, that this app knows nothing about.
 *
 * So the job here is not "pretty printing". It is producing files an importer
 * eats without a human retyping anything:
 *
 *   · one CSV per repeating table (recipes, ingredients, menu, courts, rates,
 *     hours, staff, …), whose HEADER ROW IS THE COLUMN KEYS, not the human
 *     labels — `nameEn,nameAr,priceSmall` maps onto a schema; "Name (English)"
 *     does not.
 *   · one CSV of every scalar answer, as key/value with the question beside it
 *     so a person can audit the mapping.
 *   · one JSON bundle carrying the whole pack INCLUDING the catalogue's own
 *     column definitions — enough to generate the target tables from, and the
 *     format to reach for when writing an import script.
 *
 * ── Why the CSVs carry a BOM ────────────────────────────────────────────────
 *
 * Half these cells are Arabic. Excel on Windows opens a UTF-8 CSV as the system
 * codepage unless the file starts with a byte-order mark, which turns a menu
 * into mojibake — and the person who spots it will reasonably conclude the
 * client typed rubbish. Three bytes, and every other tool ignores them.
 */

import {
  answerKey,
  choiceLabel,
  rowTouched,
  splitMulti,
  tableKey,
  type IntakeColumn,
  type IntakePackDef,
  type IntakeRow,
} from "@/lib/intake";
import type { AnswerMap } from "@/lib/intake";

/* ── CSV ──────────────────────────────────────────────────────────────────── */

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  // A leading CR is as breaking as a leading LF, and a cell that merely
  // CONTAINS a quote needs the whole cell quoted, not just the quote doubled.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The byte-order mark, built from its code point rather than pasted in.
 *
 * U+FEFF renders as nothing at all in an editor, so a literal one inside quotes
 * is a character a well-meaning reformat — or a careless select-and-retype —
 * can delete with no visible trace. The only symptom would be an Arabic menu
 * opening as mojibake three weeks later, on someone else's machine.
 */
const BOM = String.fromCharCode(0xfeff);

/** Rows joined with CRLF, which is what RFC 4180 says and what Excel expects. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

/* ── The pack, sliced into importable pieces ──────────────────────────────── */

/**
 * One repeating table, ready to write out.
 *
 * `rows` are RAW stored strings, not display text: a choice cell exports the
 * token (`g`), because that is the value a target schema wants in a column with
 * a check constraint on it. The human label goes in the JSON bundle's schema
 * block instead, where an importer can read the mapping if it needs one.
 */
export type ExportTable = {
  cardKey: string;
  /** The namespaced storage key — `touch-padel.recipes.lines`. */
  storageKey: string;
  sectionTitle: string;
  title: string;
  titleAr?: string;
  columns: IntakeColumn[];
  rows: string[][];
  /** How many lines the client actually typed into. */
  count: number;
};

/**
 * Every table in the pack, including the EMPTY ones.
 *
 * Empty tables are kept deliberately. A panel that lists only what has been
 * filled in cannot answer "did they do the recipes yet?" — the absence has to
 * be visible, or it reads as a feature that isn't there. The download button
 * for a table with no rows is simply disabled.
 */
export function exportTables(
  pack: IntakePackDef,
  rows: IntakeRow[]
): ExportTable[] {
  const out: ExportTable[] = [];

  for (const section of pack.sections) {
    for (const card of section.cards) {
      if (card.kind !== "table") continue;
      const storageKey = tableKey(pack.key, card.key);
      const mine = rows
        .filter((row) => row.table_key === storageKey && rowTouched(row))
        .sort((a, b) => a.sort - b.sort);

      out.push({
        cardKey: card.key,
        storageKey,
        sectionTitle: section.title,
        title: card.title,
        titleAr: card.titleAr,
        columns: card.columns,
        rows: mine.map((row) =>
          card.columns.map((column) => row.data[column.key] ?? "")
        ),
        count: mine.length,
      });
    }
  }

  return out;
}

export function tableCsv(table: ExportTable): string {
  return toCsv(
    table.columns.map((column) => column.key),
    table.rows
  );
}

/**
 * Every scalar answer as one flat sheet.
 *
 * Five columns rather than two, because this file has two readers. An importer
 * wants `key` and `value` and ignores the rest; a person checking the mapping
 * wants to see the QUESTION next to the answer, and reading a hundred rows of
 * `decisions.tax.mode,percent` without them is guesswork.
 *
 * `value` is the stored token; `display` is what the client saw. For a plain
 * text answer they are the same string, and for a chip question they are
 * `sat,sun` and `Saturday, Sunday` — which is precisely the pair you need in
 * front of you when you decide which one your schema stores.
 */
export function answersCsv(pack: IntakePackDef, answers: AnswerMap): string {
  const rows: string[][] = [];

  for (const section of pack.sections) {
    for (const card of section.cards) {
      if (card.kind !== "fields") continue;
      for (const field of card.fields) {
        const key = answerKey(pack.key, card.key, field.key);
        const value = answers[key] ?? "";
        // Blank answers are skipped: this file is what the client TOLD us, and
        // a hundred empty rows in the middle of it buries the eighty that
        // aren't. What is still missing is the completion checklist's job, and
        // it is on the same page as the button that produced this.
        if (!value.trim()) continue;

        let display = value;
        if (field.kind === "choice") {
          display = choiceLabel(field.options, value).label;
        } else if (field.kind === "multi") {
          display = splitMulti(value)
            .map((token) => choiceLabel(field.options, token).label)
            .join(", ");
        }

        rows.push([key, section.title, card.title, field.label, value, display]);
      }
    }
  }

  return toCsv(
    ["key", "section", "card", "question", "value", "display"],
    rows
  );
}

/* ── The whole thing, as JSON ─────────────────────────────────────────────── */

/**
 * The import format.
 *
 * Carries the catalogue's own column definitions alongside the data, which is
 * the difference between "a blob of strings" and "something you can generate a
 * schema from": `kind` says whether a column is a number or a date, `options`
 * enumerates the legal tokens of a choice column, `required` says which ones
 * the pack itself refused to call complete without.
 *
 * Shape is stable and additive — an import script written against it should not
 * break because a question was reworded. Adding a key is fine; renaming one is
 * not, for the same reason `answerKey` may never change.
 */
export type IntakeBundle = {
  kaguOsExport: "intake-pack";
  version: 1;
  exportedAt: string;
  project: { id: string; name: string };
  pack: { key: string; name: string; summary: string };
  progress: { done: number; total: number; pct: number };
  submittedAt: string | null;
  /** Scalar answers, flat, keyed exactly as they are stored. */
  answers: Record<string, string>;
  tables: {
    key: string;
    cardKey: string;
    title: string;
    section: string;
    columns: {
      key: string;
      label: string;
      labelAr?: string;
      kind: IntakeColumn["kind"];
      required: boolean;
      options?: { value: string; label: string }[];
    }[];
    rows: Record<string, string>[];
  }[];
  /** What the pack still considers unanswered, so an importer can refuse early. */
  outstanding: { card: string; due: string; note?: string; optional: boolean }[];
};

export function buildBundle(input: {
  project: { id: string; name: string };
  pack: IntakePackDef;
  answers: AnswerMap;
  rows: IntakeRow[];
  progress: { done: number; total: number; pct: number };
  submittedAt: string | null;
  outstanding: { label: string; due: string; note?: string; optional: boolean }[];
  now: string;
}): IntakeBundle {
  const tables = exportTables(input.pack, input.rows);

  return {
    kaguOsExport: "intake-pack",
    version: 1,
    exportedAt: input.now,
    project: input.project,
    pack: {
      key: input.pack.key,
      name: input.pack.name,
      summary: input.pack.summary,
    },
    progress: {
      done: input.progress.done,
      total: input.progress.total,
      pct: input.progress.pct,
    },
    submittedAt: input.submittedAt,
    // Blank answers dropped for the same reason the CSV drops them, and because
    // `{"decisions.tax.rate": ""}` in an import file is worse than the key being
    // absent — it looks like a deliberate empty string.
    answers: Object.fromEntries(
      Object.entries(input.answers).filter(([, value]) => value.trim() !== "")
    ),
    tables: tables.map((table) => ({
      key: table.storageKey,
      cardKey: table.cardKey,
      title: table.title,
      section: table.sectionTitle,
      columns: table.columns.map((column) => ({
        key: column.key,
        label: column.label,
        labelAr: column.labelAr,
        kind: column.kind,
        required: Boolean(column.required),
        options: column.options?.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      })),
      // Objects rather than positional arrays: a row keyed by column name
      // survives a column being inserted in the middle of the catalogue, which
      // a positional array silently does not.
      rows: table.rows.map((cells) =>
        Object.fromEntries(
          table.columns
            .map((column, index) => [column.key, cells[index] ?? ""] as const)
            .filter(([, value]) => value !== "")
        )
      ),
    })),
    outstanding: input.outstanding.map((check) => ({
      card: check.label,
      due: check.due,
      note: check.note,
      optional: check.optional,
    })),
  };
}

/* ── Filenames ────────────────────────────────────────────────────────────── */

/** `Touch Padel` + `recipes.lines` → `touch-padel-recipes-lines-2026-08-24.csv`. */
export function exportFilename(
  projectName: string,
  part: string,
  extension: string,
  date: string
): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      // A project named entirely in Arabic slugs to nothing; without this the
      // file would be called `--recipes-2026-08-24.csv`.
      .slice(0, 40) || "pack";
  return `${slug(projectName)}-${slug(part)}-${date}.${extension}`;
}
