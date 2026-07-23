"use server";

import { revalidatePath } from "next/cache";
import { blockIfShowcase, requireAdmin } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

/**
 * Set which debug boards are pinned, and in what order. `pinnedIds` land at
 * positions 0..n-1; everything in `unpinnedIds` goes back to auto-sort (null).
 * A handful of rows, so N small updates in one wave — same shape as
 * reorderDebugFocus (count waves, not queries).
 */
export async function setDebugBoardOrder(
  pinnedIds: string[],
  unpinnedIds: string[]
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const pinned = pinnedIds.filter(Boolean);
  const unpinned = unpinnedIds.filter(Boolean);
  if (pinned.length === 0 && unpinned.length === 0)
    return { ok: false, message: "Nothing to reorder." };

  const results = await Promise.all([
    ...pinned.map((id, i) =>
      ctx.supabase.from("projects").update({ debug_position: i }).eq("id", id)
    ),
    ...unpinned.map((id) =>
      ctx.supabase
        .from("projects")
        .update({ debug_position: null })
        .eq("id", id)
    ),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: failed.error.message };

  revalidatePath("/debug");
  return { ok: true, message: "Board order saved." };
}
