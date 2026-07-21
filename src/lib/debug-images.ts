/**
 * Limits on task screenshots, shared by the upload UI and the server action.
 *
 * They live here rather than in `actions/debug.ts` because a `"use server"`
 * module may only export async functions — a plain const there is a build
 * error. Both sides import from this file so the number in the error message
 * and the number actually enforced can never drift apart.
 */
export const MAX_IMAGES_PER_TASK = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

/**
 * Resize applied to THUMBNAILS only, served by Supabase's image renderer.
 *
 * Measured on a real board screenshot: 198,398 bytes as stored, 21,399 through
 * this transform — a 9x cut, for a grid box that is only `h-20` tall.
 *
 * ⚠️ These options are baked into the signed TOKEN, so a URL must be minted
 * with them. They are NOT query params: appending `&width=320` to an ordinary
 * signed URL returns 200 and a re-encoded full-size image (202KB, i.e. LARGER
 * than the original). Always sign with `{ transform }`.
 *
 * ⚠️ `width` is 320, not the ~160 CSS px of the box. A 2x-DPR phone renders a
 * 160px source soft, and a blurry screenshot in a bug report is worse than a
 * heavy one.
 *
 * ⚠️ `contain`, never `cover`. These are screenshots: cropping a wide one to a
 * square centre throws away the part of the UI the reporter was pointing at.
 */
export const THUMB_TRANSFORM = {
  width: 320,
  resize: "contain",
  quality: 70,
} as const;
