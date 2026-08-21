"use client";

import { CreativeCard } from "@/components/marketing/creative-card";
import {
  CREATIVE_LADDER,
  CREATIVE_STATUS_HINTS,
  CREATIVE_STATUS_LABELS,
} from "@/lib/creatives";
import type { Creative, CreativeStatus, MembersMap } from "@/lib/types";

/**
 * The pipeline board: columns are the ladder, cards are videos.
 *
 * ── Why this scrolls sideways instead of wrapping ──────────────────────────
 * Nine states will not fit across a laptop at a readable card width, and the
 * two obvious escapes both cost more than they save. Wrapping the columns
 * breaks the left-to-right reading of a pipeline, which is the only thing a
 * board gives you over a list. Collapsing states into fewer columns hides the
 * distinction between "being cut" and "with the client", which is precisely the
 * distinction three people sharing the work need to see.
 *
 * So it is a horizontal strip with the app's `scrollbar-none` treatment, which
 * the section rails already use. Columns are a fixed width so a card never
 * reflows as the board fills up.
 *
 * ── Why there is no drag and drop ──────────────────────────────────────────
 * A board invites it. But a video moves one step at a time along a fixed
 * ladder, so the only legal drop for any card is the next column — a drag is
 * then a long gesture that does exactly what the button on the card already
 * does in one click, and it is unusable by keyboard. PRODUCT.md's one-click
 * primitive is the better answer here, not the lesser one.
 *
 * `changes_requested` appears only when something is in it, and it appears
 * immediately BEFORE `editing` — not after `client_review`, where the video
 * came from. A column's position should say where its cards are going, and
 * these are going back into the edit. Showing it permanently would draw the
 * pipeline as though every video passed through it, which is the opposite of
 * what the team wants to be true.
 */
export function PipelineBoard({
  creatives,
  members,
  canWrite,
  /** House board (0068): the ladder skips client_review, so hide that column unless something is stranded in it. */
  house = false,
}: {
  creatives: Creative[];
  members: MembersMap;
  canWrite: boolean;
  house?: boolean;
}) {
  let columns: CreativeStatus[] = [...CREATIVE_LADDER];
  if (house && !creatives.some((c) => c.status === "client_review")) {
    columns = columns.filter((s) => s !== "client_review");
  }
  if (creatives.some((c) => c.status === "changes_requested")) {
    // Derived, not hard-coded: if the ladder is ever reordered, the sent-back
    // column follows `editing` instead of landing at a stale index.
    columns.splice(CREATIVE_LADDER.indexOf("editing"), 0, "changes_requested");
  }

  const byStatus = new Map<CreativeStatus, Creative[]>();
  for (const creative of creatives) {
    const list = byStatus.get(creative.status) ?? [];
    list.push(creative);
    byStatus.set(creative.status, list);
  }

  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-3">
        {columns.map((status) => {
          const cards = byStatus.get(status) ?? [];
          return (
            <section
              key={status}
              aria-label={CREATIVE_STATUS_LABELS[status]}
              className="flex w-72 shrink-0 flex-col rounded-lg border border-line bg-surface"
            >
              <header className="border-b border-line px-3 py-2.5">
                <h3 className="flex items-baseline justify-between gap-2 text-[calc(13px*var(--text-scale,1))] font-semibold text-ink">
                  {CREATIVE_STATUS_LABELS[status]}
                  <span className="font-mono text-xs font-normal text-faint tabular-nums">
                    {cards.length}
                  </span>
                </h3>
              </header>

              {cards.length === 0 ? (
                // The hint teaches the column instead of saying "empty". A new
                // marketer should be able to learn the pipeline by reading the
                // board, which is only true while the board is mostly empty —
                // exactly when a blank column would say nothing.
                <p className="px-3 py-4 text-xs leading-relaxed text-faint">
                  {CREATIVE_STATUS_HINTS[status]}
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {cards.map((creative) => (
                    <li key={creative.id}>
                      <CreativeCard
                        creative={creative}
                        members={members}
                        canWrite={canWrite}
                        showStatus={false}
                        house={house}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
