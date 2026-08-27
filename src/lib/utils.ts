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
  sm: "h-7 gap-1.5 rounded-md px-2.5 text-[calc(13px*var(--text-scale,1))]",
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

const relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * The same date in the portal's language, and the head of the `*In` family:
 * `formatRelativeIn` sits just below, `formatMoneyIn` beside `formatMoney`.
 * The client portal calls those three; `formatDate`, `formatRelative` and
 * `formatMoney` stay English for the team's own `(app)` pages.
 *
 * `formatDate` is deliberately fixed to en-GB for the team's own pages, where
 * everyone reads English. The client portal renders Arabic sentences, and an
 * English month name dropped into one ("اكتملت 3 Sep 2026") reads as a bug.
 * Western digits are kept in both — they are what Touch's own bills use, and
 * mixing numbering systems between the date and the percentages beside it is
 * worse than either alone, which is why every `*In` helper passes
 * `numberingSystem: "latn"` rather than taking the locale's default.
 */
const localeDateFmts: Record<"en" | "ar", Intl.DateTimeFormat> = {
  en: dateFmt,
  ar: new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "short",
    year: "numeric",
    numberingSystem: "latn",
  }),
};

export function formatDateIn(
  locale: "en" | "ar",
  value: string | Date | null | undefined
) {
  if (!value) return "—";
  return localeDateFmts[locale].format(
    typeof value === "string" ? new Date(value) : value
  );
}

// `ar-u-nu-latn`, not a `numberingSystem` option: TypeScript's
// `RelativeTimeFormatOptions` has no such field (unlike the DateTimeFormat one
// above), and the `-u-nu-` locale extension is the standard equivalent. Left
// to its default, `ar` formats "قبل ٣ أيام" in Arabic-Indic digits.
const localeRelFmts: Record<"en" | "ar", Intl.RelativeTimeFormat> = {
  en: relFmt,
  ar: new Intl.RelativeTimeFormat("ar-u-nu-latn", { numeric: "auto" }),
};

/**
 * Compact relative time in the portal's language ("3h ago", "قبل 3 أيام").
 *
 * `justNow` is a PARAMETER, not a lookup: `Intl.RelativeTimeFormat` has no
 * branch for "under a minute", and this module must not import the portal's
 * dictionary — `(app)` imports it from a dozen places and would pull the whole
 * dictionary in behind it. Callers in the portal pass `t.justNow`.
 *
 * `formatRelative` below delegates here so the unit thresholds cannot drift
 * apart from the English ones.
 */
export function formatRelativeIn(
  locale: "en" | "ar",
  value: string | Date,
  justNow: string,
  now: Date = new Date()
) {
  const fmt = localeRelFmts[locale];
  const then = typeof value === "string" ? new Date(value) : value;
  const diffMs = then.getTime() - now.getTime();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return justNow;
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return fmt.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return fmt.format(hr, "hour");
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 30) return fmt.format(day, "day");
  const mon = Math.round(day / 30);
  if (Math.abs(mon) < 12) return fmt.format(mon, "month");
  return fmt.format(Math.round(mon / 12), "year");
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

/**
 * `YYYY-MM-DD` N months after a plain date string, clamped to the end of the
 * month it lands in.
 *
 * The clamp is the whole reason this exists. A payment plan starting on the
 * 31st stepped by native Date arithmetic gives 31 Jan → 3 Mar, which puts a
 * client's February payment in March and then never returns to the 31st again.
 * Clamped, the schedule reads 31 Jan, 28 Feb, 31 Mar — which is what both sides
 * mean by "monthly" and what every bank does.
 *
 * Pure string→string like `addDays`, so no timezone can leak in.
 */
export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = `${Math.min(d, lastDay)}`.padStart(2, "0");
  const month = `${target.getMonth() + 1}`.padStart(2, "0");
  return `${target.getFullYear()}-${month}-${day}`;
}

/**
 * An inclusive span of plain `YYYY-MM-DD` dates — both ends counted.
 *
 * Deliberately strings, not Dates: every date-only column in this schema is a
 * plain calendar day, and `from <= day && day <= to` on `YYYY-MM-DD` strings is
 * both correct and timezone-proof, which `new Date(...)` comparisons are not.
 */
export type DateRange = { from: string; to: string };

/**
 * Compact relative time ("3h ago", "2d ago"). Snapshot at render time.
 *
 * English by design — this is what the `(app)` shell calls. It is the `"en"`
 * case of `formatRelativeIn` with the English "just now" filled in, rather
 * than a second copy of the same thresholds that could quietly diverge.
 */
export function formatRelative(value: string | Date, now: Date = new Date()) {
  return formatRelativeIn("en", value, "just now", now);
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

// One formatter per locale+currency pair, kept for the life of the process.
// `formatMoney` builds a fresh `Intl.NumberFormat` on every call, which the
// invoice table would pay for once per row; the portal's tables are long
// enough that it is worth not repeating that here.
const moneyFmts = new Map<string, Intl.NumberFormat>();

/**
 * The same figure in the portal's language. `formatMoney` stays en-US for
 * `(app)`.
 *
 * The `ar` locale tag lets Intl place the currency the way Arabic does, but
 * the digits stay Latin: they are what Touch's own bills, the invoice PDF and
 * the wire confirmation all carry, and the Amount column is set in Geist Mono,
 * which has no Arabic-Indic digit glyphs — those digits would fall back to a
 * proportional face and destroy the alignment that makes the column scannable.
 */
export function formatMoneyIn(
  locale: "en" | "ar",
  amount: number,
  currency: string
) {
  const key = `${locale}:${currency}`;
  let fmt = moneyFmts.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale === "ar" ? "ar" : "en-US", {
      style: "currency",
      currency,
      numberingSystem: "latn",
      maximumFractionDigits: 2,
    });
    moneyFmts.set(key, fmt);
  }
  return fmt.format(amount);
}

/**
 * Isolate a formatted run — a date, a money figure, a staff-typed title — so
 * the bidi algorithm cannot reorder it, or the neutral characters around it,
 * when it is interpolated into an Arabic sentence. Without this a `·`, `/` or
 * `—` sitting between an Arabic word and a Latin run takes the paragraph
 * direction and lands on the wrong side, so the figure reads as corrupted
 * rather than as a bidi artefact.
 *
 * U+2068 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE rather than
 * `<bdi>`, because the dictionary's interpolated strings are FUNCTIONS that
 * return strings, not JSX — there is no element to wrap. Use `<bdi>` at the
 * JSX call sites where you can, and this where you cannot. Both characters are
 * invisible and inert in an LTR paragraph, so passing a value through this on
 * the English side costs nothing.
 */
export function isolate(value: string) {
  return `\u2068${value}\u2069`;
}
