"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
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
  DUE_ORDER,
  joinMulti,
  progressOf,
  splitMulti,
  tableKey,
  visibleFields,
  type AnswerMap,
  type IntakeCard,
  type IntakeChoice,
  type IntakeColumn,
  type IntakeDue,
  type IntakeField,
  type IntakePackDef,
  type IntakeRow,
} from "@/lib/intake";
import { dict } from "@/lib/i18n";
import { pick, type Locale } from "@/lib/locale";
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
 * and more correct. ⚠️ That is also why the language toggle calls
 * `router.refresh()` rather than navigating: a navigation would remount this
 * and lose whatever is half-typed.
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
 * ── One section at a time ───────────────────────────────────────────────────
 *
 * This used to render all nine sections and every card expanded, on one page,
 * under a jump list you saw once and then scrolled past. The result was a wall:
 * no sense of where you were, no sense of how much was left, and a scroll
 * position as the only state. It is now a step per section plus a review step —
 * the rail says where you are and what is left in each, the sticky header keeps
 * the meter and the save state in view, and each screen is short enough to
 * finish in one sitting.
 *
 * ── One language at a time ──────────────────────────────────────────────────
 *
 * Also new. Every label used to render its English and its Arabic stacked, on
 * the reasoning that the filler and the reader don't share a language. They
 * don't — but they are two different PEOPLE, so the fix is a per-viewer toggle
 * (lib/locale.ts), not two languages in one column. `pick()` chooses a half and
 * falls back to English when a pack has no Arabic.
 *
 * `rtl` on a FIELD is a different thing entirely and survives the toggle: it
 * marks a field whose CONTENT is Arabic — the Arabic half of a bilingual menu
 * item — so that input runs right-to-left even for a client reading the
 * interface in English.
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

const WEEK_NUM: Record<IntakeDue, number> = { week1: 1, week2: 2, week3: 3 };

/**
 * The label above every control.
 *
 * ⚠️ This was `font-mono text-[10px] uppercase tracking-wider text-faint`. On a
 * form, the question is the content — and that made it the smallest,
 * lowest-contrast, hardest-to-scan text on the page, in a colour DESIGN.md
 * itself reserves for "meta text, never body copy". It is now ordinary body
 * text in `ink`: the thing you are answering should be the thing you can read.
 *
 * Renders a real `<label htmlFor>` for a real control and a plain `<span id>`
 * for the chip groups, which have no single element to point at. A `<label>`
 * wrapping nothing is worse than no label: a screen reader announces it as a
 * form control that cannot be operated.
 */
function ControlLabel({
  text,
  htmlFor,
  id,
  required,
  requiredLabel,
}: {
  text: string;
  htmlFor?: string;
  id?: string;
  required?: boolean;
  requiredLabel: string;
}) {
  const classes =
    "mb-1.5 block text-[calc(15px*var(--text-scale,1))] font-medium leading-snug text-ink";
  const inner = (
    <>
      {text}
      {required && (
        <span className="ms-1 text-primary-dim" aria-label={requiredLabel}>
          *
        </span>
      )}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={classes}>
      {inner}
    </label>
  ) : (
    <span id={id} className={classes}>
      {inner}
    </span>
  );
}

/** One chip. Shared by the one-of-N and many-of-N groups so they can't drift. */
function Chip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
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
        // Bigger than it was (px-3 py-1.5 at 13px): these are the primary
        // controls on several sections and they are tapped on a tablet.
        "min-h-10 rounded-full border px-4 py-2 text-[calc(14px*var(--text-scale,1))]",
        "transition-[color,background-color,border-color,transform] duration-150 ease-mac active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-primary bg-primary font-medium text-primary-ink"
          : "border-line-strong bg-raised text-muted hover:border-faint hover:text-ink"
      )}
    >
      {label}
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
  locale,
}: {
  options: IntakeChoice[];
  value: string;
  onPick: (value: string) => void;
  labelledBy: string;
  locale: Locale;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip
          key={option.value}
          label={pick(locale, option.label, option.labelAr)}
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
  locale,
}: {
  options: IntakeChoice[];
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
  locale: Locale;
}) {
  const picked = splitMulti(value);
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = picked.includes(option.value);
        return (
          <Chip
            key={option.value}
            label={pick(locale, option.label, option.labelAr)}
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
function RemoveLine({
  onConfirm,
  label,
  remove,
  sure,
}: {
  onConfirm: () => void;
  label: string;
  remove: string;
  sure: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      aria-label={armed ? `${sure} — ${label}` : `${remove} ${label}`}
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
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[calc(13px*var(--text-scale,1))]",
        "transition-colors duration-150",
        armed ? "text-danger" : "text-faint hover:text-danger"
      )}
    >
      <Trash2 className="size-3.5" aria-hidden />
      {armed ? sure : remove}
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
  locale,
  intro,
}: {
  projectId: string;
  projectName: string;
  /** WHICH questions this project asks — see projects.intake_pack (0073). */
  pack: IntakePackDef;
  initialAnswers: AnswerMap;
  initialRows: IntakeRow[];
  initialSubmittedAt: string | null;
  locale: Locale;
  intro: string;
}) {
  const t = dict(locale);
  const { run, pending, toast } = useAction();
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [rows, setRows] = useState<IntakeRow[]>(initialRows);
  const [sentAt, setSentAt] = useState<string | null>(initialSubmittedAt);
  // Three states, because "did that save?" is the one question a form without a
  // Save button has to answer without being asked.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  /** `pack.sections.length` is the review step — one past the last section. */
  const [step, setStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const checks = useMemo(
    () => buildChecks(pack, answers, rows),
    [pack, answers, rows]
  );
  const progress = useMemo(() => progressOf(checks), [checks]);

  /** Per-section counts, for the rail. Optional cards never count, as upstream. */
  const perSection = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const section of pack.sections) {
      const counted = checks.filter(
        (c) => c.sectionKey === section.key && !c.optional
      );
      map.set(section.key, {
        done: counted.filter((c) => c.ok).length,
        total: counted.length,
      });
    }
    return map;
  }, [pack.sections, checks]);

  const reviewStep = pack.sections.length;
  const section = step < reviewStep ? pack.sections[step] : null;

  /**
   * Moving between steps puts you at the top of the new one. Without this the
   * browser keeps the old scroll offset and a short section opens halfway down
   * its own content, which reads as a rendering bug.
   */
  const goTo = useCallback((next: number) => {
    setStep(next);
    topRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);

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
        toast.error(result?.message ?? t.toastAddFailed);
        return;
      }
      setRows((prev) => [
        ...prev,
        { id: result.id!, table_key: key, data: {}, sort: prev.length },
      ]);
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      toast.error(t.toastGeneric);
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
    const hint = pick(locale, field.hint ?? "", field.hintAr);

    return (
      <div key={field.key} className={cn("min-w-0", span(field.span))}>
        <ControlLabel
          text={pick(locale, field.label, field.labelAr)}
          htmlFor={chips ? undefined : id}
          id={chips ? `${id}-label` : undefined}
          required={field.required}
          requiredLabel={t.required}
        />

        {field.kind === "choice" ? (
          <ChoiceChips
            options={field.options ?? []}
            value={value}
            labelledBy={`${id}-label`}
            locale={locale}
            onPick={(picked) => setAnswer(card.key, field.key, picked)}
          />
        ) : field.kind === "multi" ? (
          <MultiChips
            options={field.options ?? []}
            value={value}
            labelledBy={`${id}-label`}
            locale={locale}
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
            className="min-h-28 text-[calc(15px*var(--text-scale,1))]"
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
              // h-11 rather than h-9: a touch target on the tablet this is
              // filled in on, and it matches the chips beside it.
              "h-11 text-[calc(15px*var(--text-scale,1))]",
              field.kind === "number" && "font-mono tabular-nums",
              field.rtl && "text-end"
            )}
            onBlur={(event) => {
              if (event.target.value !== value)
                setAnswer(card.key, field.key, event.target.value);
            }}
          />
        )}

        {hint && (
          <p className="mt-2 text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
            {hint}
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
          text={pick(locale, column.label, column.labelAr)}
          htmlFor={chips ? undefined : id}
          id={chips ? `${id}-label` : undefined}
          required={column.required}
          requiredLabel={t.required}
        />
        {column.kind === "choice" ? (
          <ChoiceChips
            options={column.options ?? []}
            value={cell}
            labelledBy={`${id}-label`}
            locale={locale}
            onPick={(picked) => setCell(row, column, picked)}
          />
        ) : column.kind === "multi" ? (
          <MultiChips
            options={column.options ?? []}
            value={cell}
            labelledBy={`${id}-label`}
            locale={locale}
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
            className="min-h-20 text-[calc(15px*var(--text-scale,1))]"
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
              "h-11 text-[calc(15px*var(--text-scale,1))]",
              column.kind === "number" && "font-mono tabular-nums",
              column.rtl && "text-end"
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
    const title = pick(locale, card.title, card.titleAr);
    const hint = pick(locale, card.hint ?? "", card.hintAr);

    // A prose panel — the "this is the biggest risk of the phase" warning the
    // recipes section opens with. Carries its own edge colour because the whole
    // point of it is that it is not another question.
    if (card.kind === "note") {
      return (
        <Panel
          key={card.key}
          className={cn(
            "p-5",
            card.tone === "warning" && "border-amber/40 bg-amber/5"
          )}
        >
          <h3 className="flex items-start gap-2.5 text-[calc(16px*var(--text-scale,1))] font-semibold text-ink">
            {card.tone === "warning" && (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
            )}
            <span className="min-w-0">{title}</span>
          </h3>
          {hint && (
            <p className="mt-3 max-w-[70ch] text-[calc(15px*var(--text-scale,1))] leading-relaxed text-muted">
              {hint}
            </p>
          )}
        </Panel>
      );
    }

    const key = card.kind === "table" ? tableKey(pack.key, card.key) : "";
    const mine = card.kind === "table" ? rows.filter((r) => r.table_key === key) : [];

    return (
      <Panel key={card.key} className="p-5">
        <h3 className="text-[calc(17px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
          {title}
        </h3>
        {hint && (
          <p className="mt-2 max-w-[70ch] text-[calc(14px*var(--text-scale,1))] leading-relaxed text-muted">
            {hint}
          </p>
        )}

        {card.kind === "fields" ? (
          <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-12">
            {visibleFields(pack.key, card, answers).map((field) =>
              renderField(card, field)
            )}
          </div>
        ) : (
          <div className="mt-5">
            {mine.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-[calc(14px*var(--text-scale,1))] text-muted">
                {card.emptyHint
                  ? pick(locale, card.emptyHint, card.emptyHintAr)
                  : t.nothingYet}
              </p>
            ) : (
              <ul className="grid gap-3">
                {mine.map((row, index) => (
                  <li
                    key={row.id}
                    className="rounded-md border border-line bg-raised/25 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-mono text-[calc(12px*var(--text-scale,1))] tracking-wider text-faint">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <RemoveLine
                        label={t.removeLineAria(index + 1, title)}
                        remove={t.remove}
                        sure={t.removeSure}
                        onConfirm={() => removeLine(row)}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-12">
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
                "mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-3",
                "text-[calc(14px*var(--text-scale,1))] font-medium text-primary-dim",
                "transition-[color,background-color,border-color] duration-150",
                "hover:border-primary hover:bg-primary/5"
              )}
            >
              <Plus className="size-4" aria-hidden />
              {pick(locale, card.addLabel, card.addLabelAr)}
            </button>
          </div>
        )}
      </Panel>
    );
  }

  /* ── the rail ──────────────────────────────────────────────────────────── */
  function railItem(index: number) {
    const s = pack.sections[index];
    const count = perSection.get(s.key);
    const finished = Boolean(count && count.total > 0 && count.done === count.total);
    const active = step === index;
    return (
      <button
        key={s.key}
        type="button"
        aria-current={active ? "step" : undefined}
        onClick={() => goTo(index)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start",
          "transition-colors duration-150",
          active ? "bg-raised text-ink" : "text-muted hover:bg-raised/40 hover:text-ink"
        )}
      >
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border text-[calc(10px*var(--text-scale,1))] font-mono",
            finished
              ? "border-primary bg-primary text-primary-ink"
              : active
                ? "border-primary-dim text-primary-dim"
                : "border-line-strong text-faint"
          )}
        >
          {finished ? <Check className="size-3 [stroke-width:3]" aria-hidden /> : s.num}
        </span>
        <span className="min-w-0 flex-1 truncate text-[calc(14px*var(--text-scale,1))]">
          {pick(locale, s.title, s.titleAr)}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums",
            finished ? "text-primary-dim" : "text-faint"
          )}
        >
          {!count || count.total === 0 ? "—" : `${count.done}/${count.total}`}
        </span>
      </button>
    );
  }

  /* ── the page ──────────────────────────────────────────────────────────── */
  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* ---- Sticky status. The meter, the save state and where you are, kept
          in view for the whole pack — the single biggest thing the old
          all-on-one-page layout lost the moment you scrolled. */}
      <div className="sticky top-[57px] z-20 -mx-4 mb-6 md:top-0 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="min-w-0 truncate text-[calc(16px*var(--text-scale,1))] font-semibold text-ink">
            {projectName}
          </p>
          <p className="flex items-center gap-2 font-mono text-[calc(12px*var(--text-scale,1))] tabular-nums text-faint">
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden />
                {t.saving}
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="size-3 text-primary-dim" aria-hidden />
                {t.saved}
              </>
            ) : (
              t.savesAsYouGo
            )}
            <span aria-hidden className="text-line-strong">
              ·
            </span>
            {t.answered(progress.pct)}
          </p>
        </div>
        <ProgressMeter
          className="mt-2.5"
          pct={progress.pct}
          done={progress.done}
          total={progress.total}
          label={t.packProgressAria(projectName)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        {/* ---- The rail. A list on desktop; on narrow screens it collapses to
            the same list inside a details disclosure, so a phone doesn't open
            on nine rows of navigation before the first question. */}
        <nav aria-label={t.sectionsNav} className="lg:sticky lg:top-[9.5rem] lg:self-start">
          <details className="group rounded-lg border border-line bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[calc(14px*var(--text-scale,1))] text-ink">
              <span className="min-w-0 truncate font-medium">
                {section
                  ? `${section.num} · ${pick(locale, section.title, section.titleAr)}`
                  : t.reviewTitle}
              </span>
              <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                {t.stepOf(step + 1, reviewStep + 1)}
              </span>
            </summary>
            <div className="grid gap-0.5 border-t border-line p-2">
              {pack.sections.map((_, i) => railItem(i))}
              {reviewRailItem()}
            </div>
          </details>

          <div className="hidden lg:grid lg:gap-0.5">
            <p className="mb-1 px-2.5 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
              {t.sections}
            </p>
            {pack.sections.map((_, i) => railItem(i))}
            <div className="my-1 border-t border-line" />
            {reviewRailItem()}
          </div>
        </nav>

        <div className="min-w-0">
          {section ? (
            <>
              <header className="mb-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[calc(13px*var(--text-scale,1))] tracking-wider text-primary-dim">
                    {section.num}
                  </span>
                  <h2 className="text-[calc(22px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
                    {pick(locale, section.title, section.titleAr)}
                  </h2>
                  <span className="ms-auto shrink-0 rounded-full border border-line px-2.5 py-0.5 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                    {t.weekShort(WEEK_NUM[section.due])}
                  </span>
                </div>
                {(section.blurb || section.blurbAr) && (
                  <p className="mt-2.5 max-w-[70ch] text-[calc(15px*var(--text-scale,1))] leading-relaxed text-muted">
                    {pick(locale, section.blurb ?? "", section.blurbAr)}
                  </p>
                )}
                {/* The one-line promise about saving, said once per pack on the
                    first step rather than in a banner above every screen. */}
                {step === 0 && (
                  <p className="mt-2.5 max-w-[70ch] text-[calc(14px*var(--text-scale,1))] leading-relaxed text-faint">
                    {intro}
                  </p>
                )}
              </header>

              <div className="grid gap-4">{section.cards.map(renderCard)}</div>
            </>
          ) : (
            renderReview()
          )}

          {/* ---- Step controls. Always at the bottom of the content column,
              always the same two shapes, so moving through nine sections is one
              muscle memory instead of a hunt for the next heading. */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
            <Button
              size="md"
              disabled={step === 0}
              onClick={() => goTo(step - 1)}
              className={step === 0 ? "invisible" : undefined}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
              {t.back}
            </Button>

            <span className="font-mono text-[calc(12px*var(--text-scale,1))] text-faint">
              {t.stepOf(step + 1, reviewStep + 1)}
            </span>

            {step < reviewStep ? (
              <Button variant="primary" size="md" onClick={() => goTo(step + 1)}>
                {step === reviewStep - 1 ? t.goToReview : t.next}
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            ) : (
              <span className="w-px" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* ── the review step ───────────────────────────────────────────────────── */

  function reviewRailItem() {
    const active = step === reviewStep;
    const allDone = progress.total > 0 && progress.done === progress.total;
    return (
      <button
        type="button"
        aria-current={active ? "step" : undefined}
        onClick={() => goTo(reviewStep)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start",
          "transition-colors duration-150",
          active ? "bg-raised text-ink" : "text-muted hover:bg-raised/40 hover:text-ink"
        )}
      >
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border",
            sentAt
              ? "border-primary bg-primary text-primary-ink"
              : allDone
                ? "border-primary-dim text-primary-dim"
                : "border-line-strong text-faint"
          )}
        >
          <Send className="size-2.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[calc(14px*var(--text-scale,1))]">
          {t.reviewTitle}
        </span>
      </button>
    );
  }

  function renderReview() {
    return (
      <>
        <header className="mb-5">
          <h2 className="text-[calc(22px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
            {t.reviewTitle}
          </h2>
          <p className="mt-2.5 max-w-[70ch] text-[calc(15px*var(--text-scale,1))] leading-relaxed text-muted">
            {t.reviewBlurb}
          </p>
        </header>

        <Panel className="p-5">
          <div className="grid gap-6">
            {DUE_ORDER.map((due) => {
              const group = checks.filter((check) => check.due === due);
              if (group.length === 0) return null;
              return (
                <div key={due}>
                  <p className="mb-2.5 font-mono text-[calc(12px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                    {t.weekShort(WEEK_NUM[due])}
                  </p>
                  <ul className="grid">
                    {group.map((check) => (
                      <li
                        key={`${check.sectionKey}-${check.cardKey}`}
                        className="flex items-start gap-3 border-b border-line/60 py-2.5 last:border-b-0"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border",
                            check.ok
                              ? "border-primary bg-primary text-primary-ink"
                              : "border-line-strong text-transparent"
                          )}
                        >
                          <Check className="size-2.5 [stroke-width:3]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => {
                              const i = pack.sections.findIndex(
                                (s) => s.key === check.sectionKey
                              );
                              if (i >= 0) goTo(i);
                            }}
                            className={cn(
                              "text-start text-[calc(14px*var(--text-scale,1))] underline-offset-2 hover:underline",
                              check.ok ? "text-ink" : "text-muted hover:text-ink"
                            )}
                          >
                            {pick(locale, check.label, check.labelAr)}
                          </button>
                          {check.optional && (
                            <span className="text-[calc(13px*var(--text-scale,1))] text-faint">
                              {" · "}
                              {t.optionalIfApplies}
                            </span>
                          )}
                          {check.note && (
                            <span className="block text-[calc(13px*var(--text-scale,1))] text-amber">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <p className="min-w-0 flex-1 text-[calc(14px*var(--text-scale,1))] leading-relaxed text-muted">
                  <span className="text-primary-dim">
                    {t.sentLine(formatRelative(sentAt))}
                  </span>{" "}
                  {t.sentAfter}
                </p>
                <Button
                  size="md"
                  className="w-full shrink-0 sm:w-auto"
                  disabled={pending}
                  onClick={() =>
                    run(() => reopenIntake(projectId), {
                      success: t.toastReopened,
                      optimistic: () => setSentAt(null),
                      rollback: () => setSentAt(sentAt),
                    })
                  }
                >
                  <Undo2 className="size-4" aria-hidden />
                  {t.reopenButton}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <p className="min-w-0 flex-1 text-[calc(14px*var(--text-scale,1))] leading-relaxed text-muted">
                  {progress.done === progress.total
                    ? t.sendAllDone
                    : t.sendSomeOpen(progress.total - progress.done)}
                </p>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full shrink-0 sm:w-auto"
                  disabled={pending}
                  onClick={() => {
                    const now = new Date().toISOString();
                    run(() => submitIntake(projectId), {
                      success: t.toastSent,
                      optimistic: () => setSentAt(now),
                      rollback: () => setSentAt(null),
                    });
                  }}
                >
                  <Send className="size-4" aria-hidden />
                  {t.sendButton}
                </Button>
              </div>
            )}
          </div>
        </Panel>
      </>
    );
  }
}
