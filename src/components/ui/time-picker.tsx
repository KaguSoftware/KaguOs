"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** "HH:MM" (24h) → true when it's a valid wall-clock time. */
function isValidHHMM(v: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// 5-minute granularity — enough for "back at 3:15", short enough to scan.
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/**
 * KaguOs custom time picker — button + pop-in popover with hour and minute
 * columns, matching the Dropdown/DatePicker family. No native <input type=time>
 * (Parsa rule: every control is custom + typed). Value is "HH:MM" (24h) or "".
 */
export function TimePicker({
  value,
  onChange,
  id,
  placeholder = "Set time…",
  ariaLabel = "Pick a time",
  className,
  clearable = true,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  clearable?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLUListElement>(null);
  const minuteColRef = useRef<HTMLUListElement>(null);

  const [hh, mm] = useMemo(() => {
    if (isValidHHMM(value)) return value.split(":");
    return ["", ""];
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Scroll the current hour/minute into view when the popover opens.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      hourColRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: "center" });
      minuteColRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: "center" });
    });
  }, [open]);

  // Pick an hour or minute; fill the other half with a sane default (00) so a
  // single tap always yields a complete, valid time.
  function pickHour(h: string) {
    onChange(`${h}:${mm || "00"}`);
  }
  function pickMinute(m: string) {
    onChange(`${hh || "00"}:${m}`);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 text-left text-sm transition-colors duration-150",
          "hover:border-line-strong disabled:pointer-events-none disabled:opacity-50",
          value ? "text-ink" : "text-muted"
        )}
      >
        <span className="flex items-center gap-2">
          <Clock className="size-3.5 shrink-0 text-faint" aria-hidden />
          <span className="truncate tabular-nums">{value || placeholder}</span>
        </span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear time"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 text-faint transition-colors duration-150 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute z-20 mt-1 flex origin-top animate-pop-in gap-1 overflow-hidden rounded-md border border-line bg-raised/90 p-1 shadow-lg shadow-black/40 backdrop-blur-md"
        >
          <ul
            ref={hourColRef}
            aria-label="Hour"
            className="scrollbar-none max-h-48 w-14 overflow-y-auto"
          >
            {HOURS.map((h) => {
              const sel = h === hh;
              return (
                <li key={h} data-selected={sel}>
                  <button
                    type="button"
                    onClick={() => pickHour(h)}
                    className={cn(
                      "w-full rounded px-2 py-1.5 text-center text-sm tabular-nums transition-colors duration-150",
                      sel
                        ? "bg-primary/15 font-medium text-ink"
                        : "text-muted hover:bg-surface hover:text-ink"
                    )}
                  >
                    {h}
                  </button>
                </li>
              );
            })}
          </ul>
          <span className="self-stretch border-l border-line" aria-hidden />
          <ul
            ref={minuteColRef}
            aria-label="Minute"
            className="scrollbar-none max-h-48 w-14 overflow-y-auto"
          >
            {MINUTES.map((m) => {
              const sel = m === mm;
              return (
                <li key={m} data-selected={sel}>
                  <button
                    type="button"
                    onClick={() => pickMinute(m)}
                    className={cn(
                      "w-full rounded px-2 py-1.5 text-center text-sm tabular-nums transition-colors duration-150",
                      sel
                        ? "bg-primary/15 font-medium text-ink"
                        : "text-muted hover:bg-surface hover:text-ink"
                    )}
                  >
                    {m}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
