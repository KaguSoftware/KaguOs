"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Loader2, Plus, Send, Trash2, Undo2 } from "lucide-react";
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
  DUE_ORDER,
  DUE_SHORT,
  INTAKE_SECTIONS,
  progressOf,
  visibleFields,
  type AnswerMap,
  type IntakeCard,
  type IntakeColumn,
  type IntakeField,
  type IntakeRow,
} from "@/lib/intake";
import { cn, formatRelative } from "@/lib/utils";

/**
 * The client's input pack.
 *
 * ── Why this is one big client component ────────────────────────────────────
 *
 * Two things force it. Conditional questions ("what's the rate per group?"
 * appears the instant you say some items carry tax) have to be immediate, and
 * the completion meter has to move as you answer — a form that told you your
 * progress one server round-trip late would feel broken on the hotel wifi this
 * will actually be filled in on. So the answers live here and the server is
 * written to, not read from, while the pack is open.
 *
 * Local state is seeded from the props ONCE and never re-adopts them. That is
 * deliberate: every save revalidates the route, so adopting fresh props would
 * mean a save in one field could overwrite what someone had just typed in
 * another. React preserves this component's state across those re-renders, so
 * seeding once is both simpler and more correct.
 *
 * ── Why it saves on blur rather than behind a Save button ───────────────────
 *
 * The pack it replaces was an HTML file that autosaved into the browser's own
 * storage and produced a zip to email back. Every failure mode of that design
 * is a lost afternoon: a cleared cache, a second device, a phone that closed
 * the tab. Here an answer is in the database the moment it leaves the field,
 * where the team can already see it — which also means a half-finished pack is
 * useful to Kagu, instead of being invisible until it's done.
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

const LABEL_CLASSES =
  "mb-1.5 flex items-baseline gap-1.5 font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint";

/**
 * The label above every control — quiet, uppercase, out of the way of the answer.
 *
 * Renders a real `<label htmlFor>` for a real control, and a plain `<span id>`
 * for the chip groups, which have no single element to point at. A `<label>`
 * wrapping nothing is worse than no label: a screen reader announces it as a
 * form control that cannot be operated.
 */
function ControlLabel({
  children,
  htmlFor,
  id,
  required,
}: {
  children: React.ReactNode;
  /** The input this labels. Omit (and pass `id`) for a chip group. */
  htmlFor?: string;
  /** Set instead of `htmlFor` — the group points back at this with aria-labelledby. */
  id?: string;
  required?: boolean;
}) {
  const inner = (
    <>
      {children}
      {required && (
        <span className="text-primary-dim" aria-label="required">
          *
        </span>
      )}
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

/**
 * A one-of-N answer as chips.
 *
 * Not a dropdown: these questions have two to five answers, all of which are
 * worth reading before deciding, and a dropdown hides four of them behind a
 * click. Not a radio list either — the chips fit on one line and read as a
 * decision rather than a form.
 *
 * Re-clicking the chosen chip does NOT clear it. Every one of these questions
 * has a real answer, so "no answer" is never a state worth one accidental tap.
 */
function ChoiceChips({
  options,
  value,
  onPick,
  labelledBy,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
  /** Id of the span above — the group has no control of its own to be labelled by. */
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onPick(option.value)}
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
          </button>
        );
      })}
    </div>
  );
}

/** Two-step delete for one line of a table — quiet enough to sit on every row. */
function RemoveLine({
  onConfirm,
  label,
  disabled,
}: {
  onConfirm: () => void;
  /** Which line this removes — "Remove" alone is ambiguous on a list of twenty. */
  label: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
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
        "transition-colors duration-150 disabled:opacity-50",
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
  initialAnswers,
  initialRows,
  initialSubmittedAt,
}: {
  projectId: string;
  projectName: string;
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

  const checks = useMemo(() => buildChecks(answers, rows), [answers, rows]);
  const progress = useMemo(() => progressOf(checks), [checks]);

  const persist = useCallback(
    (fn: () => Promise<{ ok: boolean; message: string } | null>) => {
      setSaveState("saving");
      run(fn, {
        onSuccess: () => setSaveState("saved"),
        // The rollback slot doubles as the failure signal: useAction has already
        // toasted the reason, and leaving the indicator on "Saving…" forever
        // would be the one lie this control can tell.
        rollback: () => setSaveState("idle"),
      });
    },
    [run]
  );

  function setAnswer(cardKey: string, field: IntakeField, value: string) {
    const key = answerKey(cardKey, field.key);
    setAnswers((prev) => ({ ...prev, [key]: value }));
    persist(() => saveIntakeAnswer(projectId, key, value));
  }

  function setCell(row: IntakeRow, column: IntakeColumn, value: string) {
    const next = { ...row.data, [column.key]: value };
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, data: next } : r))
    );
    persist(() => saveIntakeRow(projectId, row.id, row.table_key, next));
  }

  /**
   * The one write that CANNOT be optimistic. Every cell in a line is saved
   * against that line's id, so the row has to exist in the database before it
   * can exist on screen — inventing a local id would mean the first thing typed
   * into a new line is written against a row that isn't there. So this awaits
   * the insert and adopts the id it returns, rather than going through
   * useAction's optimistic path.
   */
  async function addLine(card: IntakeCard & { kind: "table" }) {
    setSaveState("saving");
    try {
      const result = await addIntakeRow(projectId, card.key);
      if (!result?.ok || !result.id) {
        setSaveState("idle");
        toast.error(result?.message ?? "Couldn't add that line.");
        return;
      }
      setRows((prev) => [
        ...prev,
        { id: result.id!, table_key: card.key, data: {}, sort: prev.length },
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
        setRows((prev) =>
          [...prev, row].sort((a, b) => a.sort - b.sort)
        );
      },
    });
  }

  /* ── one field ─────────────────────────────────────────────────────────── */
  function renderField(card: IntakeCard, field: IntakeField) {
    const key = answerKey(card.key, field.key);
    const value = answers[key] ?? "";
    const id = `f-${card.key}-${field.key}`;

    return (
      <div key={field.key} className={cn("min-w-0", span(field.span))}>
        <ControlLabel
          htmlFor={field.kind === "choice" ? undefined : id}
          id={field.kind === "choice" ? `${id}-label` : undefined}
          required={field.required}
        >
          {field.label}
        </ControlLabel>

        {field.kind === "choice" ? (
          <ChoiceChips
            options={field.options ?? []}
            value={value}
            labelledBy={`${id}-label`}
            onPick={(picked) => setAnswer(card.key, field, picked)}
          />
        ) : field.kind === "long" ? (
          <Textarea
            id={id}
            defaultValue={value}
            placeholder={field.placeholder}
            maxLength={8000}
            onBlur={(event) => {
              if (event.target.value !== value) setAnswer(card.key, field, event.target.value);
            }}
          />
        ) : field.kind === "date" ? (
          <DatePicker
            name={id}
            id={id}
            defaultValue={value}
            onChange={(iso) => setAnswer(card.key, field, iso)}
          />
        ) : (
          <Input
            id={id}
            inputMode={field.kind === "number" ? "decimal" : undefined}
            defaultValue={value}
            placeholder={field.placeholder}
            maxLength={2000}
            className={field.kind === "number" ? "font-mono tabular-nums" : undefined}
            onBlur={(event) => {
              if (event.target.value !== value) setAnswer(card.key, field, event.target.value);
            }}
          />
        )}

        {field.hint && (
          <p className="mt-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
            {field.hint}
          </p>
        )}
      </div>
    );
  }

  /* ── one card ──────────────────────────────────────────────────────────── */
  function renderCard(card: IntakeCard) {
    const mine =
      card.kind === "table" ? rows.filter((row) => row.table_key === card.key) : [];

    return (
      <Panel key={card.key} className="p-4 md:p-5">
        <h3 className="text-sm font-semibold text-ink">{card.title}</h3>
        {card.hint && (
          <p className="mt-1.5 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
            {card.hint}
          </p>
        )}

        {card.kind === "fields" ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
            {visibleFields(card, answers).map((field) => renderField(card, field))}
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
                  <li
                    key={row.id}
                    className="rounded-md border border-line bg-raised/25 p-3"
                  >
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
                      {card.columns.map((column) => {
                        const id = `c-${row.id}-${column.key}`;
                        const cell = row.data[column.key] ?? "";
                        return (
                          <div key={column.key} className={cn("min-w-0", span(column.span))}>
                            <ControlLabel htmlFor={id} required={column.required}>
                              {column.label}
                            </ControlLabel>
                            {column.kind === "long" ? (
                              <Textarea
                                id={id}
                                defaultValue={cell}
                                placeholder={column.placeholder}
                                maxLength={2000}
                                onBlur={(event) => {
                                  if (event.target.value !== cell)
                                    setCell(row, column, event.target.value);
                                }}
                              />
                            ) : (
                              <Input
                                id={id}
                                inputMode={column.kind === "number" ? "decimal" : undefined}
                                defaultValue={cell}
                                placeholder={column.placeholder}
                                maxLength={2000}
                                className={cn(
                                  "h-8",
                                  column.kind === "number" && "font-mono tabular-nums"
                                )}
                                onBlur={(event) => {
                                  if (event.target.value !== cell)
                                    setCell(row, column, event.target.value);
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
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
                "hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              )}
            >
              <Plus className="size-3.5" aria-hidden />
              {card.addLabel}
            </button>
          </div>
        )}
      </Panel>
    );
  }

  /* ── the page ──────────────────────────────────────────────────────────── */
  return (
    <div className="grid gap-10">
      {/* ---- Where you are. Answers-so-far, then what's still open, then the
          one line that says whether anything is unsaved. */}
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
              </>
            ) : (
              <span className="text-primary-dim">
                Everything the build needs to start is answered
              </span>
            )}
          </p>
          <p className="ml-auto flex items-center gap-1.5 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
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

      {/* ---- Jump list. The pack is long by nature, and a client filling in
          section 06 on a Tuesday needs to land on section 06. */}
      <nav aria-label="Sections" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {INTAKE_SECTIONS.map((section) => {
          const sectionChecks = checks.filter((c) => c.sectionKey === section.key);
          const counted = sectionChecks.filter((c) => !c.optional);
          const done = counted.filter((c) => c.ok).length;
          const finished = counted.length > 0 && done === counted.length;
          return (
            <a
              key={section.key}
              href={`#s-${section.key}`}
              className="flex items-baseline gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-line-strong hover:bg-raised/30"
            >
              <span className="font-mono text-xs text-primary-dim">{section.num}</span>
              <span className="min-w-0 flex-1 truncate text-[calc(13px*var(--text-scale,1))] text-ink">
                {section.title}
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
      {INTAKE_SECTIONS.map((section) => (
        <section key={section.key} id={`s-${section.key}`} className="scroll-mt-20">
          <header className="mb-4 border-b border-line pb-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-xs tracking-wider text-primary-dim">
                {section.num}
              </span>
              <h2 className="text-[calc(18px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
                {section.title}
              </h2>
              <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-px font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                {DUE_SHORT[section.due]}
              </span>
            </div>
            {section.blurb && (
              <p className="mt-2 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
                {section.blurb}
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
            <span className="font-mono text-xs tracking-wider text-primary-dim">10</span>
            <h2 className="text-[calc(18px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
              Review and send
            </h2>
          </div>
          <p className="mt-2 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
            Everything above is already saved and already visible to us — sending
            is how you say it&rsquo;s ready to work from. You can send an
            unfinished pack: the week-1 answers are what unlock the build, and
            the rest can follow.
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
                              : check.optional
                                ? "border-line text-transparent"
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
                  Send to Kagu
                </Button>
              </div>
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
