/**
 * The text-size preference: one multiplier, `--text-scale`, that every
 * font-size in the app is written as a fraction of. Set it once and the whole
 * interface resizes — the ramp in globals.css and the in-between sizes spelled
 * `text-[calc(13px*var(--text-scale,1))]` all read from it.
 *
 * A COOKIE, not localStorage, for exactly the reason the collapsed sidebar is
 * one (see lib/sidebar-pref.ts): the app's other device preferences restore
 * after paint, which is fine for a filter chip and unacceptable here. Every
 * word on the page would render at 15px and reflow one frame later, on every
 * navigation — a worse flicker than the one this setting exists to fix, and
 * aimed at the people least able to tolerate it. The layout reads the cookie
 * server-side, so the first paint is already the right size.
 *
 * PER DEVICE, and the panel says so. Like the chat alerts (components/account/
 * alerts-form.tsx), this is a fact about a screen rather than about a person:
 * the size that fixes a 27" monitor at arm's length is not the size that fixes
 * a laptop on a train, and syncing them would mean fixing one breaks the other.
 */
export const TEXT_SIZE_COOKIE = "kagu-text-scale";

/** A year, like the sidebar's — set once, and it should outlive the session. */
export const TEXT_SIZE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Four steps, not a slider. A slider invites hunting for a perfect value and
 * lands people on 1.03; four named sizes are a decision you make once.
 *
 * The ceiling is 1.25 rather than something more generous because this is a
 * dense tool — at 1.25 the busiest surfaces (the finance table, the board) are
 * tighter but still whole. Past that they start to wrap into unreadability,
 * and a setting that can break the page isn't an accessibility win. Anyone who
 * needs more than 1.25 has browser zoom, which scales the layout too; the
 * viewport export deliberately leaves pinch-zoom enabled for the same reason.
 */
export const TEXT_SIZES = [
  { key: "sm", label: "Small", scale: 0.9 },
  { key: "md", label: "Default", scale: 1 },
  { key: "lg", label: "Large", scale: 1.1 },
  { key: "xl", label: "Largest", scale: 1.25 },
] as const;

export type TextSizeKey = (typeof TEXT_SIZES)[number]["key"];

export const DEFAULT_TEXT_SIZE: TextSizeKey = "md";

/**
 * A cookie value is attacker-controlled text, and this one ends up inside a
 * `<style>` tag. Narrowing it to a known key here means the only thing that
 * can ever reach that tag is one of the four numbers above.
 */
export function parseTextSize(value: string | undefined): TextSizeKey {
  return TEXT_SIZES.some((s) => s.key === value)
    ? (value as TextSizeKey)
    : DEFAULT_TEXT_SIZE;
}

export function textScale(key: TextSizeKey): number {
  return TEXT_SIZES.find((s) => s.key === key)?.scale ?? 1;
}

/**
 * The rule the app layout renders. On :root rather than on a wrapper, because
 * the menus, sheets and lightboxes that createPortal into document.body are
 * outside every wrapper this app has — and a dropdown that keeps rendering at
 * 15px while the page behind it grew is the exact bug this would ship with.
 */
export function textScaleCss(key: TextSizeKey) {
  return `:root{--text-scale:${textScale(key)}}`;
}
