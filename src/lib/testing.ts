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
 * One line per case. `Area: title` puts it in a group; a line with no colon is
 * ungrouped. Only the FIRST colon splits, so "Checkout: pay with 3DS: fails"
 * keeps its second one, and a colon past 40 characters is treated as part of
 * the title rather than an area nobody meant to create.
 */
export function parseQuickAdd(text: string): { area: string | null; title: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      if (i > 0 && i <= 40) {
        const area = line.slice(0, i).trim();
        const title = line.slice(i + 1).trim();
        if (area && title) return { area: area.slice(0, 60), title: title.slice(0, 200) };
      }
      return { area: null, title: line.slice(0, 200) };
    });
}
