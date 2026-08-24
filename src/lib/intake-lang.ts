/**
 * Which language the TEAM reads a client's input pack in.
 *
 * ── Why this is not `lib/locale.ts` ─────────────────────────────────────────
 *
 * Deliberately a second, separate preference, and the separation is the whole
 * point. `kagu-locale` is the client portal's UI language and it drives `dir`
 * on the document: flipping it turns the page right-to-left. If the admin
 * review reused it, a producer clicking "Arabic" to read a client's Arabic menu
 * would flip the entire internal tool — sidebar, board, finance table — into
 * RTL, which is not what they asked for. They asked to read one document in one
 * language.
 *
 * So this cookie changes CONTENT ONLY. The `(app)` shell stays English and
 * left-to-right at all times; only the pack's labels and the client's answers
 * respond, and Arabic text still carries its own per-element `lang`/`dir` the
 * way it always did.
 *
 * ── Why "both" survives as an option ────────────────────────────────────────
 *
 * The original design showed English and Arabic stacked everywhere, on the
 * grounds that a producer checking an Arabic menu item needs the English beside
 * it to verify it. That is a real need — but only sometimes, and it was
 * costing every reader double the page length all the time. So it stays, as a
 * third choice, and stops being the default.
 */
export const INTAKE_LANG_COOKIE = "kagu-intake-lang";

/** A year, matching the app's other device preferences. */
export const INTAKE_LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const INTAKE_LANGS = [
  { key: "en", label: "English", short: "EN" },
  { key: "ar", label: "العربية", short: "ع" },
  { key: "both", label: "Both", short: "EN+ع" },
] as const;

export type IntakeLang = (typeof INTAKE_LANGS)[number]["key"];

/**
 * English, because the team reads English and the page is long. "Both" was the
 * old always-on behaviour and is one click away for anyone verifying a
 * translation.
 */
export const DEFAULT_INTAKE_LANG: IntakeLang = "en";

/** Cookie text is attacker-controlled; narrow it to the three known keys. */
export function parseIntakeLang(value: string | undefined): IntakeLang {
  return INTAKE_LANGS.some((l) => l.key === value)
    ? (value as IntakeLang)
    : DEFAULT_INTAKE_LANG;
}

/** Should the English half be rendered at all? */
export function showsEn(lang: IntakeLang): boolean {
  return lang !== "ar";
}

/**
 * Should the Arabic half be rendered? Only when it exists — the `general` pack
 * carries no Arabic, and "Arabic" on that pack must fall back to English rather
 * than render a page of blank labels.
 */
export function showsAr(lang: IntakeLang, ar?: string): boolean {
  return lang !== "en" && Boolean(ar);
}

/**
 * The single string to show when only one language is wanted. Mirrors
 * `pick()` in lib/locale.ts, including its fall back to English.
 */
export function pickIntake(lang: IntakeLang, en: string, ar?: string): string {
  return lang === "ar" && ar ? ar : en;
}
