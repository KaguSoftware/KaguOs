"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn, formatDate } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
 */
export function DatePicker({
  name,
  id,
  defaultValue = "",
  placeholder = "Pick a date…",
  onChange,
  className,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Notified with the ISO date ("" when cleared); FormData still works as before. */
  onChange?: (iso: string) => void;
  className?: string;
}) {
  const [value, setRawValue] = useState(defaultValue);
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
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 text-left text-sm transition-colors duration-150 hover:border-line-strong",
          value ? "text-ink" : "text-muted"
        )}
      >
        <span className="truncate">{value ? formatDate(value) : placeholder}</span>
        <span className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
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
          aria-label="Calendar"
          className={cn(
            "absolute z-10 w-64 animate-pop-in rounded-md border border-line bg-raised/90 p-3 shadow-lg shadow-black/40 backdrop-blur-md",
            side === "top"
              ? "bottom-full mb-1 origin-bottom"
              : "top-full mt-1 origin-top"
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-medium text-ink">
              {MONTHS[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 text-[11px] font-medium text-faint">
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
                    "mx-auto flex size-7 items-center justify-center rounded-md text-[13px] transition-colors duration-150",
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
              className="rounded-md px-2 py-1 text-[13px] text-primary-dim transition-colors duration-150 hover:bg-surface"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setValue("")}
              className="rounded-md px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
