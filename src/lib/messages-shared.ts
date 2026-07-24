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

/** Limits on chat image attachments — mirrors lib/debug-images.ts. */
export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

/** Resize applied to chat-bubble THUMBNAILS only — see debug-images.ts for
 *  why this must be baked into the signing token rather than a query param. */
export const CHAT_THUMB_TRANSFORM = {
  width: 480,
  resize: "contain",
  quality: 75,
} as const;
