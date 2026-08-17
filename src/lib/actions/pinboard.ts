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
  | { ok: true; body: string; color: string; audiences: string[] }
  | { ok: false; message: string };

/**
 * Clean the free-form inputs the composer sends.
 *
 * Returns a message instead of a value when the audience list is empty. That
 * case is the one worth refusing out loud: an empty array trips the check
 * constraint in 0065, and the raw Postgres error ("violates check constraint
 * pinboard_notes_audiences_valid") is not a sentence anyone should be shown.
 * Unknown tokens are dropped rather than refused — the only way to send one is
 * a stale client, and silently narrowing to what this build understands is
 * safer than pinning a note to an audience the database may not gate.
 */
function clean(body: string, color: string, audiences: string[]): Cleaned {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return { ok: false, message: "Write the note first." };

  // Deduped: the picker can't produce a repeat, but `audiences <@ ...` doesn't
  // forbid one, and a note listing "Kagu Work · Kagu Work" would render it.
  const picked = [...new Set(audiences.filter(isValidAudience))];
  if (picked.length === 0)
    return { ok: false, message: "Pick who this note is for." };

  return {
    ok: true,
    body: text,
    // An unrecognised color is corrected rather than refused: the note's words
    // are the content, and no one should lose them to a palette mismatch.
    color: isValidNoteColor(color) ? color : DEFAULT_NOTE_COLOR,
    audiences: picked,
  };
}

export async function pinNote(
  body: string,
  color: string,
  audiences: string[]
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const input = clean(body, color, audiences);
  if (!input.ok) return input;

  const { error } = await ctx.supabase.from("pinboard_notes").insert({
    body: input.body,
    color: input.color,
    audiences: input.audiences,
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
  audiences: string[]
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const input = clean(body, color, audiences);
  if (!input.ok) return input;

  const { error } = await ctx.supabase
    .from("pinboard_notes")
    .update({
      body: input.body,
      color: input.color,
      audiences: input.audiences,
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
