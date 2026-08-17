// The pinboard's two vocabularies: what a note can look like, and who it can be
// addressed to. Shared by the composer and the server action so the picker and
// the validator can never drift — the action rejects exactly what the UI cannot
// offer, and both agree with the check constraint in 0066.

/**
 * Note colors — the one place in the app where color is DECORATION rather than
 * state, which DESIGN.md's restrained strategy otherwise forbids. A pinboard
 * whose notes are all the same neutral is a list, and the point of pinning a
 * note is that it catches the eye before you were looking for it.
 *
 * Values are drawn from the same validated oklch set as MEMBER_COLORS (all
 * readable on the dark surfaces), and are rendered the way member colors
 * already are elsewhere — a tinted fill and a tinted border derived with
 * color-mix, never a saturated block. That keeps eight colored notes in the
 * same register as the rest of the page instead of turning it into confetti.
 */
export type NoteColor = { key: string; label: string; css: string };

export const NOTE_COLORS: NoteColor[] = [
  { key: "amber", label: "Amber", css: "oklch(0.82 0.16 75)" },
  { key: "rose", label: "Rose", css: "oklch(0.72 0.19 15)" },
  { key: "violet", label: "Violet", css: "oklch(0.72 0.18 290)" },
  { key: "sky", label: "Sky", css: "oklch(0.76 0.13 230)" },
  { key: "emerald", label: "Emerald", css: "oklch(0.78 0.16 160)" },
  { key: "tangerine", label: "Tangerine", css: "oklch(0.75 0.18 45)" },
  { key: "cyan", label: "Cyan", css: "oklch(0.8 0.13 210)" },
  { key: "fuchsia", label: "Fuchsia", css: "oklch(0.74 0.2 325)" },
];

export const DEFAULT_NOTE_COLOR = NOTE_COLORS[0].key;

const colorByKey = new Map(NOTE_COLORS.map((c) => [c.key, c.css]));

/** Unknown keys fall back to the default rather than rendering an invisible note. */
export function noteColorCss(key: string | null | undefined): string {
  return colorByKey.get(key?.trim() ?? "") ?? colorByKey.get(DEFAULT_NOTE_COLOR)!;
}

export function isValidNoteColor(key: string): boolean {
  return colorByKey.has(key);
}

/**
 * The next color to seed the composer with, so consecutive notes don't come out
 * the same shade. Rotates from the most recently pinned note rather than
 * picking at random — random repeats, and "why are these two both amber" is a
 * question the board shouldn't provoke.
 */
export function nextNoteColor(lastUsed: string | null | undefined): string {
  const i = NOTE_COLORS.findIndex((c) => c.key === lastUsed);
  if (i < 0) return DEFAULT_NOTE_COLOR;
  return NOTE_COLORS[(i + 1) % NOTE_COLORS.length].key;
}

/**
 * Who a note is for — exactly one of four (0066).
 *
 * The four GROUP audiences partition the company rather than overlapping it,
 * which is what makes a single choice enough: `work` and `learn_only` are
 * disjoint, and together they are `everyone`. The Learn/Work split is
 * load-bearing — granting Work auto-grants Learn (0026), so every member holds
 * Learn and a plain "Kagu Learn" audience would have been a synonym for
 * "everyone" wearing the name of a narrow group. `learn_only` is the group
 * people mean when they say "the Learn members": the ones whose only panel is
 * Learn.
 *
 * `people` is the exception to that partition: a hand-picked list for the note
 * that belongs to two or three colleagues and has no group behind it (0067).
 * It is the only token that carries ids alongside it.
 */
export type AudienceToken =
  | "everyone"
  | "work"
  | "learn_only"
  | "admins"
  | "people";

export const DEFAULT_AUDIENCE: AudienceToken = "everyone";

/** The one audience that carries its own list of ids alongside the token. */
export const PEOPLE_AUDIENCE: AudienceToken = "people";

export type AudienceOption = {
  token: AudienceToken;
  label: string;
  /** Second line in the dropdown — who this actually reaches. */
  hint: string;
};

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { token: "everyone", label: "All members", hint: "Everyone at Kagu" },
  {
    token: "learn_only",
    label: "Kagu Learn members",
    hint: "Learn without Work — the trainees",
  },
  { token: "work", label: "Kagu Work members", hint: "The Work team" },
  { token: "admins", label: "Admins only", hint: "Nobody else sees it" },
  {
    token: "people",
    label: "Specific people",
    hint: "Pick them by name",
  },
];

const AUDIENCE_LABELS = new Map(
  AUDIENCE_OPTIONS.map((a) => [a.token as string, a.label])
);

/** Falls back to the raw token so an audience added in the database still reads. */
export function audienceLabel(token: string): string {
  return AUDIENCE_LABELS.get(token) ?? token;
}

export function isValidAudience(token: string): token is AudienceToken {
  return AUDIENCE_LABELS.has(token);
}

/**
 * How the audience reads on a pinned note. `everyone` returns null — a chip on
 * every note saying "All members" is furniture, and the interesting case is
 * precisely the note that is NOT for everyone.
 *
 * A named list reads as a COUNT ("3 people"), not as the names. The names are
 * in the composer, which only admins open; putting them on the card would tell
 * each of the three who else got the same note, which is a disclosure the
 * author never opted into by picking an audience.
 */
export function audienceChip(token: string, idCount = 0): string | null {
  if (token === "everyone") return null;
  if (token === PEOPLE_AUDIENCE)
    return `${idCount} ${idCount === 1 ? "person" : "people"}`;
  return isValidAudience(token) ? audienceLabel(token) : null;
}

/**
 * One person as the composer's readership preview needs them.
 *
 * Carries the two membership facts the audience rules turn on rather than the
 * whole section list: the preview only ever has to answer "Work or trainee",
 * and shipping every membership to the browser would tell an admin's client
 * more about the roster than the feature needs.
 */
export type RosterPerson = {
  id: string;
  name: string;
  color: string;
  isAdmin: boolean;
  hasWork: boolean;
  hasLearn: boolean;
};

/**
 * Exactly who will read a note with this audience — the same rules as
 * private.sees_pinboard (0066), evaluated here so the composer can show the
 * list before anything is pinned.
 *
 * ⚠️ This MIRRORS the database; it does not enforce anything. RLS is the wall.
 * If the two ever disagree the database wins and this preview is simply wrong,
 * which is why both are written from the same four-case shape.
 */
export function audienceReaders(
  roster: RosterPerson[],
  token: AudienceToken,
  ids: string[] = []
): RosterPerson[] {
  switch (token) {
    case "everyone":
      return roster;
    case "admins":
      return roster.filter((p) => p.isAdmin);
    case "work":
      return roster.filter((p) => p.hasWork);
    case "learn_only":
      return roster.filter((p) => p.hasLearn && !p.hasWork);
    case "people": {
      // Resolved against the roster rather than returned as raw ids, so an id
      // belonging to nobody (a since-deleted profile — the array has no foreign
      // key, see 0067) drops out of the preview exactly as it drops out of the
      // readership. The preview's count then matches reality instead of the
      // number of chips the author happened to pick.
      const picked = new Set(ids);
      return roster.filter((p) => picked.has(p.id));
    }
  }
}
