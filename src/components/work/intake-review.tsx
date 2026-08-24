import { Check } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { ProgressMeter } from "@/components/portal/progress-meter";
import {
  answerKey,
  choiceLabel,
  DUE_LABELS,
  DUE_ORDER,
  DUE_SHORT,
  INTAKE_SECTIONS,
  rowTouched,
  visibleFields,
  type IntakeCard,
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
 * A producer who needs to change something changes it with the client, not
 * behind their back. (The write path would allow it — `can_write('work')` is an
 * arm of every intake policy in 0072 §4 — so this is a product decision, and
 * the seam is here if it turns out to be the wrong one.)
 */

const NOT_ANSWERED = (
  <span className="text-faint">— not answered yet</span>
);

function CardBlock({ card, pack }: { card: IntakeCard; pack: IntakePack }) {
  if (card.kind === "table") {
    const rows = pack.rows
      .filter((row) => row.table_key === card.key && rowTouched(row))
      .sort((a, b) => a.sort - b.sort);

    return (
      <div>
        <h4 className="text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
          {card.title}
        </h4>
        {rows.length === 0 ? (
          <p className="mt-1.5 text-[calc(13px*var(--text-scale,1))]">{NOT_ANSWERED}</p>
        ) : (
          // The one place in the pack a real table earns its keep: these rows
          // are homogeneous and the reason to open this page is to compare them
          // down a column — which a stack of labelled cards makes impossible.
          <div className="mt-2 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-raised/40">
                  {card.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 font-mono text-[calc(10px*var(--text-scale,1))] font-normal uppercase tracking-wider text-faint"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 last:border-b-0">
                    {card.columns.map((column) => {
                      const cell = row.data[column.key] ?? "";
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            "px-3 py-2 align-top text-[calc(13px*var(--text-scale,1))]",
                            column.kind === "number" && "font-mono tabular-nums",
                            cell ? "text-ink" : "text-faint"
                          )}
                        >
                          {cell || "—"}
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

  const fields = visibleFields(card, pack.answers);

  return (
    <div>
      <h4 className="text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
        {card.title}
      </h4>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          const raw = pack.answers[answerKey(card.key, field.key)] ?? "";
          const shown =
            field.kind === "choice" && raw ? choiceLabel(field, raw) : raw;
          return (
            <div key={field.key} className={field.kind === "long" ? "sm:col-span-2" : undefined}>
              <dt className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                {field.label}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 text-[calc(13px*var(--text-scale,1))]",
                  shown ? "text-ink" : "",
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
          <p className="font-mono text-xs tabular-nums text-faint">
            {pack.progress.pct}%
          </p>
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
            const group = pack.checks.filter(
              (check) => check.due === due && !check.ok
            );
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
                      {check.note && (
                        <span className="text-amber"> · {check.note}</span>
                      )}
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
      {INTAKE_SECTIONS.map((section) => (
        <section key={section.key}>
          <header className="mb-3 flex flex-wrap items-baseline gap-x-3 border-b border-line pb-2.5">
            <span className="font-mono text-xs tracking-wider text-primary-dim">
              {section.num}
            </span>
            <h3 className="text-[calc(16px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
              {section.title}
            </h3>
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
