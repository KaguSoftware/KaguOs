// Member identity colors — 20 vibrant hues (high chroma), all validated to stay
// readable (≥4.5:1) on the dark surfaces. Stored by key in profiles.color.

export type MemberColor = { key: string; label: string; css: string };

export const MEMBER_COLORS: MemberColor[] = [
  { key: "salmon", label: "Salmon", css: "oklch(0.74 0.18 5)" },
  { key: "rose", label: "Rose", css: "oklch(0.72 0.19 15)" },
  { key: "red", label: "Red", css: "oklch(0.7 0.2 25)" },
  { key: "tangerine", label: "Tangerine", css: "oklch(0.75 0.18 45)" },
  { key: "orange", label: "Orange", css: "oklch(0.78 0.17 60)" },
  { key: "amber", label: "Amber", css: "oklch(0.82 0.16 75)" },
  { key: "yellow", label: "Yellow", css: "oklch(0.86 0.16 95)" },
  { key: "lime", label: "Lime", css: "oklch(0.84 0.19 120)" },
  { key: "green", label: "Green", css: "oklch(0.78 0.19 140)" },
  { key: "emerald", label: "Emerald", css: "oklch(0.78 0.16 160)" },
  { key: "mint", label: "Mint", css: "oklch(0.82 0.14 175)" },
  { key: "teal", label: "Teal", css: "oklch(0.78 0.13 190)" },
  { key: "cyan", label: "Cyan", css: "oklch(0.8 0.13 210)" },
  { key: "sky", label: "Sky", css: "oklch(0.76 0.13 230)" },
  { key: "blue", label: "Blue", css: "oklch(0.72 0.16 255)" },
  { key: "indigo", label: "Indigo", css: "oklch(0.7 0.17 275)" },
  { key: "violet", label: "Violet", css: "oklch(0.72 0.18 290)" },
  { key: "purple", label: "Purple", css: "oklch(0.73 0.19 305)" },
  { key: "fuchsia", label: "Fuchsia", css: "oklch(0.74 0.2 325)" },
  { key: "pink", label: "Pink", css: "oklch(0.75 0.19 345)" },
];

const byKey = new Map(MEMBER_COLORS.map((c) => [c.key, c.css]));

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** A stored color can be a preset key or a raw `#rgb`/`#rrggbb` hex value. */
export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** Deterministic default so everyone has a color before picking one. */
export function defaultColorKey(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return MEMBER_COLORS[hash % MEMBER_COLORS.length].key;
}

export function memberColorCss(
  userId: string,
  color: string | null | undefined
): string {
  const stored = color?.trim() ?? "";
  if (isHexColor(stored)) return stored;
  return byKey.get(stored) ?? byKey.get(defaultColorKey(userId))!;
}

/** Accepts either a preset key or a raw hex value — both are valid to store. */
export function isValidColorKey(value: string): boolean {
  return byKey.has(value) || isHexColor(value);
}
