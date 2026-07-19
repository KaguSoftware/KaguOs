import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-ink font-medium hover:bg-primary-dim active:bg-primary-dim",
  outline: "border border-line-strong text-ink hover:bg-raised active:bg-raised",
  ghost: "text-muted hover:text-ink hover:bg-raised",
  danger:
    "border border-danger/40 text-danger hover:bg-danger/15 active:bg-danger/15",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 rounded-md px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-md px-3.5 text-sm",
};

export function buttonClasses(
  variant: ButtonVariant = "outline",
  size: ButtonSize = "md",
  className?: string
) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap",
    "transition-[color,background-color,border-color,transform] duration-150 ease-mac active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    className
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * Today as a plain `YYYY-MM-DD` in the VIEWER'S timezone.
 *
 * Deliberately not `new Date().toISOString().slice(0, 10)` — that's UTC, and
 * Istanbul is UTC+3, so between 00:00 and 03:00 local it returns yesterday.
 * Anything comparing against a date-only column (`due_on`) would then call a
 * task due today "overdue" every morning. Compared as strings, both sides being
 * plain dates, so there's no time-of-day or offset arithmetic anywhere.
 */
export function todayLocal(now: Date = new Date()) {
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `YYYY-MM-DD` N days after a plain date string. Calendar-correct (month/year roll). */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return todayLocal(new Date(y, m - 1, d + days));
}

const relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Compact relative time ("3h ago", "2d ago"). Snapshot at render time. */
export function formatRelative(value: string | Date, now: Date = new Date()) {
  const then = typeof value === "string" ? new Date(value) : value;
  const diffMs = then.getTime() - now.getTime();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return "just now";
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return relFmt.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return relFmt.format(hr, "hour");
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 30) return relFmt.format(day, "day");
  const mon = Math.round(day / 30);
  if (Math.abs(mon) < 12) return relFmt.format(mon, "month");
  return relFmt.format(Math.round(mon / 12), "year");
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
