// The pinboard's two vocabularies: what a note can look like, and who it can be
// addressed to. Shared by the composer and the server action so the picker and
// the validator can never drift — the action rejects exactly what the UI cannot
// offer, and both agree with the check constraint in 0065.

import type { Section } from "@/lib/types";

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
 * Who a note can be addressed to.
 *
 * Three of these are not sections. `everyone` and `admins` are self-evident;
 * `learn_only` exists because granting Work auto-grants Learn (0026), so the
 * plain "Kagu Learn" audience necessarily includes every Work member — nearly
 * the whole company. Without the split there is no way to address the people
 * whose only panel is Learn.
 */
export type AudienceToken =
  | "everyone"
  | "admins"
  | "learn_only"
  | Extract<Section, "work" | "learn" | "management" | "debug" | "marketing" | "comms" | "chat">;

export type AudienceOption = {
  token: AudienceToken;
  label: string;
  /** Shown under the label in the picker — who this actually reaches. */
  hint: string;
};

/**
 * Picker order: the broad strokes first, then the sections. The two Learn rows
 * sit next to each other on purpose — they are the one pair an admin has to
 * choose between deliberately, and separating them would let someone pick
 * "Kagu Learn" believing it means the trainees.
 *
 * `status` is absent by design: it is a feature gate (presence dots, the status
 * editor), not a group of people you would address.
 */
export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { token: "everyone", label: "Everyone", hint: "Every member" },
  { token: "admins", label: "Admins only", hint: "Admins" },
  {
    token: "learn_only",
    label: "Learn only",
    hint: "Learn without Work — the trainees",
  },
  { token: "learn", label: "Kagu Learn", hint: "Everyone with Learn, Work staff included" },
  { token: "work", label: "Kagu Work", hint: "Work members" },
  { token: "debug", label: "Kagu Debug", hint: "Debug members" },
  { token: "management", label: "Kagu Management", hint: "Management members" },
  { token: "marketing", label: "Kagu Marketing", hint: "Marketing members" },
  { token: "comms", label: "Kagu Comms", hint: "Comms members" },
  { token: "chat", label: "Kagu Chat", hint: "Chat members" },
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
 * How the audience reads on a pinned note.
 *
 * `everyone` returns null — a chip on every note saying "Everyone" is furniture
 * that teaches nothing, and the interesting case is precisely the note that is
 * NOT for everyone. Once a note carries `everyone`, the narrower audiences on
 * it are noise too: they cannot subtract anyone.
 */
export function audienceSummary(audiences: string[]): string | null {
  if (audiences.includes("everyone")) return null;
  const labels = audiences.filter(isValidAudience).map(audienceLabel);
  if (labels.length === 0) return null;
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels[0]} +${labels.length - 1}`;
}
