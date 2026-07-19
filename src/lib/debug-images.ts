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
