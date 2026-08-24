"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, CircleDashed, Copy, ListFilter } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { ProgressMeter } from "@/components/portal/progress-meter";
import {
  answerKey,
  choiceLabel,
  DUE_ORDER,
  rowTouched,
  splitMulti,
  tableKey,
  visibleFields,
  type IntakeCard,
  type IntakeColumn,
  type IntakeDue,
} from "@/lib/intake";
import { pickIntake, type IntakeLang } from "@/lib/intake-lang";
import type { IntakePack } from "@/lib/data/intake";
import { cn } from "@/lib/utils";

/**
 * The team's side of the input pack: everything the client has answered, as a
 * document rather than a form.
 *
 * Deliberately READ-ONLY, and deliberately not the same component as the
 * client's form with a `readOnly` flag. The two are answering different
 * questions — "what should I type here?" versus "what did they tell us?" — and
 * a disabled form answers the second one badly: a page of greyed-out inputs
 * where three quarters of them are empty reads as broken, when what it actually
 * means is "they haven't got to section 5 yet".
 *
 * ── What was wrong with it ─────────────────────────────────────────────────
 *
 * Three things, all of which made a producer's first question — "can we start?"
 * — harder to answer than it needed to be.
 *
 * 1. It printed EVERY question, answered or not, in pack order, on one
 *    unbroken scroll with no navigation. Early on that is a page which is three
 *    quarters "— not answered yet", and the few real answers are lost in it.
 *    There is now a **view filter**: everything, only what's answered (the
 *    document you actually read), or only the gaps (the chase list).
 *
 * 2. Every label rendered its English AND its Arabic, stacked, doubling the
 *    length of an already long page. That is now a **language toggle**
 *    (lib/intake-lang.ts) which defaults to English and keeps "both" for anyone
 *    verifying a translation.
 *
 * 3. Labels were 10px uppercase mono in `faint` — the least readable text on
 *    the page was the part telling you what you were looking at. Labels are now
 *    ordinary small text and the ANSWER is the biggest thing in the row, which
 *    is the right way round for a document.
 *
 * The outstanding-items list is also live now: each line jumps to the section
 * it belongs to, so "what's missing" leads somewhere instead of just naming it.
 *
 * Arabic answers still render `lang="ar" dir="rtl"` per field regardless of the
 * toggle — the toggle picks which LABELS to show, and a menu item typed in
 * Arabic is Arabic either way. The surrounding app never flips direction; see
 * lib/intake-lang.ts for why that is a separate preference from the client's.
 *
 * A producer who needs something changed changes it with the client, not behind
 * their back. (The write path would allow it — `can_write('work')` is an arm of
 * every intake policy in 0072 §4 — so this is a product decision, and the seam
 * is here if it turns out to be the wrong one.)
 */

type View = "all" | "answered" | "gaps";

const WEEK_NUM: Record<IntakeDue, number> = { week1: 1, week2: 2, week3: 3 };

const VIEWS: { key: View; label: string; short: string }[] = [
  { key: "all", label: "Everything", short: "All" },
  { key: "answered", label: "Only what they've answered", short: "Answered" },
  { key: "gaps", label: "Only what's still missing", short: "Gaps" },
];

/** The Arabic half, when it's being shown alongside rather than instead. */
function Ar({ children, className }: { children?: string; className?: string }) {
  if (!children) return null;
  return (
    <span lang="ar" dir="rtl" className={cn("block text-muted", className)}>
      {children}
    </span>
  );
}

/**
 * A label in whichever language(s) the toggle asks for.
 *
 * The English is shown when the toggle isn't "Arabic" — OR when there is no
 * Arabic at all, because the `general` pack carries none and a blank label is
 * worse than an untranslated one.
 */
function Label({
  lang,
  en,
  ar,
  className,
}: {
  lang: IntakeLang;
  en: string;
  ar?: string;
  className?: string;
}) {
  const showEn = lang !== "ar" || !ar;
  const showAr = lang !== "en" && Boolean(ar);
  return (
    <span className={className}>
      {showEn && <span className="block">{en}</span>}
      {showAr && <Ar className={showEn ? "mt-0.5 font-normal" : undefined}>{ar}</Ar>}
    </span>
  );
}

/** One cell, rendered as the words a human wrote rather than the token stored. */
function cellText(column: IntakeColumn, raw: string, lang: IntakeLang): string {
  if (!raw) return "";
  if (column.kind === "choice") {
    const { label, labelAr } = choiceLabel(column.options, raw);
    if (lang === "both" && labelAr) return `${label} · ${labelAr}`;
    return pickIntake(lang, label, labelAr);
  }
  if (column.kind === "multi") {
    return splitMulti(raw)
      .map((value) => {
        const { label, labelAr } = choiceLabel(column.options, value);
        return pickIntake(lang, label, labelAr);
      })
      .join(", ");
  }
  return raw;
}

/**
 * The pack as Markdown, for the clipboard.
 *
 * ── Why copy and not download ──────────────────────────────────────────────
 *
 * What this page holds is a DOCUMENT — headed sections, prose answers, and a
 * few genuinely tabular blocks — not a rectangle. CSV would have to either
 * flatten the tables into the fields or drop them, and JSON is only useful to
 * someone who was going to query the database anyway. Markdown keeps the
 * structure, pastes readably into a spec, a message or a model prompt, and
 * survives being pasted somewhere that renders it.
 *
 * It copies WHAT IS ON SCREEN: the same language the toggle is set to and the
 * same filter the view is set to. That is the least surprising rule, and it
 * makes the "Gaps" view double as a chase-list you can send the client.
 */
function toMarkdown(
  pack: IntakePack,
  lang: IntakeLang,
  view: View,
  projectName: string,
  keep: (card: IntakeCard, v: View) => boolean
): string {
  const out: string[] = [];
  const label = (en: string, ar?: string) =>
    lang === "both" && ar ? `${en} · ${ar}` : pickIntake(lang, en, ar);

  out.push(`# ${projectName} — input pack`);
  out.push("");
  out.push(
    `Completion: ${pack.progress.pct}% (${pack.progress.done}/${pack.progress.total})  `
  );
  out.push(
    `Status: ${pack.header?.submitted_at ? `sent by the client` : "not sent yet"}  `
  );
  out.push(
    `Showing: ${VIEWS.find((v) => v.key === view)?.label ?? view} · labels in ${
      lang === "both" ? "English + Arabic" : lang === "ar" ? "Arabic" : "English"
    }`
  );

  const open = pack.checks.filter((c) => !c.ok);
  if (open.length > 0) {
    out.push("");
    out.push("## Still outstanding");
    out.push("");
    for (const due of DUE_ORDER) {
      const group = open.filter((c) => c.due === due);
      if (group.length === 0) continue;
      out.push(`**Week ${WEEK_NUM[due]}**`);
      out.push("");
      for (const c of group) {
        const note = c.note ? ` — ${c.note}` : "";
        const opt = c.optional ? " _(only if it applies)_" : "";
        out.push(`- ${pickIntake(lang, c.label, c.labelAr)}${opt}${note}`);
      }
      out.push("");
    }
  }

  for (const section of pack.pack.sections) {
    const cards = section.cards.filter((card) => keep(card, view));
    if (cards.length === 0) continue;

    out.push("");
    out.push(
      `## ${section.num} · ${label(section.title, section.titleAr)}  (Week ${
        WEEK_NUM[section.due]
      })`
    );

    for (const card of cards) {
      if (card.kind === "note") continue;
      out.push("");
      out.push(`### ${label(card.title, card.titleAr)}`);
      out.push("");

      if (card.kind === "table") {
        const key = tableKey(pack.pack.key, card.key);
        const rows = pack.rows
          .filter((r) => r.table_key === key && rowTouched(r))
          .sort((a, b) => a.sort - b.sort);
        if (rows.length === 0) {
          out.push("_not answered yet_");
          continue;
        }
        // A pipe inside a cell would end the column early.
        const esc = (t: string) =>
          t.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
        const heads = card.columns.map((c) => esc(label(c.label, c.labelAr)));
        out.push(`| ${heads.join(" | ")} |`);
        out.push(`| ${card.columns.map(() => "---").join(" | ")} |`);
        for (const row of rows) {
          const cells = card.columns.map((c) =>
            esc(cellText(c, row.data[c.key] ?? "", lang) || "—")
          );
          out.push(`| ${cells.join(" | ")} |`);
        }
        continue;
      }

      const fields = visibleFields(pack.pack.key, card, pack.answers).filter((f) => {
        const raw = pack.answers[answerKey(pack.pack.key, card.key, f.key)] ?? "";
        if (view === "answered") return raw !== "";
        if (view === "gaps") return raw === "";
        return true;
      });
      for (const field of fields) {
        const raw = pack.answers[answerKey(pack.pack.key, card.key, field.key)] ?? "";
        let shown = raw;
        if (raw && field.kind === "choice") {
          const { label: l, labelAr } = choiceLabel(field.options, raw);
          shown = lang === "both" && labelAr ? `${l} · ${labelAr}` : pickIntake(lang, l, labelAr);
        } else if (raw && field.kind === "multi") {
          shown = splitMulti(raw)
            .map((v) => {
              const { label: l, labelAr } = choiceLabel(field.options, v);
              return pickIntake(lang, l, labelAr);
            })
            .join(", ");
        }
        const name = label(field.label, field.labelAr);
        if (!shown) {
          out.push(`- **${name}:** _not answered yet_`);
        } else if (field.kind === "long") {
          // Long prose gets its own block so newlines survive the paste.
          out.push(`- **${name}:**`);
          for (const line of shown.split(/\r?\n/)) out.push(`  > ${line}`);
        } else {
          out.push(`- **${name}:** ${shown}`);
        }
      }
    }
  }

  return out.join("\n") + "\n";
}

export function IntakeReview({
  pack,
  lang,
  projectName,
}: {
  pack: IntakePack;
  lang: IntakeLang;
  projectName: string;
}) {
  const [view, setView] = useState<View>("all");
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  /** Which sections have anything to show under the current filter. */
  const visibleSections = useMemo(
    () =>
      pack.pack.sections.filter((section) =>
        section.cards.some((card) => cardHasContent(card, view))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pack, view]
  );

  /** Is this card worth rendering at all in the current view? */
  function cardHasContent(card: IntakeCard, v: View): boolean {
    if (card.kind === "note") return false;

    if (card.kind === "table") {
      const key = tableKey(pack.pack.key, card.key);
      const has = pack.rows.some((row) => row.table_key === key && rowTouched(row));
      if (v === "answered") return has;
      if (v === "gaps") return !has;
      return true;
    }

    const fields = visibleFields(pack.pack.key, card, pack.answers);
    const answered = fields.filter(
      (f) => (pack.answers[answerKey(pack.pack.key, card.key, f.key)] ?? "") !== ""
    );
    if (v === "answered") return answered.length > 0;
    if (v === "gaps") return answered.length < fields.length;
    return fields.length > 0;
  }

  const copy = useCallback(async () => {
    const text = toMarkdown(pack, lang, view, projectName, cardHasContent);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Input pack copied as Markdown.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused on an insecure origin and by some
      // policies. Say so rather than silently doing nothing.
      toast.error("Couldn't reach the clipboard — copy is blocked in this browser.");
    }
    // cardHasContent is redeclared each render but is a pure function of `pack`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, lang, view, projectName, toast]);

  const open = pack.checks.filter((c) => !c.ok);
  const allClear = open.length === 0;

  return (
    <div className="grid gap-6">
      {/* ---- What's missing, first. A producer opens this page to find out
          whether they can start, and the answer to that is the gaps, not the
          answers. */}
      <Panel className="p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[calc(15px*var(--text-scale,1))] font-semibold text-ink">
            Completion
          </h2>
          <p className="font-mono text-xs tabular-nums text-faint">{pack.progress.pct}%</p>
        </div>
        <ProgressMeter
          className="mt-3"
          pct={pack.progress.pct}
          done={pack.progress.done}
          total={pack.progress.total}
          label="Input pack completion"
        />

        {allClear ? (
          <p className="mt-4 flex items-center gap-2 text-[calc(14px*var(--text-scale,1))] text-primary-dim">
            <Check className="size-4" aria-hidden />
            Nothing outstanding.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {DUE_ORDER.map((due) => {
              const group = open.filter((check) => check.due === due);
              if (group.length === 0) return null;
              return (
                <div key={due}>
                  <p className="mb-1.5 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                    Still open · Week {WEEK_NUM[due]}
                    {due === "week1" && " — unlocks the build"}
                  </p>
                  <ul className="grid gap-1">
                    {group.map((check) => (
                      <li key={`${check.sectionKey}-${check.cardKey}`}>
                        {/* Clickable, so "what's missing" leads somewhere. */}
                        <a
                          href={`#s-${check.sectionKey}`}
                          className="text-[calc(14px*var(--text-scale,1))] text-muted underline-offset-2 hover:text-ink hover:underline"
                        >
                          {pickIntake(lang, check.label, check.labelAr)}
                        </a>
                        {check.optional && (
                          <span className="text-[calc(13px*var(--text-scale,1))] text-faint">
                            {" · only if it applies"}
                          </span>
                        )}
                        {check.note && (
                          <span className="text-[calc(13px*var(--text-scale,1))] text-amber">
                            {" · "}
                            {check.note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ---- The controls, and a contents strip. Sticky, because the reason
          this page was hard to follow is that once you were 2000px down it
          offered nothing: no sense of place, no way back to a section, and no
          way to cut the noise. */}
      <div className="sticky top-0 z-20 -mx-1 border-b border-line bg-bg/95 px-1 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
            <ListFilter className="size-3.5" aria-hidden />
            Show
          </span>
          <Segmented
            options={VIEWS.map((v) => ({
              key: v.key,
              label: v.label,
              short: v.short,
              title: v.label,
            }))}
            value={view}
            onChange={setView}
            label="Which answers to show"
            size="sm"
          />
          {/* Copy, not download: see toMarkdown() for why. It copies exactly
              what the filter and the language toggle are showing. */}
          <button
            type="button"
            onClick={copy}
            title="Copy everything shown, as Markdown"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1",
              "text-[calc(12px*var(--text-scale,1))] transition-colors duration-150",
              copied
                ? "border-primary/30 bg-primary/10 text-primary-dim"
                : "border-line text-muted hover:border-line-strong hover:text-ink"
            )}
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="ms-auto" />
          <nav aria-label="Jump to section" className="flex flex-wrap items-center gap-1">
            {pack.pack.sections.map((section) => {
              const shown = visibleSections.some((s) => s.key === section.key);
              return (
                <a
                  key={section.key}
                  href={`#s-${section.key}`}
                  aria-disabled={!shown}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[calc(11px*var(--text-scale,1))] transition-colors duration-150",
                    shown
                      ? "text-muted hover:bg-raised hover:text-ink"
                      : "pointer-events-none text-line-strong"
                  )}
                  title={section.title}
                >
                  {section.num}
                </a>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ---- The answers, in the order they were asked. */}
      {visibleSections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-[calc(14px*var(--text-scale,1))] text-faint">
          {view === "answered"
            ? "They haven't answered anything yet."
            : "Nothing missing — every question in the pack has an answer."}
        </p>
      ) : (
        visibleSections.map((section) => (
          <section key={section.key} id={`s-${section.key}`} className="scroll-mt-20">
            <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2.5">
              <span className="font-mono text-[calc(13px*var(--text-scale,1))] tracking-wider text-primary-dim">
                {section.num}
              </span>
              <h3 className="text-[calc(17px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
                {pickIntake(lang, section.title, section.titleAr)}
              </h3>
              {lang === "both" && section.titleAr && (
                <span
                  lang="ar"
                  dir="rtl"
                  className="text-[calc(14px*var(--text-scale,1))] text-muted"
                >
                  {section.titleAr}
                </span>
              )}
              <span className="ms-auto shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                Week {WEEK_NUM[section.due]}
              </span>
            </header>
            <div className="grid gap-4">
              {section.cards
                .filter((card) => cardHasContent(card, view))
                .map((card) => (
                  <CardBlock
                    key={card.key}
                    card={card}
                    pack={pack}
                    lang={lang}
                    view={view}
                  />
                ))}
            </div>
          </section>
        ))
      )}

      {pack.header?.submitted_at && (
        <p className="font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
          Sent by the client · they can still edit it
        </p>
      )}
    </div>
  );
}

const NOT_ANSWERED = (
  <span className="inline-flex items-center gap-1.5 text-faint">
    <CircleDashed className="size-3.5" aria-hidden />
    not answered yet
  </span>
);

function CardBlock({
  card,
  pack,
  lang,
  view,
}: {
  card: IntakeCard;
  pack: IntakePack;
  lang: IntakeLang;
  view: View;
}) {
  // Prose panels are instructions to the client. Nothing was answered in them,
  // so reproducing them here would pad the document with text the reader wrote.
  if (card.kind === "note") return null;

  const heading = (
    <h4 className="mb-2.5 text-[calc(15px*var(--text-scale,1))] font-semibold text-ink">
      <Label lang={lang} en={card.title} ar={card.titleAr} />
    </h4>
  );

  if (card.kind === "table") {
    const key = tableKey(pack.pack.key, card.key);
    const rows = pack.rows
      .filter((row) => row.table_key === key && rowTouched(row))
      .sort((a, b) => a.sort - b.sort);

    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        {heading}
        {rows.length === 0 ? (
          <p className="text-[calc(14px*var(--text-scale,1))]">{NOT_ANSWERED}</p>
        ) : (
          // The one place in the pack a real table earns its keep: these rows
          // are homogeneous and the reason to open this page is to compare them
          // down a column — which a stack of labelled cards makes impossible.
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[42rem] border-collapse text-start">
              <thead>
                <tr className="border-b border-line bg-raised/40">
                  {card.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 text-start align-bottom text-[calc(12px*var(--text-scale,1))] font-medium text-muted"
                    >
                      <Label lang={lang} en={column.label} ar={column.labelAr} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 last:border-b-0">
                    {card.columns.map((column) => {
                      const text = cellText(column, row.data[column.key] ?? "", lang);
                      return (
                        <td
                          key={column.key}
                          lang={column.rtl ? "ar" : undefined}
                          dir={column.rtl ? "rtl" : undefined}
                          className={cn(
                            "px-3 py-2 align-top text-[calc(14px*var(--text-scale,1))]",
                            column.kind === "number" && "font-mono tabular-nums",
                            text ? "text-ink" : "text-faint"
                          )}
                        >
                          {text || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const fields = visibleFields(pack.pack.key, card, pack.answers).filter((field) => {
    const raw = pack.answers[answerKey(pack.pack.key, card.key, field.key)] ?? "";
    if (view === "answered") return raw !== "";
    if (view === "gaps") return raw === "";
    return true;
  });

  if (fields.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      {heading}
      <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
        {fields.map((field) => {
          const raw = pack.answers[answerKey(pack.pack.key, card.key, field.key)] ?? "";
          let shown = raw;
          if (raw && field.kind === "choice") {
            const { label, labelAr } = choiceLabel(field.options, raw);
            shown =
              lang === "both" && labelAr
                ? `${label} · ${labelAr}`
                : pickIntake(lang, label, labelAr);
          } else if (raw && field.kind === "multi") {
            shown = splitMulti(raw)
              .map((value) => {
                const { label, labelAr } = choiceLabel(field.options, value);
                return pickIntake(lang, label, labelAr);
              })
              .join(", ");
          }
          return (
            <div
              key={field.key}
              className={field.kind === "long" ? "sm:col-span-2" : undefined}
            >
              {/* The label is small and quiet; the ANSWER is the thing being
                  read. This was the other way round. */}
              <dt className="text-[calc(13px*var(--text-scale,1))] text-faint">
                <Label lang={lang} en={field.label} ar={field.labelAr} />
              </dt>
              <dd
                lang={field.rtl ? "ar" : undefined}
                dir={field.rtl ? "rtl" : undefined}
                className={cn(
                  "mt-0.5 text-[calc(15px*var(--text-scale,1))]",
                  shown && "text-ink",
                  field.kind === "long" && "whitespace-pre-wrap leading-relaxed"
                )}
              >
                {shown || NOT_ANSWERED}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
