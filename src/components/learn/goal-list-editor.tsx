"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type GoalItem = { id: string; title: string };

/**
 * The one goal list: used by the composer (draft state) and the edit page
 * (persisted via server actions). Reordering is hand-rolled — a pointer drag
 * on the grip plus per-row arrow buttons — so it stays dependency-free and
 * fully keyboard operable. The parent owns the list; this only reports intent.
 */
export function GoalListEditor({
  goals,
  onReorder,
  onRename,
  onRemove,
}: {
  goals: GoalItem[];
  onReorder: (orderedIds: string[]) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}) {
  type DragState = { id: string; from: number; to: number; dy: number; rowH: number };
  const [drag, setDragState] = useState<DragState | null>(null);
  // Mirrored in a ref so pointer-up commits outside a state updater (updaters
  // must stay pure; StrictMode double-invokes them).
  const dragRef = useRef<DragState | null>(null);
  function setDrag(next: DragState | null) {
    dragRef.current = next;
    setDragState(next);
  }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function move(from: number, to: number) {
    if (to < 0 || to >= goals.length || to === from) return;
    const ids = goals.map((g) => g.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    onReorder(ids);
  }

  function startDrag(event: React.PointerEvent, id: string, index: number) {
    // Left button / touch only; ignore while renaming.
    if (event.button !== 0 || editingId) return;
    const row = (event.currentTarget as HTMLElement).closest("li");
    if (!row) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const rowH = row.getBoundingClientRect().height;
    const startY = event.clientY;

    setDrag({ id, from: index, to: index, dy: 0, rowH });

    function onMove(e: PointerEvent) {
      const prev = dragRef.current;
      if (!prev) return;
      const dy = e.clientY - startY;
      const to = Math.min(
        goals.length - 1,
        Math.max(0, prev.from + Math.round(dy / prev.rowH))
      );
      setDrag({ ...prev, dy, to });
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      const prev = dragRef.current;
      setDrag(null);
      if (prev && prev.to !== prev.from) move(prev.from, prev.to);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  function commitRename(id: string) {
    const goal = goals.find((g) => g.id === id);
    setEditingId(null);
    if (!goal) return;
    const next = draftTitle.trim();
    if (next && next !== goal.title) onRename(id, next);
  }

  if (goals.length === 0) {
    return (
      <p className="text-[13px] text-faint">
        No goals yet — the checklist everyone ticks lives here.
      </p>
    );
  }

  return (
    <ul className="select-none">
      {goals.map((goal, index) => {
        const isDragged = drag?.id === goal.id;
        // Rows between the drag's origin and destination step aside.
        let shift = 0;
        if (drag && !isDragged) {
          if (drag.from < drag.to && index > drag.from && index <= drag.to)
            shift = -drag.rowH;
          if (drag.from > drag.to && index >= drag.to && index < drag.from)
            shift = drag.rowH;
        }
        return (
          <li
            key={goal.id}
            style={{
              transform: isDragged
                ? `translateY(${drag.dy}px)`
                : shift
                  ? `translateY(${shift}px)`
                  : undefined,
            }}
            className={cn(
              "group flex items-center gap-1.5 rounded-md px-1 py-1.5 text-sm",
              !isDragged &&
                "transition-transform duration-150 ease-mac motion-reduce:transition-none",
              isDragged && "relative z-10 bg-raised shadow-lg shadow-black/30"
            )}
          >
            <button
              type="button"
              aria-label={`Reorder goal ${goal.title}. Use arrow keys to move it.`}
              onPointerDown={(e) => startDrag(e, goal.id, index)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(index, index - 1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(index, index + 1);
                }
              }}
              className={cn(
                "shrink-0 cursor-grab touch-none rounded p-0.5 text-faint hover:text-muted",
                isDragged && "cursor-grabbing text-muted"
              )}
            >
              <GripVertical className="size-3.5" aria-hidden />
            </button>

            {editingId === goal.id ? (
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => commitRename(goal.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename(goal.id);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingId(null);
                  }
                }}
                autoFocus
                maxLength={200}
                aria-label={`Rename goal ${goal.title}`}
                className="min-w-0 flex-1 rounded bg-transparent text-sm text-ink outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(goal.id);
                  setDraftTitle(goal.title);
                }}
                title="Rename goal"
                className="min-w-0 flex-1 truncate rounded text-left text-ink hover:text-primary-dim"
              >
                {goal.title}
              </button>
            )}

            <span
              className={cn(
                "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none",
                isDragged && "opacity-0"
              )}
            >
              <button
                type="button"
                aria-label={`Move ${goal.title} up`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                className="rounded p-0.5 text-faint hover:text-ink disabled:opacity-30 disabled:hover:text-faint"
              >
                <ChevronUp className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Move ${goal.title} down`}
                disabled={index === goals.length - 1}
                onClick={() => move(index, index + 1)}
                className="rounded p-0.5 text-faint hover:text-ink disabled:opacity-30 disabled:hover:text-faint"
              >
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
            </span>
            <button
              type="button"
              onClick={() => onRemove(goal.id)}
              title="Remove goal"
              aria-label={`Remove goal ${goal.title}`}
              className="shrink-0 rounded p-0.5 text-faint hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
