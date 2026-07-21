"use client";

import { useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * URL-backed filter state for the debug board.
 *
 * Same doctrine as `useWorkFilters` (components/work/work-filters.tsx) — read
 * from the query string, write with `replaceState`, drop defaults so a clean
 * board has a clean link — but this one speaks ARRAYS. Every debug filter is a
 * `string[]` (multi-select: OR-within, AND-across), which is why the Work hook
 * could not simply be reused: its whole `FilterState` is single strings.
 *
 * ⚠️ Writes go through `window.history.replaceState`, NEVER `router.push`. The
 * board filters client-side over rows it already holds, so a push would add a
 * server round-trip and a re-render to something that should be instant — and
 * would also stack a history entry per keystroke in the search box.
 *
 * ⚠️ Not everything belongs here. `selectMode`, expanded rows, `showArchived`
 * and the board-tab search box are momentary interaction states; putting them
 * in the URL makes the back button replay UI fidgets instead of navigating.
 */

/** The filter values the URL round-trips. Arrays are comma-joined. */
export type BoardFilterState = {
  board: string[];
  state: string[];
  priority: string[];
  kind: string[];
  assignee: string[];
  q: string;
  sort: string;
};

/**
 * The resting state of the board. Anything equal to this is OMITTED from the
 * URL, so an untouched board reads as a bare `/debug`.
 *
 * ⚠️ `state` is the trap: its default is NOT empty (the board opens on the
 * "Active" preset), so a naive "omit when empty" would leave
 * `?s=open,in_progress` hanging on every otherwise-clean URL.
 */
export const BOARD_DEFAULTS: BoardFilterState = {
  board: ["all"],
  state: ["open", "in_progress"],
  priority: [],
  kind: [],
  assignee: [],
  q: "",
  sort: "smart",
};

/** Short query keys — these end up in shared links, so they stay terse. */
const KEYS: Record<keyof BoardFilterState, string> = {
  board: "b",
  state: "s",
  priority: "p",
  kind: "k",
  assignee: "a",
  q: "q",
  sort: "sort",
};

/** Same members, any order — filters are sets, not sequences. */
function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((v) => b.includes(v));
}

/**
 * The explicit "no filter" marker.
 *
 * ⚠️ Needed because for `state` an EMPTY array is a real, chosen value (the
 * "All" preset), not the absence of one — and its default is non-empty. Without
 * a sentinel, `?s=` would round-trip through "empty string → no value → fall
 * back to the default" and silently flip All back to Active on refresh, which
 * is a filter quietly changing what you're looking at.
 */
const NONE = "none";

function parseList(raw: string | null): string[] | null {
  if (raw === null) return null;
  if (raw === NONE) return [];
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/**
 * Read the board filters out of the current URL, falling back to the defaults.
 * Returns a fresh object each call; callers seed their state from it once.
 */
export function readBoardFilters(params: URLSearchParams): BoardFilterState {
  return {
    board: parseList(params.get(KEYS.board)) ?? BOARD_DEFAULTS.board,
    state: parseList(params.get(KEYS.state)) ?? BOARD_DEFAULTS.state,
    priority: parseList(params.get(KEYS.priority)) ?? BOARD_DEFAULTS.priority,
    kind: parseList(params.get(KEYS.kind)) ?? BOARD_DEFAULTS.kind,
    assignee: parseList(params.get(KEYS.assignee)) ?? BOARD_DEFAULTS.assignee,
    q: params.get(KEYS.q) ?? BOARD_DEFAULTS.q,
    sort: params.get(KEYS.sort) ?? BOARD_DEFAULTS.sort,
  };
}

/**
 * Mirrors the board's live filter values into the query string.
 *
 * The board keeps owning its state (presets write the real filters, and the
 * URL just reflects the result) — this hook deliberately does NOT become a
 * second source of truth, which is the same mistake the old Active/Mine/Done
 * tab strip made before it was rewritten into presets.
 */
export function useBoardFilterUrl() {
  const params = useSearchParams();
  const pathname = usePathname();
  // The last string we wrote, so an unchanged state doesn't re-write the URL
  // on every render of a board that re-renders on realtime traffic.
  const lastRef = useRef<string | null>(null);

  return useCallback(
    (next: BoardFilterState) => {
      const qs = new URLSearchParams(params.toString());
      for (const field of Object.keys(KEYS) as (keyof BoardFilterState)[]) {
        const key = KEYS[field];
        const value = next[field];
        const fallback = BOARD_DEFAULTS[field];
        const isDefault = Array.isArray(value)
          ? sameSet(value, fallback as string[])
          : value === fallback;
        if (isDefault) {
          qs.delete(key);
        } else if (Array.isArray(value) && value.length === 0) {
          // Deliberately empty, but the default is NOT empty (only `state` is
          // like this — the "All" preset). Write the sentinel so a refresh
          // keeps showing All instead of snapping back to Active.
          qs.set(key, NONE);
        } else {
          qs.set(key, Array.isArray(value) ? value.join(",") : value);
        }
      }
      const search = qs.toString();
      const url = search ? `${pathname}?${search}` : pathname;
      if (lastRef.current === url) return;
      lastRef.current = url;
      window.history.replaceState(null, "", url);
    },
    [params, pathname]
  );
}
