/**
 * Batch-size limits for the debug board, shared by the client and the server
 * actions that enforce them.
 *
 * Same reasoning as `debug-images.ts`: a `"use server"` module may only export
 * async functions, so a plain const can't live in `actions/debug.ts`. Both sides
 * import from here, which is the point — the number named in the warning and the
 * number actually enforced can never drift apart.
 */

/**
 * How many titles one batch-insert call accepts (`quickAddTasks`,
 * `logAuditFindings`).
 *
 * ⚠️ This cap used to be applied SILENTLY — `.slice(0, 50)` with no report — so
 * pasting 60 brainstorm titles posted 50 and dropped 10 without a word. You'd
 * only notice much later, once the ideas were gone. The cap itself is fine (this
 * is a paste, not an import pipeline); hiding it was the bug. Anything that
 * truncates against this constant MUST say what it dropped.
 */
export const MAX_TASKS_PER_BATCH = 50;

/** "Added 50 — 10 didn't fit…" — one wording, used by every caller. */
export function overflowNote(dropped: number): string {
  return `${dropped} didn't fit (${MAX_TASKS_PER_BATCH} max per batch) — post ${
    dropped === 1 ? "it" : "them"
  } in a second batch.`;
}
