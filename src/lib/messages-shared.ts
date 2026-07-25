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

/**
 * The one sentence that explains the group chat. It was written four different
 * ways across the inbox row, the thread header and the empty state ("The whole
 * work team, one room." / "Every work member, one room." / …), which reads as
 * four different features.
 */
export const GROUP_HINT = "Everyone on the work team, one room.";

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

/**
 * Extension per allowed MIME type. Derived from the TYPE, never the filename:
 * the old code did `file.name.split(".").pop()`, so `shot.PNG.exe` was stored as
 * `<uuid>.exe` and a file with no dot at all became its own extension (the
 * `"png"` fallback was unreachable — `pop()` on a non-empty array is never
 * undefined).
 */
export const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** The only shape a chat image object key may take: `<senderId>/<uuid>.<ext>`. */
export function chatImagePath(senderId: string, id: string, type: string) {
  return `${senderId}/${id}.${IMAGE_EXT[type] ?? "png"}`;
}

/**
 * Server-side guard. `sendMessage` receives paths from the CLIENT and used to
 * write them into `message_images.file_path` unexamined, so a row could point at
 * any object in the bucket. A path must live under the sender's own prefix and
 * look like something this app minted.
 */
export function isChatImagePath(path: string, senderId: string) {
  const exts = Object.values(IMAGE_EXT).join("|");
  return new RegExp(
    `^${senderId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${exts})$`,
    "i"
  ).test(path);
}

/** Bound on a stored image dimension — a sane pixel count, not a client claim. */
export const MAX_IMAGE_DIMENSION = 20000;
