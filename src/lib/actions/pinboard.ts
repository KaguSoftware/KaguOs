"use server";

import { revalidatePath } from "next/cache";
import { blockIfShowcase, requireAdmin } from "@/lib/data/session";
import {
  DEFAULT_NOTE_COLOR,
  PEOPLE_AUDIENCE,
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
  | {
      ok: true;
      body: string;
      color: string;
      audience: string;
      audienceIds: string[];
    }
  | { ok: false; message: string };

/**
 * Clean the free-form inputs the composer sends.
 *
 * An unrecognised AUDIENCE is refused rather than defaulted. The other fields
 * are corrected on the way through, but guessing an audience is the one repair
 * that could widen who reads the note — defaulting a stale client's token to
 * "everyone" would publish to the company something addressed to two admins,
 * and no toast would say so.
 */
function clean(
  body: string,
  color: string,
  audience: string,
  audienceIds: string[]
): Cleaned {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return { ok: false, message: "Write the note first." };

  if (!isValidAudience(audience))
    return { ok: false, message: "Pick who this note is for." };

  // The ids are kept ONLY for the named-list audience and dropped for every
  // other one, which is what the 0067 check constraint requires in both
  // directions. Doing it here rather than trusting the composer means
  // re-aiming a note from three people to the whole company cannot leave their
  // names behind on the row.
  const ids =
    audience === PEOPLE_AUDIENCE ? [...new Set(audienceIds)] : [];

  if (audience === PEOPLE_AUDIENCE && ids.length === 0)
    return { ok: false, message: "Pick at least one person." };

  return {
    ok: true,
    body: text,
    // An unrecognised color IS corrected rather than refused: the note's words
    // are the content, and no one should lose them to a palette mismatch.
    color: isValidNoteColor(color) ? color : DEFAULT_NOTE_COLOR,
    audience,
    // Not checked against the roster on the way in. An id naming nobody is
    // inert — it matches no auth.uid(), so RLS simply never hands the note to
    // anyone extra — and a round-trip to prove what the picker already
    // guarantees would cost every pin an extra query to the database.
    audienceIds: ids,
  };
}

export async function pinNote(
  body: string,
  color: string,
  audience: string,
  audienceIds: string[] = []
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const input = clean(body, color, audience, audienceIds);
  if (!input.ok) return input;

  const { error } = await ctx.supabase.from("pinboard_notes").insert({
    body: input.body,
    color: input.color,
    audience: input.audience,
    audience_ids: input.audienceIds,
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
  audience: string,
  audienceIds: string[] = []
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const input = clean(body, color, audience, audienceIds);
  if (!input.ok) return input;

  const { error } = await ctx.supabase
    .from("pinboard_notes")
    .update({
      body: input.body,
      color: input.color,
      audience: input.audience,
      // Always written, never omitted: re-aiming a note away from a named list
      // has to clear the ids, or the row keeps naming people it no longer
      // reaches — and the 0067 constraint refuses the write anyway.
      audience_ids: input.audienceIds,
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
