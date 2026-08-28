"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn, formatDateIn } from "@/lib/utils";

/** The picker's own words. Every `(app)` form gets these and passes nothing. */
export type DatePickerLabels = {
  placeholder: string;
  clearDate: string;
  calendar: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  clear: string;
};

/** The app's own two-letter column heads, Monday-first. See `weekdays` below. */
const EN_WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const EN_LABELS: DatePickerLabels = {
  placeholder: "Pick a date…",
  clearDate: "Clear date",
  calendar: "Calendar",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  today: "Today",
  clear: "Clear",
};

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayISO() {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * KaguOs custom calendar date picker (Monday-first). Carries an ISO date
 * through a hidden input so plain FormData forms work.
 *
 * Shared with seventeen `(app)` forms that are English-only and never read a
 * locale cookie, so `locale` and `labels` are both optional and default to
 * exactly the English this shipped with.
 */
export function DatePicker({
  name,
  id,
  value: controlledValue,
  defaultValue = "",
  placeholder,
  ariaLabel,
  onChange,
  className,
  locale = "en",
  labels = EN_LABELS,
}: {
  name: string;
  id?: string;
  /**
   * Makes the field controlled: the date shown is this one, and the parent is
   * responsible for pushing the next one back through `onChange`. Leave it off
   * for the ordinary form case, where the field owns its own value.
   *
   * The escape hatch a range picker needs — picking a "This month" preset has
   * to move BOTH ends of the range at once, which an uncontrolled field would
   * quietly ignore.
   */
  value?: string;
  defaultValue?: string;
  /** Overrides `labels.placeholder` where a form wants its own wording ("No deadline"). */
  placeholder?: string;
  /** Names the field when the trigger has no associated <label> — a <button> is
   *  not a labelable element, so `htmlFor` cannot reach it. */
  ariaLabel?: string;
  /** Notified with the ISO date ("" when cleared); FormData still works as before. */
  onChange?: (iso: string) => void;
  className?: string;
  locale?: "en" | "ar";
  labels?: DatePickerLabels;
}) {
  const [uncontrolled, setRawValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolled;
  function setValue(iso: string) {
    setRawValue(iso);
    onChange?.(iso);
  }
  const [open, setOpen] = useState(false);
  const initial = value || todayISO();
  const [viewYear, setViewYear] = useState(() => Number(initial.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(initial.slice(5, 7)) - 1);
  const rootRef = useRef<HTMLDivElement>(null);
  // The calendar is ~320px tall; flip it above the field when the field sits
  // too close to the bottom of the window.
  const side = usePopoverSide(rootRef, open, 320);

  // Month and weekday names come from Intl, not from the dictionary, so the
  // calendar header can never disagree with the date `formatDateIn` writes
  // back into the trigger — both read the same locale data.
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) =>
        new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2021, m, 1))
      ),
    [locale]
  );
  // 2021-03-01 was a Monday, so probing seven days from it matches the
  // Monday-first grid below.
  //
  // The English header is NOT derived. Intl's `short` for en is "Mon Tue Wed",
  // and swapping the app's own two-letter set for it would widen the column
  // heads in all seventeen `(app)` forms — a visible change to a shell that is
  // supposed to be untouched by any of this.
  //
  // Arabic takes `narrow` rather than `short` for the same reason in the other
  // direction: `short` returns the full names (الاثنين، الثلاثاء), which are
  // four to seven characters and burst a seven-column grid sized for two.
  const weekdays = useMemo(
    () =>
      locale === "en"
        ? EN_WEEKDAYS
        : Array.from({ length: 7 }, (_, i) =>
            new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
              new Date(2021, 2, 1 + i)
            )
          ),
    [locale]
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openCalendar() {
    // Re-read on every open, which is all a controlled value needs: the
    // outside-pointerdown handler above closes the calendar the moment focus
    // leaves this field, so nothing can move `value` while the grid is up.
    const base = value || todayISO();
    setViewYear(Number(base.slice(0, 4)));
    setViewMonth(Number(base.slice(5, 7)) - 1);
    setOpen((v) => !v);
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  // Monday-first offset of the 1st, then a 6-week grid.
  const firstOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const cells: { iso: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(viewYear, viewMonth, 1 - firstOffset + i);
    cells.push({
      iso: toISO(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === viewMonth,
    });
  }
  const today = todayISO();

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        id={id}
        onClick={openCalendar}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 text-start text-sm transition-colors duration-150 hover:border-line-strong",
          value ? "text-ink" : "text-muted"
        )}
      >
        <span className="truncate">
          {value ? formatDateIn(locale, value) : (placeholder ?? labels.placeholder)}
        </span>
        <span className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label={labels.clearDate}
              onClick={(event) => {
                event.stopPropagation();
                setValue("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.stopPropagation();
                  setValue("");
                }
              }}
              className="rounded p-0.5 text-faint hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </span>
          )}
          <CalendarDays className="size-4 shrink-0 text-faint" aria-hidden />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={labels.calendar}
          className={cn(
            "absolute z-10 w-[min(16rem,calc(100vw-2rem))] animate-pop-in rounded-md border border-line bg-raised/90 p-3 shadow-lg shadow-black/40 backdrop-blur-md",
            side === "top"
              ? "bottom-full mb-1 origin-bottom"
              : "top-full mt-1 origin-top"
          )}
        >
          {/* Under dir="rtl" the row reverses, so the two buttons swap sides
              while their glyphs would keep pointing the old way — hence
              `rtl:rotate-180` on both chevrons. */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={labels.prevMonth}
              className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </button>
            <p className="text-sm font-medium text-ink">
              {months[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={labels.nextMonth}
              className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {weekdays.map((day, index) => (
              // Keyed by index, not by the string: the column is identified by
              // its position in the week, and a translated abbreviation is not
              // guaranteed to be unique across every locale.
              <span
                key={index}
                className="py-1 text-[calc(11px*var(--text-scale,1))] font-medium text-faint"
              >
                {day}
              </span>
            ))}
            {cells.map((cell) => {
              const isSelected = cell.iso === value;
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    setValue(cell.iso);
                    setOpen(false);
                  }}
                  aria-label={cell.iso}
                  aria-pressed={isSelected}
                  className={cn(
                    "mx-auto flex size-7 items-center justify-center rounded-md text-[calc(13px*var(--text-scale,1))] transition-colors duration-150",
                    isSelected
                      ? "bg-primary font-medium text-primary-ink"
                      : cn(
                          cell.inMonth ? "text-ink" : "text-faint/60",
                          "hover:bg-surface",
                          isToday && "border border-primary/40"
                        )
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                setValue(today);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-[calc(13px*var(--text-scale,1))] text-primary-dim transition-colors duration-150 hover:bg-surface"
            >
              {labels.today}
            </button>
            <button
              type="button"
              onClick={() => setValue("")}
              className="rounded-md px-2 py-1 text-[calc(13px*var(--text-scale,1))] text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              {labels.clear}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
