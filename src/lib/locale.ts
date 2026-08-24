/**
 * The portal's language preference — one cookie, `kagu-locale`, that decides
 * which half of every bilingual string the client sees and which way the page
 * runs.
 *
 * ── Why this replaced "both languages, always" ──────────────────────────────
 *
 * The pack shipped with the English and the Arabic stacked on top of each other
 * everywhere, on the reasoning that the person filling it in and the person
 * reading the answers don't share a first language. That reasoning was right
 * about the PROBLEM and wrong about the fix: it doubled the length of a form
 * that was already nine sections long, and it made every label a two-line block
 * in which neither language could be scanned. Nobody reads both.
 *
 * A per-viewer toggle solves the same problem better, because the preference is
 * per PERSON, not per document: the client reads Arabic, the producer in
 * Istanbul reads English, and each of them sees a page written in one language.
 * Nobody is ever on the wrong page, which was the original objection.
 *
 * ── A COOKIE, read server-side, for the same reason as the text scale ───────
 *
 * `lib/text-size.ts` explains it in full: a preference restored after paint
 * flickers on every navigation. Language is worse than size — the whole page
 * would render in English and reflow into Arabic a frame later, running the
 * other direction. The layout reads the cookie server-side so the first paint
 * is already correct, in the right language and the right direction.
 *
 * ⚠️ Only the client portal ever WRITES this cookie. `(app)` never offers the
 * toggle, so a teammate's app stays English and left-to-right no matter what.
 * The admin-side review of the same pack has its own, separate preference —
 * see `lib/intake-lang.ts` — precisely so that an admin reading a client's
 * Arabic answers does not flip the entire internal tool into RTL.
 */
export const LOCALE_COOKIE = "kagu-locale";

/** A year, like the text-scale and sidebar cookies. Set once, outlives the session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALES = [
  { key: "en", label: "English", short: "EN", dir: "ltr" },
  { key: "ar", label: "العربية", short: "ع", dir: "rtl" },
] as const;

export type Locale = (typeof LOCALES)[number]["key"];

/**
 * English, not Arabic, because a client account is created by Kagu and handed
 * over — the first screen has to be readable by whoever set it up, and the
 * toggle is the first thing in the header.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * A cookie value is attacker-controlled text, and this one ends up in a `dir`
 * and a `lang` attribute. Narrowing it here means only the two known keys can
 * ever reach the document.
 */
export function parseLocale(value: string | undefined): Locale {
  return LOCALES.some((l) => l.key === value) ? (value as Locale) : DEFAULT_LOCALE;
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Pick the right half of a bilingual pack string.
 *
 * Falls back to the English whenever the Arabic is missing rather than
 * rendering an empty label — the `general` pack has no Arabic at all, and a
 * client switched to Arabic on that pack must still get a usable form rather
 * than a page of blank labels.
 */
export function pick(locale: Locale, en: string, ar?: string): string {
  return locale === "ar" && ar ? ar : en;
}

/**
 * True when the string being rendered came back as Arabic, so the caller can
 * mark it `lang="ar"`. Not the same question as `locale === "ar"`: on the
 * general pack an Arabic-locale client still reads English labels, and tagging
 * those `lang="ar"` would make a screen reader pronounce English with Arabic
 * phonemes.
 */
export function isArabicText(locale: Locale, ar?: string): boolean {
  return locale === "ar" && Boolean(ar);
}
