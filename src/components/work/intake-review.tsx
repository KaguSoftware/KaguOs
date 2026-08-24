import { Check } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { ProgressMeter } from "@/components/portal/progress-meter";
import {
  answerKey,
  choiceLabel,
  DUE_LABELS,
  DUE_ORDER,
  DUE_SHORT,
  rowTouched,
  splitMulti,
  tableKey,
  visibleFields,
  type IntakeCard,
  type IntakeColumn,
} from "@/lib/intake";
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
 * Arabic is shown WITH the English rather than instead of it. A producer in
 * Istanbul reading a menu a client typed in Baghdad needs both halves visible:
 * the Arabic is the deliverable, the English is how they check it.
 *
 * A producer who needs something changed changes it with the client, not behind
 * their back. (The write path would allow it — `can_write('work')` is an arm of
 * every intake policy in 0072 §4 — so this is a product decision, and the seam
 * is here if it turns out to be the wrong one.)
 */

const NOT_ANSWERED = <span className="text-faint">— not answered yet</span>;

function Ar({ children, className }: { children?: string; className?: string }) {
  if (!children) return null;
  return (
    <span lang="ar" dir="rtl" className={cn("block text-muted", className)}>
      {children}
    </span>
  );
}

/** One cell, rendered as the words a human wrote rather than the token stored. */
function cellText(column: IntakeColumn, raw: string): string {
  if (!raw) return "";
  if (column.kind === "choice") {
    const { label, labelAr } = choiceLabel(column.options, raw);
    return labelAr ? `${label} · ${labelAr}` : label;
  }
  if (column.kind === "multi") {
    return splitMulti(raw)
      .map((value) => choiceLabel(column.options, value).label)
      .join(", ");
  }
  return raw;
}

function CardBlock({ card, pack }: { card: IntakeCard; pack: IntakePack }) {
  // Prose panels are instructions to the client. Nothing was answered in them,
  // so reproducing them here would pad the document with text the reader wrote.
  if (card.kind === "note") return null;

  const heading = (
    <h4 className="text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
      {card.title}
      <Ar className="mt-0.5 font-normal">{card.titleAr}</Ar>
    </h4>
  );

  if (card.kind === "table") {
    const key = tableKey(pack.pack.key, card.key);
    const rows = pack.rows
      .filter((row) => row.table_key === key && rowTouched(row))
      .sort((a, b) => a.sort - b.sort);

    return (
      <div>
        {heading}
        {rows.length === 0 ? (
          <p className="mt-1.5 text-[calc(13px*var(--text-scale,1))]">{NOT_ANSWERED}</p>
        ) : (
          // The one place in the pack a real table earns its keep: these rows
          // are homogeneous and the reason to open this page is to compare them
          // down a column — which a stack of labelled cards makes impossible.
          <div className="mt-2 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[42rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-raised/40">
                  {card.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 align-bottom font-mono text-[calc(10px*var(--text-scale,1))] font-normal uppercase tracking-wider text-faint"
                    >
                      {column.label}
                      <Ar className="mt-0.5 font-sans normal-case tracking-normal">
                        {column.labelAr}
                      </Ar>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 last:border-b-0">
                    {card.columns.map((column) => {
                      const text = cellText(column, row.data[column.key] ?? "");
                      return (
                        <td
                          key={column.key}
                          lang={column.rtl ? "ar" : undefined}
                          dir={column.rtl ? "rtl" : undefined}
                          className={cn(
                            "px-3 py-2 align-top text-[calc(13px*var(--text-scale,1))]",
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

  const fields = visibleFields(pack.pack.key, card, pack.answers);

  return (
    <div>
      {heading}
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          const raw = pack.answers[answerKey(pack.pack.key, card.key, field.key)] ?? "";
          let shown = raw;
          if (raw && field.kind === "choice") {
            const { label, labelAr } = choiceLabel(field.options, raw);
            shown = labelAr ? `${label} · ${labelAr}` : label;
          } else if (raw && field.kind === "multi") {
            shown = splitMulti(raw)
              .map((value) => choiceLabel(field.options, value).label)
              .join(", ");
          }
          return (
            <div key={field.key} className={field.kind === "long" ? "sm:col-span-2" : undefined}>
              <dt className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                {field.label}
                <Ar className="mt-0.5 font-sans normal-case tracking-normal">
                  {field.labelAr}
                </Ar>
              </dt>
              <dd
                lang={field.rtl ? "ar" : undefined}
                dir={field.rtl ? "rtl" : undefined}
                className={cn(
                  "mt-0.5 text-[calc(13px*var(--text-scale,1))]",
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

export function IntakeReview({ pack }: { pack: IntakePack }) {
  const sent = pack.header?.submitted_at ?? null;

  return (
    <div className="grid gap-8">
      {/* ---- What's missing, first. A producer opens this page to find out
          whether they can start, and the answer to that is the gaps, not the
          answers. */}
      <Panel className="p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-ink">Completion</h2>
          <p className="font-mono text-xs tabular-nums text-faint">{pack.progress.pct}%</p>
        </div>
        <ProgressMeter
          className="mt-3"
          pct={pack.progress.pct}
          done={pack.progress.done}
          total={pack.progress.total}
          label="Input pack completion"
        />

        <div className="mt-5 grid gap-5">
          {DUE_ORDER.map((due) => {
            const group = pack.checks.filter((check) => check.due === due && !check.ok);
            if (group.length === 0) return null;
            return (
              <div key={due}>
                <p className="mb-1.5 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                  Still open · {DUE_LABELS[due]}
                </p>
                <ul className="grid gap-1">
                  {group.map((check) => (
                    <li
                      key={`${check.sectionKey}-${check.cardKey}`}
                      className="text-[calc(13px*var(--text-scale,1))] text-muted"
                    >
                      {check.label}
                      {check.optional && (
                        <span className="text-faint"> · only if it applies</span>
                      )}
                      {check.note && <span className="text-amber"> · {check.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {pack.checks.every((check) => check.ok) && (
            <p className="flex items-center gap-2 text-[calc(13px*var(--text-scale,1))] text-primary-dim">
              <Check className="size-3.5" aria-hidden />
              Nothing outstanding.
            </p>
          )}
        </div>
      </Panel>

      {/* ---- The answers, in the order they were asked. */}
      {pack.pack.sections.map((section) => (
        <section key={section.key}>
          <header className="mb-3 flex flex-wrap items-baseline gap-x-3 border-b border-line pb-2.5">
            <span className="font-mono text-xs tracking-wider text-primary-dim">
              {section.num}
            </span>
            <h3 className="text-[calc(16px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
              {section.title}
            </h3>
            {section.titleAr && (
              <span lang="ar" dir="rtl" className="text-[calc(13px*var(--text-scale,1))] text-muted">
                {section.titleAr}
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
              {DUE_SHORT[section.due]}
            </span>
          </header>
          <div className="grid gap-5">
            {section.cards.map((card) => (
              <CardBlock key={card.key} card={card} pack={pack} />
            ))}
          </div>
        </section>
      ))}

      {sent && (
        <p className="font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
          Sent by the client · they can still edit it
        </p>
      )}
    </div>
  );
}
