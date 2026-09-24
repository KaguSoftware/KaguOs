/**
 * The day the daily intro last played, as an Istanbul `YYYY-MM-DD`.
 *
 * A cookie for the same reason as lib/sidebar-pref.ts: the layout has to know
 * on the SERVER whether to render the intro, so it covers the app from the very
 * first paint. Deciding after hydration would flash the app, then cover it.
 */
export const INTRO_COOKIE = "kagu-intro-day";

/** Two days — it only ever has to outlive today. */
export const INTRO_COOKIE_MAX_AGE = 60 * 60 * 24 * 2;
