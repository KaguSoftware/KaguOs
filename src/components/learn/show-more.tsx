"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The depth a program carries — stage briefs, what a goal actually means, the
 * proof brief, the acceptance conditions — folded away behind one small
 * control, so the page reads as a run you can scan and opens only where you
 * ask it to.
 *
 * Every one of these is optional reading by construction: the line above it
 * already says the thing, and the disclosure says it at length. That's the test
 * for whether copy belongs behind one of these rather than in the open.
 */

export type Disclosures = {
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
};

/**
 * One open-set for a whole stack of disclosures, owned ABOVE the things that
 * collapse. Stage cards unmount their bodies when closed, so a disclosure that
 * kept its own state would silently re-close every time you shut the stage
 * around it — you'd expand the same brief twice in a minute. Held here, "open"
 * survives the card, which is what makes it feel like a page that remembers
 * where you'd got to.
 */
export function useDisclosures(): Disclosures {
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  return {
    isOpen: (key) => open.has(key),
    toggle: (key) =>
      setOpen((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
  };
}

/**
 * A labelled disclosure: "More on this stage", "The brief", "Accepted when · 4".
 * The label names what's inside and, where there's a count, how much of it —
 * opening it should be a decision, not a lucky guess.
 */
export function ShowMore({
  open,
  onToggle,
  label,
  /** A count or other short meta, set in mono after the label. */
  hint,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="-mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-xs text-faint transition-colors duration-150 hover:text-muted"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3 shrink-0 transition-transform duration-200 ease-mac motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
        <span>{open ? "Less" : label}</span>
        {hint && !open && <span className="font-mono text-[calc(11px*var(--text-scale,1))]">{hint}</span>}
      </button>
      {open && <div className={cn("mt-1.5", bodyClassName)}>{children}</div>}
    </div>
  );
}

/**
 * The same control with no room for a label — a chevron beside a goal's title.
 * Used where the row itself is already a button (ticking the goal), so this
 * sits next to it rather than inside it: a button in a button is neither.
 */
export function MoreMark({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  /** Says what opens, for anyone who can't see the chevron move. */
  label: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors duration-150 hover:bg-raised/60 hover:text-muted"
    >
      <ChevronDown
        aria-hidden
        className={cn(
          "size-3 transition-transform duration-200 ease-mac motion-reduce:transition-none",
          open && "rotate-180"
        )}
      />
    </button>
  );
}
