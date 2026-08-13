"use client";

import { ResourceRow } from "@/components/learn/resource-row";
import type { PlaybookGroup } from "@/lib/learn";
import { cn } from "@/lib/utils";

/**
 * The prompting playbook: one technique per row, one video per technique,
 * grouped the way you'd use them.
 *
 * In the syllabus deck this was a page of eighteen links you'd read once. The
 * only thing it needed to become a tool was memory of which ones you'd done,
 * which is the tick on the left. Numbering is continuous across groups, because
 * "technique 14" is how the deck refers to them and restarting at 01 inside
 * every group would break that.
 */
export function Playbook({
  groups,
  isWatched,
  onToggle,
  readOnly,
}: {
  groups: PlaybookGroup[];
  isWatched: (resourceId: string) => boolean;
  onToggle: (resourceId: string, next: boolean) => void;
  readOnly: boolean;
}) {
  if (groups.length === 0) return null;

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const watched = groups.reduce((n, g) => n + g.watched, 0);

  // Numbering runs across groups, so each group needs to know how many came
  // before it. Computed up front rather than by a counter mutated during the
  // render, which the compiler rightly refuses.
  const offsets: number[] = [];
  groups.reduce((n, group) => {
    offsets.push(n);
    return n + group.items.length;
  }, 0);

  return (
    <div className="p-3.5 sm:p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-mac motion-reduce:transition-none"
            style={{ width: `${total > 0 ? (watched / total) * 100 : 0}%` }}
          />
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
          {watched}/{total} done
        </span>
      </div>

      <div className="grid gap-5">
        {groups.map((group, groupIndex) => {
          const complete = group.items.length > 0 && group.watched === group.items.length;
          const offset = offsets[groupIndex];
          return (
            <section key={group.label}>
              <h3 className="mb-1.5 flex items-center gap-3">
                <span
                  className={cn(
                    "shrink-0 font-mono text-[11px] uppercase tracking-wider transition-colors duration-200",
                    complete ? "text-primary-dim" : "text-faint"
                  )}
                >
                  {group.label}
                </span>
                <span aria-hidden className="h-px min-w-3 flex-1 bg-line" />
                <span
                  className={cn(
                    "shrink-0 font-mono text-[11px] tabular-nums",
                    complete ? "text-primary-dim" : "text-faint"
                  )}
                >
                  {group.watched}/{group.items.length}
                </span>
              </h3>
              <ul className="grid">
                {group.items.map((item, itemIndex) => (
                  <ResourceRow
                    key={item.id}
                    resource={item}
                    index={offset + itemIndex + 1}
                    watched={isWatched(item.id)}
                    readOnly={readOnly}
                    onToggle={onToggle}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
