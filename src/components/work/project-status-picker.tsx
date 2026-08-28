"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { setProjectStatus } from "@/lib/actions/work";
import { useAction } from "@/lib/use-action";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/types";

/**
 * The status pill IS the control (see Badge): clicking the word opens a short
 * listbox of the four statuses. A project's status is the one field the team
 * changes most and the only one worth a trip to the edit form on its own, so
 * the table edits it in place — the pill you read and the pill you press are
 * the same pixel.
 *
 * Optimistic: the pill flips on click and rolls back if the server refuses
 * (read-only mode, RLS), which `useAction` surfaces as an error toast.
 */
export function ProjectStatusPicker({
  projectId,
  status,
  statuses,
  tones,
}: {
  projectId: string;
  status: ProjectStatus;
  statuses: ProjectStatus[];
  tones: Record<ProjectStatus, BadgeTone>;
}) {
  const [open, setOpen] = useState(false);
  // What the pill shows. Tracks the prop until a click, then leads it until the
  // revalidated row arrives (or a failure rolls it back).
  const [shown, setShown] = useState(status);
  const [active, setActive] = useState(() => statuses.indexOf(status));
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const side = usePopoverSide(rootRef, open, 160);
  const { pending, run } = useAction();

  // The server row is the truth: once revalidation lands, drop the optimistic
  // value. Done during render (no effect) so the pill never paints stale.
  const [seen, setSeen] = useState(status);
  if (seen !== status) {
    setSeen(status);
    setShown(status);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function openMenu(next: boolean) {
    if (next) setActive(Math.max(0, statuses.indexOf(shown)));
    setOpen(next);
  }

  function select(next: ProjectStatus) {
    setOpen(false);
    if (next === shown) return;
    const previous = shown;
    run(() => setProjectStatus(projectId, next), {
      optimistic: () => setShown(next),
      rollback: () => setShown(previous),
    });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) {
          const next = statuses[active];
          if (next) select(next);
        } else {
          openMenu(true);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!open) openMenu(true);
        else setActive((i) => Math.min(statuses.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) setActive((i) => Math.max(0, i - 1));
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block" onKeyDown={onKeyDown}>
      <Badge
        tone={tones[shown]}
        onClick={() => openMenu(!open)}
        disabled={pending}
        title="Change status"
        className={cn("cursor-pointer", open && "brightness-125")}
      >
        {shown}
      </Badge>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-20 w-32 animate-pop-in overflow-hidden rounded-md border border-line bg-raised/90 shadow-lg shadow-black/40 backdrop-blur-md",
            side === "top" ? "bottom-full mb-1 origin-bottom" : "top-full mt-1 origin-top"
          )}
        >
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Project status"
            aria-activedescendant={
              statuses[active] ? `${listboxId}-${active}` : undefined
            }
            className="max-h-44 overflow-y-auto py-1"
          >
            {statuses.map((option, index) => {
              const isSelected = option === shown;
              return (
                <li
                  key={option}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm",
                    index === active ? "bg-surface text-ink" : "text-muted"
                  )}
                >
                  {option}
                  <Check
                    className={cn(
                      "size-3.5 shrink-0 text-primary-dim",
                      !isSelected && "invisible"
                    )}
                    aria-hidden
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
