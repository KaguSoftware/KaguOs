import type { Section } from "@/lib/types";

/**
 * Section accents — the colour of a PLACE.
 *
 * The values live in globals.css as `--sec-*` custom properties; this module
 * only knows their names. That's deliberate: a hex here and a hex there is how
 * two surfaces drift apart, and the CSS variable is reachable from stylesheets
 * and inline styles alike, which a TS constant is not.
 *
 * The keyspace is the NAV, not `Section`. Dashboard and Admin are tabs with no
 * section behind them, and the `chat` section is called Messages in the nav —
 * so `Record<Section, …>` would be both short two entries and wrong on one.
 */
export const ACCENT_KEYS = [
  "dashboard",
  "work",
  "learn",
  "management",
  "debug",
  "messages",
  "marketing",
  "comms",
  "admin",
] as const;

export type AccentKey = (typeof ACCENT_KEYS)[number];

/** `var(--sec-work)`, ready to drop into a style or a color-mix(). */
export function accentVar(key: AccentKey): string {
  return `var(--sec-${key})`;
}

/**
 * A tint of an accent, for fills and borders. Percentages stay in the callers'
 * hands — a selected tab and a page rule want very different weights — but the
 * colour-space choice belongs in one place.
 */
export function accentMix(key: AccentKey, percent: number): string {
  return `color-mix(in srgb, ${accentVar(key)} ${percent}%, transparent)`;
}

/** The accent of whatever page you're on. Set by SectionAccentScope. */
export const CURRENT_ACCENT = "var(--section-accent)";

export function currentAccentMix(percent: number): string {
  return `color-mix(in srgb, ${CURRENT_ACCENT} ${percent}%, transparent)`;
}

/**
 * Sections that ARE a nav tab. `status` is a feature gate (presence dots, the
 * status editor) with no destination of its own, so it maps to nothing rather
 * than borrowing a colour it would then share with a real tab.
 */
const BY_SECTION: Record<Section, AccentKey | null> = {
  work: "work",
  learn: "learn",
  management: "management",
  debug: "debug",
  marketing: "marketing",
  comms: "comms",
  chat: "messages",
  status: null,
};

export function accentForSection(section: Section): AccentKey | null {
  return BY_SECTION[section];
}

/**
 * Route → accent. Ordered longest-first so `/management/finance` can't be
 * decided by a shorter prefix, and matched on a path BOUNDARY so a future
 * `/workshop` never inherits Work's colour.
 *
 * Kept in step with NAV in components/shell/sidebar.tsx — same hrefs, same
 * keys. The nav can't own this because the portal and the page header need the
 * answer without rendering a sidebar.
 */
const BY_PREFIX: [string, AccentKey][] = [
  ["/management", "management"],
  ["/marketing", "marketing"],
  ["/messages", "messages"],
  ["/learn", "learn"],
  ["/debug", "debug"],
  ["/comms", "comms"],
  ["/admin", "admin"],
  ["/work", "work"],
];

/**
 * Returns null for routes that belong to no section — /account, /login — so
 * their headers stay on the neutral fallback instead of inheriting whichever
 * colour happened to be last.
 */
export function accentForPath(pathname: string): AccentKey | null {
  if (pathname === "/") return "dashboard";
  for (const [prefix, key] of BY_PREFIX) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return key;
  }
  return null;
}
