/**
 * Constants both sides of the chat need — a `"use server"` module can't export
 * consts, and the client (composer) and server (action validation) must agree
 * on the same numbers. Same reasoning as lib/debug-limits.ts.
 */

/** Route segment for the Work-team group chat: /messages/team. Not a uuid, so
 *  it can never collide with a member id. */
export const GROUP_THREAD = "team";

/** Display name of the group chat — work members only, so not "Everyone". */
export const GROUP_LABEL = "Work team";

/** Matches the DB CHECK on messages.body. */
export const MAX_MESSAGE_LEN = 4000;
