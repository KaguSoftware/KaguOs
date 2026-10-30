/**
 * Testing constants and pure helpers, shared by the board and the server
 * actions. They live here rather than in `actions/testing.ts` because a
 * `"use server"` module may only export async functions (same reason as
 * `debug-images.ts`).
 */
import type { TestCase, TestEnvironment, TestStatus } from "@/lib/types";

/** A pass older than this reads as "stale" — it may not still be true. */
export const STALE_DAYS = 14;

export const TEST_STATUSES: TestStatus[] = [
  "untested",
  "pass",
  "fail",
  "blocked",
  "retest",
];

export const STATUS_LABEL: Record<TestStatus, string> = {
  untested: "Untested",
  pass: "Works",
  fail: "Broken",
  blocked: "Blocked",
  retest: "Retest",
};

export const ENVIRONMENTS: TestEnvironment[] = ["staging", "prod", "local"];

export const ENV_LABEL: Record<TestEnvironment, string> = {
  prod: "Prod",
  staging: "Staging",
  local: "Local",
};

/** Cases per quick-add paste. Reported when exceeded, never silently cut. */
export const MAX_CASES_PER_BATCH = 50;

export function isStale(c: TestCase, now: number = Date.now()): boolean {
  if (c.status !== "pass" || !c.last_tested_at) return false;
  return now - Date.parse(c.last_tested_at) > STALE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Groups nest. A case's `area` is a path — "Mobile app > Home > Booking card"
 * — so a project can be split into an app, the app into pages, a page into
 * the components on it, each level rolling up its own pass count. A plain
 * "Auth" is just a one-level path, so lists made before nesting still read
 * the same.
 *
 * Stored with " > " between levels; shown with "›".
 */
export const GROUP_SEP = " > ";
/** Matches the `area` check constraint (0087). */
export const MAX_GROUP_LENGTH = 200;
export const MAX_GROUP_SEGMENT = 50;

/** "Mobile app>Home >  Header" → ["Mobile app", "Home", "Header"]. */
export function groupSegments(area: string | null | undefined): string[] {
  if (!area) return [];
  return area
    .split(">")
    .map((s) => s.replace(/\s+/g, " ").trim().slice(0, MAX_GROUP_SEGMENT))
    .filter(Boolean);
}

/** The stored form of a typed path. null when there's nothing left of it. */
export function normalizeGroup(raw: string | null | undefined): string | null {
  const parts = groupSegments(raw);
  return parts.length ? parts.join(GROUP_SEP) : null;
}

/** For display: "Mobile app › Home › Header". */
export function formatGroup(area: string | null | undefined): string {
  return groupSegments(area).join(" › ");
}

/** Whether `area` is `group` itself or anywhere beneath it. */
export function isInGroup(area: string | null, group: string): boolean {
  const a = groupSegments(area);
  const g = groupSegments(group);
  return g.length > 0 && g.length <= a.length && g.every((s, i) => s === a[i]);
}

/**
 * One line per case. `Group: title` puts it in a group, and `>` nests:
 * "Mobile app > Home > Booking card: Tap Book opens the sheet". A line that is
 * ONLY a group and a colon ("Mobile app > Home:") heads the lines under it, up
 * to the next blank line, so a whole page's checks can be pasted without
 * repeating the path. `base` is
 * the group the list was added from; everything lands beneath it.
 *
 * Only the FIRST colon splits, so "Checkout: pay with 3DS: fails" keeps its
 * second one, and a colon past 40 characters is treated as part of the title
 * rather than a group nobody meant to create — unless what precedes it is
 * clearly a path (it has a ">").
 */
export function parseQuickAdd(
  text: string,
  base: string | null = null
): { area: string | null; title: string }[] {
  const baseParts = groupSegments(base);
  let heading: string[] = [];
  const out: { area: string | null; title: string }[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) {
      // A blank line closes a heading's block.
      heading = [];
      continue;
    }

    if (line.endsWith(":") && line.length <= MAX_GROUP_LENGTH) {
      const parts = groupSegments(line.slice(0, -1));
      if (parts.length) {
        heading = parts;
        continue;
      }
    }

    let own: string[] = [];
    let title = line;
    const i = line.indexOf(":");
    if (i > 0) {
      const prefix = line.slice(0, i);
      if (i <= 40 || (prefix.includes(">") && i <= MAX_GROUP_LENGTH)) {
        const rest = line.slice(i + 1).trim();
        const parts = groupSegments(prefix);
        if (parts.length && rest) {
          own = parts;
          title = rest;
        }
      }
    }

    const path = [...baseParts, ...heading, ...own];
    out.push({
      area: path.length ? path.join(GROUP_SEP) : null,
      title: title.slice(0, 200),
    });
  }
  return out;
}
