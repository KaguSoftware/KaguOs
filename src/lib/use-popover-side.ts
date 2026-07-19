"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Which way a popover should open: down by default, up when there isn't room.
 *
 * Every popover in the app used to open downward unconditionally. On the LAST
 * row of a long list that puts the menu below the fold, so picking a value
 * meant scrolling after each click — the reason editing the bottom task on the
 * debug board was so tedious (Parsa, 2026-07-19).
 *
 * Measured in a layout effect, before paint, so the popover never renders in
 * the wrong place and jumps. `estimatedHeight` is used instead of the real
 * height because on the first pass the content hasn't been laid out yet; the
 * menus in this app are all capped (max-h-56 lists, a fixed-size calendar), so
 * a constant is both sufficient and stable.
 */
export function usePopoverSide(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  estimatedHeight = 260
): "top" | "bottom" {
  const [side, setSide] = useState<"top" | "bottom">("bottom");

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    // Only flip when below genuinely can't hold it AND above is roomier —
    // otherwise a cramped viewport would flip-flop on every open.
    setSide(below < estimatedHeight && above > below ? "top" : "bottom");
  }, [open, triggerRef, estimatedHeight]);

  return side;
}
