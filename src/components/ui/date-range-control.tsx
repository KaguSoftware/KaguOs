"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Segmented } from "@/components/ui/segmented";
import { addDays, cn, type DateRange } from "@/lib/utils";

/**
 * Presets first, calendar second.
 *
 * Nobody wants to fight a calendar grid for "last 30 days", and nobody wants to
 * be denied 3 Feb – 19 Apr because the presets didn't imagine it — so both are
 * in one row, and touching either end of the range flips the control to
 * "Custom" rather than silently disagreeing with the highlighted preset.
 */
export type RangePreset = "mtd" | "30d" | "qtd" | "ytd" | "custom";

const PRESETS: readonly { key: RangePreset; label: string; short: string }[] = [
  { key: "mtd", label: "This month", short: "Month" },
  { key: "30d", label: "Last 30 days", short: "30 days" },
  { key: "qtd", label: "This quarter", short: "Quarter" },
  { key: "ytd", label: "Year to date", short: "YTD" },
  { key: "custom", label: "Custom range", short: "Custom" },
];

// All string→string, like `addDays`/`addMonths` in lib/utils: a plain
// `YYYY-MM-DD` never gets turned into a Date, so no timezone can leak in.
function monthStart(day: string) {
  return `${day.slice(0, 7)}-01`;
}

function quarterStart(day: string) {
  const month = Number(day.slice(5, 7));
  const first = Math.floor((month - 1) / 3) * 3 + 1;
  return `${day.slice(0, 4)}-${String(first).padStart(2, "0")}-01`;
}

function yearStart(day: string) {
  return `${day.slice(0, 4)}-01-01`;
}

/**
 * The window a preset means, ending on `today`. Null for "custom", which by
 * definition keeps whatever dates are already on screen.
 *
 * Exported because the parent needs the same answer for its initial state — one
 * pure function called twice, rather than a mount effect that makes the page
 * render once with the wrong range and then correct itself.
 */
export function rangeForPreset(preset: RangePreset, today: string): DateRange | null {
  switch (preset) {
    case "mtd":
      return { from: monthStart(today), to: today };
    case "30d":
      // 29, not 30: the window is inclusive at both ends, so "last 30 days"
      // is today plus the 29 before it.
      return { from: addDays(today, -29), to: today };
    case "qtd":
      return { from: quarterStart(today), to: today };
    case "ytd":
      return { from: yearStart(today), to: today };
    case "custom":
      return null;
  }
}

export function DateRangeControl({
  today,
  defaultPreset = "mtd",
  onChange,
  className,
}: {
  /**
   * "Today" as a plain `YYYY-MM-DD`, passed in rather than read here.
   *
   * The company clock is Istanbul's (`todayInIstanbul`), and the server already
   * knows it — computing it again on the client would put a second answer in
   * play and mismatch hydration for anyone loading the page across midnight.
   */
  today: string;
  defaultPreset?: RangePreset;
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const [preset, setPreset] = useState<RangePreset>(defaultPreset);
  const [range, setRange] = useState<DateRange>(
    () => rangeForPreset(defaultPreset, today) ?? { from: monthStart(today), to: today }
  );

  function commit(next: DateRange, nextPreset: RangePreset) {
    // A backwards range is a slip — someone moved the end they weren't thinking
    // about — so swap it instead of reporting a window that matches nothing.
    const ordered = next.from > next.to ? { from: next.to, to: next.from } : next;
    setRange(ordered);
    setPreset(nextPreset);
    onChange(ordered);
  }

  function choosePreset(next: RangePreset) {
    // "Custom" has no window of its own — it keeps the dates already on screen.
    commit(rangeForPreset(next, today) ?? range, next);
  }

  // An empty string is the picker's "clear" — there is no such thing as a
  // half-open range here, so keep the end that was already set.
  function moveEnd(end: "from" | "to", iso: string) {
    if (!iso) return;
    commit({ ...range, [end]: iso }, "custom");
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <Segmented
        label="Date range preset"
        size="sm"
        options={PRESETS}
        value={preset}
        onChange={choosePreset}
      />
      <div
        role="group"
        aria-label="Custom date range"
        className="flex items-center gap-2 text-[calc(12px*var(--text-scale,1))] text-faint"
      >
        <DatePicker
          name="range-from"
          ariaLabel="Range start"
          value={range.from}
          onChange={(iso) => moveEnd("from", iso)}
          className="w-36"
        />
        <span aria-hidden>to</span>
        <DatePicker
          name="range-to"
          ariaLabel="Range end"
          value={range.to}
          onChange={(iso) => moveEnd("to", iso)}
          className="w-36"
        />
      </div>
    </div>
  );
}
