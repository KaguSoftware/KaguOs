import type { BadgeTone } from "@/components/ui/badge";
import type { PostStatus } from "@/lib/types";

/**
 * The post ladder, defined ONCE — same rule the old creative ladder followed:
 * every screen asks it what the next step is, which column a card lives in and
 * what colour the badge is, and answering those where they're asked is how a
 * board ends up disagreeing with its own advance button.
 *
 * Four states, deliberately. The old ten-rung ladder encoded a production
 * process (script → shoot → edit → reviews) the team coordinates off-app; the
 * section only needs to know whether a post is an idea, being made, dated, or
 * out. The database holds the same vocabulary as a check constraint (0068).
 */
export const POST_LADDER: PostStatus[] = ["idea", "making", "scheduled", "posted"];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  idea: "Idea",
  making: "Making",
  scheduled: "Scheduled",
  posted: "Posted",
};

export const POST_STATUS_HINTS: Record<PostStatus, string> = {
  idea: "A concept, nothing made yet.",
  making: "Being produced right now.",
  scheduled: "Ready, dated and queued.",
  posted: "Out. The link lives on the post.",
};

/**
 * Colour is state, never decoration (DESIGN.md): amber = someone owes work,
 * info = queued, green = done, and an idea is neutral because a backlog is
 * not a status worth colouring.
 */
export const POST_STATUS_TONE: Record<PostStatus, BadgeTone> = {
  idea: "faint",
  making: "amber",
  scheduled: "info",
  posted: "green",
};

/** The next rung, or null at the top. */
export function nextPostStatus(status: PostStatus): PostStatus | null {
  const at = POST_LADDER.indexOf(status);
  if (at === -1 || at === POST_LADDER.length - 1) return null;
  return POST_LADDER[at + 1];
}

/** The verb on the one-click advance button — it says what happens, not "Advance". */
export const POST_ADVANCE_LABEL: Record<PostStatus, string> = {
  idea: "Start making",
  making: "Mark scheduled",
  scheduled: "Mark posted",
  posted: "Posted",
};
