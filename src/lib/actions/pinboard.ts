"use server";

import { revalidatePath } from "next/cache";
import { blockIfShowcase, requireAdmin } from "@/lib/data/session";
import {
  DEFAULT_NOTE_COLOR,
  isValidAudience,
  isValidNoteColor,
} from "@/lib/pinboard";
import type { ActionResult } from "@/lib/actions/account";

/** Matches the length check on `body` in 0065. */
const MAX_BODY = 280;

/**
 * The validated shape, or the sentence to show instead.
 *
 * Deliberately NOT `… | ActionResult`: ActionResult includes null (a silent
 * success), so a union with it makes every caller null-check a value that can
 * never be null here, and `ok` stops narrowing.
 */
type Cleaned =
  | { ok: true; body: string; color: string; audience: string }
  | { ok: false; message: string };

/**
 * Clean the free-form inputs the composer sends.
 *
 * An unrecognised AUDIENCE is refused rather than defaulted. The other two
 * fields are corrected on the way through, but guessing an audience is the one
 * repair that could widen who reads the note — defaulting a stale client's
 * token to "everyone" would publish to the company something addressed to two
 * admins, and no toast would say so.
 */
function clean(body: string, color: string, audience: string): Cleaned {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return { ok: false, message: "Write the note first." };

  if (!isValidAudience(audience))
    return { ok: false, message: "Pick who this note is for." };

  return {
    ok: true,
    body: text,
    // An unrecognised color IS corrected rather than refused: the note's words
    // are the content, and no one should lose them to a palette mismatch.
    color: isValidNoteColor(color) ? color : DEFAULT_NOTE_COLOR,
    audience,
  };
}

export async function pinNote(
  body: string,
  color: string,
  audience: string
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const input = clean(body, color, audience);
  if (!input.ok) return input;

  const { error } = await ctx.supabase.from("pinboard_notes").insert({
    body: input.body,
    color: input.color,
    audience: input.audience,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Note pinned." };
}

/**
 * Edit a note IN PLACE — same reasoning as updateAnnouncement: an edit changes
 * the words, not the authorship or the age. Re-pinning instead would send a
 * corrected typo back to the top of the board as if it were new.
 */
export async function updateNote(
  id: string,
  body: string,
  color: string,
  audience: string
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const input = clean(body, color, audience);
  if (!input.ok) return input;

  const { error } = await ctx.supabase
    .from("pinboard_notes")
    .update({
      body: input.body,
      color: input.color,
      audience: input.audience,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Note updated." };
}

/**
 * Unpin for good.
 *
 * A hard delete, unlike an announcement's `active = false`. An announcement is
 * a record of something the company was told and worth keeping; a pinboard note
 * is a working reminder, and the board's usefulness depends on people clearing
 * it without feeling they're destroying anything.
 */
export async function unpinNote(id: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const { error } = await ctx.supabase
    .from("pinboard_notes")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Note unpinned." };
}
