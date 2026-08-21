import type { BadgeTone } from "@/components/ui/badge";
import type { CreativeStatus } from "@/lib/types";

/**
 * The status ladder, defined ONCE.
 *
 * Every screen in this section asks the same three questions of it — what is
 * the next step, which column does this card live in, what colour is this
 * badge — and the temptation is to answer each one where it is asked. That is
 * how a board ends up with a column order that disagrees with the advance
 * button, which nobody notices until a video skips a stage.
 *
 * The database holds the same vocabulary as a check constraint (0063). It does
 * not hold the ORDER, because order is a product decision that changes more
 * often than a schema should.
 */

/** The main line, in order. `changes_requested` is not on it — see below. */
export const CREATIVE_LADDER: CreativeStatus[] = [
  "idea",
  "scripted",
  "shot",
  "editing",
  "internal_review",
  "client_review",
  "approved",
  "scheduled",
  "live",
];

export const CREATIVE_STATUS_LABELS: Record<CreativeStatus, string> = {
  idea: "Idea",
  scripted: "Scripted",
  shot: "Shot",
  editing: "Editing",
  internal_review: "Internal review",
  client_review: "With client",
  changes_requested: "Changes asked",
  approved: "Approved",
  scheduled: "Scheduled",
  live: "Live",
};

/**
 * One line saying what this state MEANS for the person looking at it. Used as
 * column subheadings on the board and as the empty-state hint, so a new
 * marketer can read the pipeline without being taught it.
 */
export const CREATIVE_STATUS_HINTS: Record<CreativeStatus, string> = {
  idea: "A concept, nothing written yet.",
  scripted: "Hook and script are written. Ready to book a shoot.",
  shot: "Footage exists. Waiting for an editor.",
  editing: "Being cut right now.",
  internal_review: "One of us checks it before the client sees it.",
  client_review: "Sent. Waiting on the client.",
  changes_requested: "The client asked for something. Back to the edit.",
  approved: "Signed off. Needs a publish date.",
  scheduled: "Dated and queued.",
  live: "Published.",
};

/**
 * Colour is state, never decoration (DESIGN.md). Three meanings only:
 * amber = someone owes work, info = waiting on someone else, green = done.
 * Everything earlier than the edit is neutral, because a backlog is not a
 * status worth colouring.
 */
export const CREATIVE_STATUS_TONE: Record<CreativeStatus, BadgeTone> = {
  idea: "faint",
  scripted: "neutral",
  shot: "neutral",
  editing: "amber",
  internal_review: "amber",
  client_review: "info",
  changes_requested: "danger",
  approved: "green",
  scheduled: "info",
  live: "green",
};

/**
 * The next rung, or null at the top.
 *
 * `changes_requested` returns to `editing` rather than continuing: a video the
 * client sent back has to be re-cut, and its next step is the edit, not the
 * next state after "with client". This asymmetry is the reason the ladder is a
 * function rather than an array index at each call site.
 */
export function nextStatus(
  status: CreativeStatus,
  opts?: { house?: boolean }
): CreativeStatus | null {
  if (status === "changes_requested") return "editing";
  // A house-client video (Kagu's own brand, 0068) has no client to wait on:
  // internal review IS the sign-off, so the ladder skips `client_review`.
  // Server-side advanceCreative recomputes with the real flag — the option
  // here only shapes labels and optimistic UI.
  if (opts?.house && status === "internal_review") return "approved";
  const at = CREATIVE_LADDER.indexOf(status);
  if (at === -1 || at === CREATIVE_LADDER.length - 1) return null;
  return CREATIVE_LADDER[at + 1];
}

/**
 * The verb on the one-click advance button. "Advance" everywhere would be
 * technically correct and useless — the whole point of a one-click primitive is
 * that the button says what happens.
 */
export const ADVANCE_LABEL: Record<CreativeStatus, string> = {
  idea: "Mark scripted",
  scripted: "Mark shot",
  shot: "Start editing",
  editing: "Send to internal review",
  internal_review: "Send to client",
  // ⚠️ NOT "Waiting on client", which is what this state IS but not what the
  // button DOES. At this rung the advance approves the video, and the honest
  // reading matters: a client usually approves in the portal (which moves it by
  // itself), so a member pressing this is recording a yes given somewhere else
  // — over WhatsApp, on a call. The label has to admit that, because a button
  // labelled with the current state reads as inert and gets pressed to see what
  // happens.
  client_review: "Approve for them",
  changes_requested: "Back to editing",
  approved: "Schedule it",
  scheduled: "Mark live",
  live: "Live",
};

/**
 * The advance verb, house-aware. For a house video the rung after internal
 * review is approval, so "Send to client" would promise a hand-off that never
 * happens. Everything else reads the table.
 */
export function advanceLabel(status: CreativeStatus, house: boolean): string {
  if (house && status === "internal_review") return "Approve it";
  return ADVANCE_LABEL[status];
}

/** Statuses a client can see at all (mirrors the RLS policy in 0063). */
export const CLIENT_VISIBLE_STATUSES: CreativeStatus[] = [
  "client_review",
  "changes_requested",
  "approved",
  "scheduled",
  "live",
];

/** Seconds → "1:07". The form a timecode is read in, never raw seconds. */
export function formatTimecode(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * "1:07" or "67" → 67 seconds. Returns null for anything unparseable, so the
 * caller decides whether that is an error or simply an unpinned comment.
 */
export function parseTimecode(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length > 2) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
  const seconds = parts.length === 2 ? nums[0] * 60 + nums[1] : nums[0];
  return seconds >= 0 && seconds <= 86400 ? seconds : null;
}
