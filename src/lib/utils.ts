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
 * The company's timezone. Kagu is one office in Istanbul, so "today" is one
 * answer for everybody — it must NOT depend on where the code runs.
 */
const COMPANY_TZ = "Europe/Istanbul";

// en-CA formats as YYYY-MM-DD, which is exactly the shape every date-only
// column in this schema uses (`due_on`, `starts_on`, `ends_on`, `occurred_on`).
const companyDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: COMPANY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today as a plain `YYYY-MM-DD` in ISTANBUL — the right "today" for anything
 * compared against a date-only column.
 *
 * Use this, not `todayLocal()`, for domain dates (deadlines, sprint windows,
 * "is this overdue"). Two failure modes it closes:
 *
 *   - `new Date().toISOString().slice(0, 10)` is UTC. Istanbul is UTC+3, so
 *     between 00:00 and 03:00 local it returns YESTERDAY, and a task due today
 *     renders "Overdue" every morning.
 *   - `todayLocal()` reads the machine clock, which is only correct in a
 *     browser. On the server that's the Vercel runtime — UTC, since there's no
 *     TZ env var and the project deploys to hnd1 — so it reintroduces the exact
 *     same bug while looking like the fix.
 *
 * Intl handles DST, so this stays right across the year.
 */
export function todayInIstanbul(now: Date = new Date()) {
  return companyDateFmt.format(now);
}

/**
 * Today as a plain `YYYY-MM-DD` in the VIEWER'S timezone.
 *
 * Narrow by design: only for things that are genuinely about the person's own
 * clock (a download filename, say). For anything the whole team compares —
 * deadlines, sprint windows, overdue — use `todayInIstanbul()`, or two people
 * in different timezones will disagree about the same task.
 */
export function todayLocal(now: Date = new Date()) {
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * `YYYY-MM-DD` N days after a plain date string. Calendar-correct (month/year
 * roll). Pure string→string: the Date is only ever a calendar calculator built
 * from and read back in the same local frame, so no timezone can leak in.
 */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(y, m - 1, d + days);
  const month = `${shifted.getMonth() + 1}`.padStart(2, "0");
  const day = `${shifted.getDate()}`.padStart(2, "0");
  return `${shifted.getFullYear()}-${month}-${day}`;
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
