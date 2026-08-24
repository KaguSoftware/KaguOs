"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Plus, Send, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import {
  addIntakeRow,
  deleteIntakeRow,
  reopenIntake,
  saveIntakeAnswer,
  saveIntakeRow,
  submitIntake,
} from "@/lib/actions/intake";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Panel } from "@/components/ui/panel";
import { ProgressMeter } from "@/components/portal/progress-meter";
import { useAction } from "@/lib/use-action";
import {
  answerKey,
  buildChecks,
  DUE_LABELS,
  DUE_LABELS_AR,
  DUE_ORDER,
  DUE_SHORT,
  joinMulti,
  progressOf,
  splitMulti,
  tableKey,
  visibleFields,
  type AnswerMap,
  type IntakeCard,
  type IntakeChoice,
  type IntakeColumn,
  type IntakeField,
  type IntakePackDef,
  type IntakeRow,
} from "@/lib/intake";
import { cn, formatRelative } from "@/lib/utils";

/**
 * The client's input pack.
 *
 * ── Why this is one big client component ────────────────────────────────────
 *
 * Two things force it. Conditional questions ("what's the rate per group?"
 * appears the instant you say some items carry tax; a day's opening times
 * disappear the instant you mark it closed) have to be immediate, and the
 * completion meter has to move as you answer — a form that reported progress
 * one server round-trip late would feel broken on the hotel wifi this will
 * actually be filled in on. So the answers live here, and the server is written
 * to rather than read from while the pack is open.
 *
 * Local state is seeded from the props ONCE and never re-adopts them. Every
 * save revalidates the route, so adopting fresh props would let a save in one
 * field overwrite what was being typed in another. React preserves this
 * component's state across those re-renders, so seeding once is both simpler
 * and more correct.
 *
 * ── Why it saves on blur rather than behind a Save button ───────────────────
 *
 * The form it replaces was an HTML file that autosaved into the browser's own
 * storage and produced a zip to email back. Every failure mode of that is a
 * lost afternoon: a cleared cache, a second device, a tab that closed. Here an
 * answer is in the database the moment it leaves the field, where the team can
 * already see it — so a half-finished pack is useful to Kagu instead of being
 * invisible until it's done.
 *
 * ── English and Arabic ──────────────────────────────────────────────────────
 *
 * Both, at once, everywhere the pack supplies both. Not a language toggle: the
 * person filling this in and the person reading the answers don't share a first
 * language, and a switch would mean one of them is always looking at the wrong
 * page. Arabic renders in its own line under the English, marked `lang="ar"`
 * and `dir="rtl"` so it shapes and orders correctly.
 */

const SPAN: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  5: "sm:col-span-5",
  6: "sm:col-span-6",
  7: "sm:col-span-7",
  8: "sm:col-span-8",
  9: "sm:col-span-9",
  10: "sm:col-span-10",
  11: "sm:col-span-11",
  12: "sm:col-span-12",
};

function span(n: number | undefined, fallback = 12) {
  return SPAN[n ?? fallback] ?? SPAN[fallback];
}

/** The Arabic half of anything — its own line, right-to-left, quieter. */
function Ar({ children, className }: { children?: string; className?: string }) {
  if (!children) return null;
  return (
    <span
      lang="ar"
      dir="rtl"
      className={cn("block text-muted", className)}
    >
      {children}
    </span>
  );
}

const LABEL_CLASSES =
  "mb-1.5 block font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint";

/**
 * The label above every control.
 *
 * Renders a real `<label htmlFor>` for a real control and a plain `<span id>`
 * for the chip groups, which have no single element to point at. A `<label>`
 * wrapping nothing is worse than no label: a screen reader announces it as a
 * form control that cannot be operated.
 */
function ControlLabel({
  en,
  ar,
  htmlFor,
  id,
  required,
}: {
  en: string;
  ar?: string;
  htmlFor?: string;
  id?: string;
  required?: boolean;
}) {
  const inner = (
    <>
      <span>
        {en}
        {required && (
          <span className="ml-1 text-primary-dim" aria-label="required">
            *
          </span>
        )}
      </span>
      {/* Arabic labels keep the mono/uppercase treatment off — neither does
          anything useful to Arabic script. */}
      <Ar className="mt-0.5 font-sans text-[calc(11px*var(--text-scale,1))] normal-case tracking-normal">
        {ar}
      </Ar>
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={LABEL_CLASSES}>
      {inner}
    </label>
  ) : (
    <span id={id} className={LABEL_CLASSES}>
      {inner}
    </span>
  );
}

/** One chip. Shared by the one-of-N and many-of-N groups so they can't drift. */
function Chip({
  option,
  active,
  onClick,
  disabled,
}: {
  option: IntakeChoice;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[calc(13px*var(--text-scale,1))]",
        "transition-[color,background-color,border-color,transform] duration-150 ease-mac active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-primary bg-primary font-medium text-primary-ink"
          : "border-line-strong bg-raised text-muted hover:border-faint hover:text-ink"
      )}
    >
      {option.label}
      {option.labelAr && (
        <span
          lang="ar"
          dir="rtl"
          className={cn("ms-2", active ? "opacity-70" : "opacity-80")}
        >
          {option.labelAr}
        </span>
      )}
    </button>
  );
}

/**
 * A one-of-N answer as chips.
 *
 * Not a dropdown: these questions have two to five answers, all of which are
 * worth reading before deciding, and a dropdown hides four of them behind a
 * click. Re-clicking the chosen chip does NOT clear it — every one of these
 * questions has a real answer, so "no answer" is never a state worth one
 * accidental tap.
 */
function ChoiceChips({
  options,
  value,
  onPick,
  labelledBy,
}: {
  options: IntakeChoice[];
  value: string;
  onPick: (value: string) => void;
  labelledBy: string;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip
          key={option.value}
          option={option}
          active={value === option.value}
          onClick={() => onPick(option.value)}
        />
      ))}
    </div>
  );
}

/**
 * A many-of-N answer as chips — allergens, the days a price rule covers.
 *
 * Toggling IS the interaction here, so unlike the single-pick group a second
 * click removes. Stored as one comma-joined string, which is what the original
 * form's export produced and what a human reading the row expects to see.
 */
function MultiChips({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: IntakeChoice[];
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
}) {
  const picked = splitMulti(value);
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = picked.includes(option.value);
        return (
          <Chip
            key={option.value}
            option={option}
            active={active}
            onClick={() =>
              onChange(
                joinMulti(
                  active
                    ? picked.filter((v) => v !== option.value)
                    : [...picked, option.value]
                )
              )
            }
          />
        );
      })}
    </div>
  );
}

/** Two-step delete for one line of a table — quiet enough to sit on every row. */
function RemoveLine({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      aria-label={armed ? `Confirm removing ${label}` : `Remove ${label}`}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider",
        "transition-colors duration-150",
        armed ? "text-danger" : "text-faint hover:text-danger"
      )}
    >
      <Trash2 className="size-3" aria-hidden />
      {armed ? "Sure?" : "Remove"}
    </button>
  );
}

export function IntakeForm({
  projectId,
  projectName,
  pack,
  initialAnswers,
  initialRows,
  initialSubmittedAt,
}: {
  projectId: string;
  projectName: string;
  /** WHICH questions this project asks — see projects.intake_pack (0073). */
  pack: IntakePackDef;
  initialAnswers: AnswerMap;
  initialRows: IntakeRow[];
  initialSubmittedAt: string | null;
}) {
  const { run, pending, toast } = useAction();
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [rows, setRows] = useState<IntakeRow[]>(initialRows);
  const [sentAt, setSentAt] = useState<string | null>(initialSubmittedAt);
  // Three states, because "did that save?" is the one question a form without a
  // Save button has to answer without being asked.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const checks = useMemo(
    () => buildChecks(pack, answers, rows),
    [pack, answers, rows]
  );
  const progress = useMemo(() => progressOf(checks), [checks]);

  function persist(fn: () => Promise<{ ok: boolean; message: string } | null>) {
    setSaveState("saving");
    run(fn, {
      onSuccess: () => setSaveState("saved"),
      // The rollback slot doubles as the failure signal: useAction has already
      // toasted the reason, and leaving the indicator on "Saving…" forever
      // would be the one lie this control can tell.
      rollback: () => setSaveState("idle"),
    });
  }

  function setAnswer(cardKey: string, fieldKey: string, value: string) {
    const key = answerKey(pack.key, cardKey, fieldKey);
    setAnswers((prev) => ({ ...prev, [key]: value }));
    persist(() => saveIntakeAnswer(projectId, key, value));
  }

  function setCell(row: IntakeRow, column: IntakeColumn, value: string) {
    const next = { ...row.data, [column.key]: value };
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, data: next } : r)));
    persist(() => saveIntakeRow(projectId, row.id, row.table_key, next));
  }

  /**
   * The one write that CANNOT be optimistic. Every cell in a line is saved
   * against that line's id, so the row has to exist in the database before it
   * can exist on screen — inventing a local id would mean the first thing typed
   * into a new line is written against a row that isn't there.
   */
  async function addLine(card: IntakeCard & { kind: "table" }) {
    const key = tableKey(pack.key, card.key);
    setSaveState("saving");
    try {
      const result = await addIntakeRow(projectId, key);
      if (!result?.ok || !result.id) {
        setSaveState("idle");
        toast.error(result?.message ?? "Couldn't add that line.");
        return;
      }
      setRows((prev) => [
        ...prev,
        { id: result.id!, table_key: key, data: {}, sort: prev.length },
      ]);
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      toast.error("Something went wrong. Please try again.");
    }
  }

  function removeLine(row: IntakeRow) {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setSaveState("saving");
    run(() => deleteIntakeRow(projectId, row.id), {
      onSuccess: () => setSaveState("saved"),
      // Put the line back where it was, not on the end: a price list that
      // reshuffles itself because a delete failed is worse than the failure.
      rollback: () => {
        setSaveState("idle");
        setRows((prev) => [...prev, row].sort((a, b) => a.sort - b.sort));
      },
    });
  }

  /* ── one control ───────────────────────────────────────────────────────── */
  function renderField(card: IntakeCard, field: IntakeField) {
    const key = answerKey(pack.key, card.key, field.key);
    const value = answers[key] ?? "";
    const id = `f-${card.key}-${field.key}`;
    const chips = field.kind === "choice" || field.kind === "multi";

    return (
      <div key={field.key} className={cn("min-w-0", span(field.span))}>
        <ControlLabel
          en={field.label}
          ar={field.labelAr}
          htmlFor={chips ? undefined : id}
          id={chips ? `${id}-label` : undefined}
          required={field.required}
        />

        {field.kind === "choice" ? (
          <ChoiceChips
            options={field.options ?? []}
            value={value}
            labelledBy={`${id}-label`}
            onPick={(picked) => setAnswer(card.key, field.key, picked)}
          />
        ) : field.kind === "multi" ? (
          <MultiChips
            options={field.options ?? []}
            value={value}
            labelledBy={`${id}-label`}
            onChange={(next) => setAnswer(card.key, field.key, next)}
          />
        ) : field.kind === "long" ? (
          <Textarea
            id={id}
            defaultValue={value}
            placeholder={field.placeholder}
            maxLength={8000}
            lang={field.rtl ? "ar" : undefined}
            dir={field.rtl ? "rtl" : undefined}
            onBlur={(event) => {
              if (event.target.value !== value)
                setAnswer(card.key, field.key, event.target.value);
            }}
          />
        ) : field.kind === "date" ? (
          <DatePicker
            name={id}
            id={id}
            defaultValue={value}
            onChange={(iso) => setAnswer(card.key, field.key, iso)}
          />
        ) : (
          <Input
            id={id}
            inputMode={field.kind === "number" ? "decimal" : undefined}
            defaultValue={value}
            placeholder={field.placeholder}
            maxLength={2000}
            lang={field.rtl ? "ar" : undefined}
            dir={field.rtl ? "rtl" : undefined}
            className={cn(
              field.kind === "number" && "font-mono tabular-nums",
              field.rtl && "text-right"
            )}
            onBlur={(event) => {
              if (event.target.value !== value)
                setAnswer(card.key, field.key, event.target.value);
            }}
          />
        )}

        {(field.hint || field.hintAr) && (
          <p className="mt-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
            {field.hint}
            <Ar className="mt-0.5">{field.hintAr}</Ar>
          </p>
        )}
      </div>
    );
  }

  function renderCell(row: IntakeRow, column: IntakeColumn) {
    const id = `c-${row.id}-${column.key}`;
    const cell = row.data[column.key] ?? "";
    const chips = column.kind === "choice" || column.kind === "multi";

    return (
      <div key={column.key} className={cn("min-w-0", span(column.span))}>
        <ControlLabel
          en={column.label}
          ar={column.labelAr}
          htmlFor={chips ? undefined : id}
          id={chips ? `${id}-label` : undefined}
          required={column.required}
        />
        {column.kind === "choice" ? (
          <ChoiceChips
            options={column.options ?? []}
            value={cell}
            labelledBy={`${id}-label`}
            onPick={(picked) => setCell(row, column, picked)}
          />
        ) : column.kind === "multi" ? (
          <MultiChips
            options={column.options ?? []}
            value={cell}
            labelledBy={`${id}-label`}
            onChange={(next) => setCell(row, column, next)}
          />
        ) : column.kind === "long" ? (
          <Textarea
            id={id}
            defaultValue={cell}
            placeholder={column.placeholder}
            maxLength={2000}
            lang={column.rtl ? "ar" : undefined}
            dir={column.rtl ? "rtl" : undefined}
            onBlur={(event) => {
              if (event.target.value !== cell) setCell(row, column, event.target.value);
            }}
          />
        ) : (
          <Input
            id={id}
            inputMode={column.kind === "number" ? "decimal" : undefined}
            defaultValue={cell}
            placeholder={column.placeholder}
            maxLength={2000}
            lang={column.rtl ? "ar" : undefined}
            dir={column.rtl ? "rtl" : undefined}
            className={cn(
              "h-8",
              column.kind === "number" && "font-mono tabular-nums",
              column.rtl && "text-right"
            )}
            onBlur={(event) => {
              if (event.target.value !== cell) setCell(row, column, event.target.value);
            }}
          />
        )}
      </div>
    );
  }

  /* ── one card ──────────────────────────────────────────────────────────── */
  function renderCard(card: IntakeCard) {
    // A prose panel — the "this is the biggest risk of the phase" warning the
    // recipes section opens with. Carries its own edge colour because the whole
    // point of it is that it is not another question.
    if (card.kind === "note") {
      return (
        <Panel
          key={card.key}
          className={cn(
            "p-4 md:p-5",
            card.tone === "warning" && "border-amber/40 bg-amber/5"
          )}
        >
          <h3 className="flex items-start gap-2 text-sm font-semibold text-ink">
            {card.tone === "warning" && (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
            )}
            <span className="min-w-0">
              {card.title}
              <Ar className="mt-1 font-normal">{card.titleAr}</Ar>
            </span>
          </h3>
          {(card.hint || card.hintAr) && (
            <p className="mt-2.5 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
              {card.hint}
              <Ar className="mt-1.5">{card.hintAr}</Ar>
            </p>
          )}
        </Panel>
      );
    }

    const key = card.kind === "table" ? tableKey(pack.key, card.key) : "";
    const mine = card.kind === "table" ? rows.filter((r) => r.table_key === key) : [];

    return (
      <Panel key={card.key} className="p-4 md:p-5">
        <h3 className="text-sm font-semibold text-ink">
          {card.title}
          <Ar className="mt-0.5 font-normal">{card.titleAr}</Ar>
        </h3>
        {(card.hint || card.hintAr) && (
          <p className="mt-2 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
            {card.hint}
            <Ar className="mt-1.5">{card.hintAr}</Ar>
          </p>
        )}

        {card.kind === "fields" ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
            {visibleFields(pack.key, card, answers).map((field) => renderField(card, field))}
          </div>
        ) : (
          <div className="mt-4">
            {mine.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-5 text-center text-[calc(13px*var(--text-scale,1))] text-faint">
                {card.emptyHint ?? "Nothing yet."}
              </p>
            ) : (
              <ul className="grid gap-2.5">
                {mine.map((row, index) => (
                  <li key={row.id} className="rounded-md border border-line bg-raised/25 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-[calc(10px*var(--text-scale,1))] tracking-wider text-faint">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <RemoveLine
                        label={`line ${index + 1} of ${card.title}`}
                        onConfirm={() => removeLine(row)}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      {card.columns.map((column) => renderCell(row, column))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => addLine(card)}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 py-2.5",
                "text-[calc(13px*var(--text-scale,1))] text-primary-dim",
                "transition-[color,background-color,border-color] duration-150",
                "hover:border-primary hover:bg-primary/5"
              )}
            >
              <Plus className="size-3.5" aria-hidden />
              {card.addLabel}
              {card.addLabelAr && (
                <span lang="ar" dir="rtl" className="opacity-80">
                  {card.addLabelAr}
                </span>
              )}
            </button>
          </div>
        )}
      </Panel>
    );
  }

  /* ── the page ──────────────────────────────────────────────────────────── */
  return (
    <div className="grid gap-10">
      {/* ---- Where you are. */}
      <div className="rounded-lg border border-line bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-medium text-ink">{projectName}</p>
          <p className="font-mono text-xs tabular-nums text-faint">
            {progress.pct}% answered
          </p>
        </div>
        <ProgressMeter
          className="mt-3"
          pct={progress.pct}
          done={progress.done}
          total={progress.total}
          label={`${projectName} input pack completion`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[calc(13px*var(--text-scale,1))]">
          <p className="text-muted">
            {progress.week1Done < progress.week1Total ? (
              <>
                <span className="text-ink">
                  {progress.week1Total - progress.week1Done} left
                </span>{" "}
                in the answers that unlock the build
                <Ar className="mt-0.5">
                  {`بقي ${progress.week1Total - progress.week1Done} من الإجابات التي تفتح البناء`}
                </Ar>
              </>
            ) : (
              <span className="text-primary-dim">
                Everything the build needs to start is answered
                <Ar className="mt-0.5 text-primary-dim">
                  كل ما يحتاجه البناء للانطلاق مُجاب
                </Ar>
              </span>
            )}
          </p>
          <p className="ml-auto flex items-center gap-1.5 self-start font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Saving…
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="size-3 text-primary-dim" aria-hidden />
                Saved
              </>
            ) : (
              "Saves as you go"
            )}
          </p>
        </div>
      </div>

      {/* ---- Jump list. The pack is long by nature, and someone filling in
          section 06 on a Tuesday needs to land on section 06. */}
      <nav aria-label="Sections" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pack.sections.map((section) => {
          const counted = checks.filter(
            (c) => c.sectionKey === section.key && !c.optional
          );
          const done = counted.filter((c) => c.ok).length;
          const finished = counted.length > 0 && done === counted.length;
          return (
            <a
              key={section.key}
              href={`#s-${section.key}`}
              className="flex items-baseline gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-line-strong hover:bg-raised/30"
            >
              <span className="font-mono text-xs text-primary-dim">{section.num}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[calc(13px*var(--text-scale,1))] text-ink">
                  {section.title}
                </span>
                <Ar className="truncate text-[calc(12px*var(--text-scale,1))]">
                  {section.titleAr}
                </Ar>
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums",
                  finished ? "text-primary-dim" : "text-faint"
                )}
              >
                {counted.length === 0 ? "—" : `${done}/${counted.length}`}
              </span>
            </a>
          );
        })}
      </nav>

      {/* ---- The pack itself. */}
      {pack.sections.map((section) => (
        <section key={section.key} id={`s-${section.key}`} className="scroll-mt-20">
          <header className="mb-4 border-b border-line pb-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-xs tracking-wider text-primary-dim">
                {section.num}
              </span>
              <h2 className="text-[calc(18px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
                {section.title}
              </h2>
              {section.titleAr && (
                <span
                  lang="ar"
                  dir="rtl"
                  className="text-[calc(15px*var(--text-scale,1))] text-muted"
                >
                  {section.titleAr}
                </span>
              )}
              <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-px font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                {DUE_SHORT[section.due]}
              </span>
            </div>
            {(section.blurb || section.blurbAr) && (
              <p className="mt-2 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
                {section.blurb}
                <Ar className="mt-1.5">{section.blurbAr}</Ar>
              </p>
            )}
          </header>
          <div className="grid gap-3">{section.cards.map(renderCard)}</div>
        </section>
      ))}

      {/* ---- Review and send. */}
      <section id="s-send" className="scroll-mt-20">
        <header className="mb-4 border-b border-line pb-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[calc(18px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
              Review and send
            </h2>
            <span lang="ar" dir="rtl" className="text-[calc(15px*var(--text-scale,1))] text-muted">
              المراجعة والإرسال
            </span>
          </div>
          <p className="mt-2 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
            Everything above is already saved and already visible to us — sending
            is how you say it&rsquo;s ready to work from. You can send an
            unfinished pack: the week-1 answers are what unlock the build, and
            the rest can follow.
            <Ar className="mt-1.5">
              كل ما فوق محفوظ ومرئي لنا بالفعل — الإرسال يعني أنه جاهز للعمل
              عليه. يمكنكم إرسال حزمة غير مكتملة: إجابات الأسبوع الأول هي التي
              تفتح البناء، والباقي يلحق.
            </Ar>
          </p>
        </header>

        <Panel className="p-4 md:p-5">
          <div className="grid gap-6">
            {DUE_ORDER.map((due) => {
              const group = checks.filter((check) => check.due === due);
              if (group.length === 0) return null;
              return (
                <div key={due}>
                  <p className="mb-2 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                    {DUE_LABELS[due]}
                    <Ar className="mt-0.5 font-sans normal-case tracking-normal">
                      {DUE_LABELS_AR[due]}
                    </Ar>
                  </p>
                  <ul className="grid">
                    {group.map((check) => (
                      <li
                        key={`${check.sectionKey}-${check.cardKey}`}
                        className="flex items-start gap-2.5 border-b border-line/60 py-1.5 last:border-b-0"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                            check.ok
                              ? "border-primary bg-primary text-primary-ink"
                              : "border-line-strong text-transparent"
                          )}
                        >
                          <Check className="size-2.5 [stroke-width:3]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "text-[calc(13px*var(--text-scale,1))]",
                              check.ok ? "text-ink" : "text-muted"
                            )}
                          >
                            {check.label}
                          </span>
                          {check.optional && (
                            <span className="text-[calc(12px*var(--text-scale,1))] text-faint">
                              {" "}
                              · only if it applies
                            </span>
                          )}
                          <Ar className="text-[calc(12px*var(--text-scale,1))]">
                            {check.labelAr}
                          </Ar>
                          {check.note && (
                            <span className="block text-[calc(12px*var(--text-scale,1))] text-amber">
                              {check.note}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-line pt-5">
            {sentAt ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <p className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] text-muted">
                  <span className="text-primary-dim">Sent {formatRelative(sentAt)}.</span>{" "}
                  Kagu has it. Spotted something wrong? Change it above — it saves
                  straight away, and we see the change.
                  <Ar className="mt-1">
                    وصلت إلى كاغو. لاحظتم خطأً؟ عدّلوه فوق — يُحفظ مباشرة ونراه.
                  </Ar>
                </p>
                <Button
                  size="md"
                  disabled={pending}
                  onClick={() =>
                    run(() => reopenIntake(projectId), {
                      success: "Reopened — it's yours again.",
                      optimistic: () => setSentAt(null),
                      rollback: () => setSentAt(sentAt),
                    })
                  }
                >
                  <Undo2 className="size-3.5" aria-hidden />
                  Mark as still working on it
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <p className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] text-muted">
                  {progress.done === progress.total
                    ? "That's everything. Send it over."
                    : `${progress.total - progress.done} still open — send anyway if the rest needs someone who isn't around.`}
                </p>
                <Button
                  variant="primary"
                  size="md"
                  disabled={pending}
                  onClick={() => {
                    const now = new Date().toISOString();
                    run(() => submitIntake(projectId), {
                      success: "Sent to Kagu.",
                      optimistic: () => setSentAt(now),
                      rollback: () => setSentAt(null),
                    });
                  }}
                >
                  <Send className="size-3.5" aria-hidden />
                  Send to Kagu · أرسل
                </Button>
              </div>
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
