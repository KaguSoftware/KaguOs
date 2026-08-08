/**
 * The collapsed-sidebar preference, stored in a cookie rather than the app's
 * usual `kagu-*` localStorage (see lib/use-board-filters.ts).
 *
 * Every other UI preference here restores AFTER paint, via requestAnimationFrame,
 * because the server render has no localStorage and an earlier write would
 * mismatch hydration. That's fine for a filter chip. It is NOT fine for the
 * shell's width: the rail would render at 14rem and snap to 3.5rem one frame
 * later, on every single navigation — the exact flicker this feature exists to
 * remove. A cookie is readable in the layout (already an async server component
 * that touches cookies for Supabase), so the first paint is already correct.
 *
 * Written from the client with document.cookie — no server action, because a
 * pure display preference shouldn't cost a round-trip or a re-render.
 */
export const SIDEBAR_COOKIE = "kagu-sidebar-collapsed";

/** A year. The preference is set once and should outlive the session. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
