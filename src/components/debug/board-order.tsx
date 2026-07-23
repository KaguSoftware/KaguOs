"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pin, PinOff } from "lucide-react";
import { setDebugBoardOrder } from "@/lib/actions/debug-boards";
import { CreateOverlay } from "@/components/ui/create";
import { useAction } from "@/lib/use-action";
import type { BoardProject } from "@/components/debug/board";

/**
 * Admin editor for the board rail's order.
 *
 * Two lists, mirroring the rail's own rule: PINNED boards render first in the
 * order set here; everything else auto-sorts by open task count. Pin/unpin and
 * up/down arrows, not drag-and-drop — nothing in this app drags, and the
 * up/down vocabulary already exists in the focus editor.
 *
 * Every change writes immediately (optimistic local state, error toast on
 * reject) — there's no Save button to forget, same contract as reordering
 * focus items.
 */
export function BoardOrderOverlay({
  projects,
  openCounts,
  onClose,
}: {
  /** All boards in their current effective order (pinned first). */
  projects: BoardProject[];
  /** Open-task count per project id, for the auto-sorted rows' labels. */
  openCounts: Record<string, number>;
  onClose: () => void;
}) {
  const { run, pending } = useAction();
  // Seeded once — after that the local lists are the truth for this session;
  // the server refresh that follows each write re-sends the same order.
  const [pinned, setPinned] = useState(() =>
    projects.filter((p) => p.debug_position !== null)
  );
  const [rest, setRest] = useState(() =>
    projects.filter((p) => p.debug_position === null)
  );

  function commit(nextPinned: BoardProject[], nextRest: BoardProject[]) {
    setPinned(nextPinned);
    setRest(nextRest);
    run(() =>
      setDebugBoardOrder(
        nextPinned.map((p) => p.id),
        nextRest.map((p) => p.id)
      )
    );
  }

  function pin(project: BoardProject) {
    commit(
      [...pinned, project],
      rest.filter((p) => p.id !== project.id)
    );
  }

  function unpin(project: BoardProject) {
    // Back into the auto-sorted list where the rail will place it: by open
    // count, name as tie-break — so this list previews the rail exactly.
    const next = [...rest, project].sort(
      (a, b) =>
        (openCounts[b.id] ?? 0) - (openCounts[a.id] ?? 0) ||
        a.name.localeCompare(b.name)
    );
    commit(
      pinned.filter((p) => p.id !== project.id),
      next
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= pinned.length) return;
    const next = [...pinned];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next, rest);
  }

  return (
    <CreateOverlay
      open
      onClose={onClose}
      title="Order the boards"
      hint="Pinned boards lead the rail in this order — the rest follow, sorted by open tasks."
    >
      <div className="space-y-5">
        <section className="space-y-1.5">
          <h3 className="text-[13px] font-medium text-muted">Pinned first</h3>
          {pinned.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[13px] text-faint">
              Nothing pinned — the rail is fully automatic. Pin a board to
              bring attention to it.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {pinned.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface/60 px-3 py-2"
                >
                  <span className="w-4 shrink-0 font-mono text-[11px] text-faint">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {p.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {openCounts[p.id] ?? 0} open
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || pending}
                      aria-label={`Move ${p.name} up`}
                      className="rounded p-1 text-faint transition-colors hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === pinned.length - 1 || pending}
                      aria-label={`Move ${p.name} down`}
                      className="rounded p-1 text-faint transition-colors hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => unpin(p)}
                      disabled={pending}
                      aria-label={`Unpin ${p.name}`}
                      className="rounded p-1 text-faint transition-colors hover:text-ink disabled:opacity-30"
                    >
                      <PinOff className="size-3" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-1.5">
          <h3 className="text-[13px] font-medium text-muted">
            Auto — sorted by open tasks
          </h3>
          {rest.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[13px] text-faint">
              Every board is pinned.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rest.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface/60 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {p.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {openCounts[p.id] ?? 0} open
                  </span>
                  <button
                    type="button"
                    onClick={() => pin(p)}
                    disabled={pending}
                    aria-label={`Pin ${p.name}`}
                    className="shrink-0 rounded p-1 text-faint transition-colors hover:text-ink disabled:opacity-30"
                  >
                    <Pin className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CreateOverlay>
  );
}
