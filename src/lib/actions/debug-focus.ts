"use server";

import { revalidatePath } from "next/cache";
import { blockIfShowcase, requireAdmin } from "@/lib/data/session";
import { notifySection } from "@/lib/actions/notify";
import type { ActionResult } from "@/lib/actions/account";
import type { DebugFocusParts } from "@/lib/types";

type Tone = "info" | "primary" | "warning";
const TONES: Tone[] = ["info", "primary", "warning"];

/** Keep only the keys we know, and only string arrays — `parts` is user-shaped jsonb. */
function cleanParts(parts: DebugFocusParts): DebugFocusParts {
  const pick = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    mode: parts.mode === "find" ? "find" : "work",
    hunt: pick(parts.hunt),
    kinds: pick(parts.kinds),
    states: pick(parts.states),
    priorities: pick(parts.priorities),
    order: pick(parts.order),
  };
}

/**
 * Add a new focus item, or update an existing one when `id` is given.
 *
 * An item can name SEVERAL boards (empty = the whole board), and two items may
 * name the same board — a broad "Pet app — fixes" can coexist with a sharper
 * "Pet app — the login crash first". Rank is what orders them.
 */
export async function saveDebugFocus(input: {
  /** Present = edit that item in place; absent = add a new one. */
  id?: string;
  /** Empty = an item about the whole board, not specific projects. */
  projectIds: string[];
  body: string;
  tone: Tone;
  parts: DebugFocusParts;
}): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const clean = input.body.trim().slice(0, 500);
  if (!clean) return { ok: false, message: "Write something first." };
  const tone = TONES.includes(input.tone) ? input.tone : "info";
  const projectIds = (input.projectIds ?? []).filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );

  // Editing keeps the row (and its rank), so the list doesn't reshuffle
  // underneath the admin when they fix a typo.
  if (input.id) {
    const { error } = await ctx.supabase
      .from("debug_focus")
      .update({
        body: clean,
        tone,
        project_ids: projectIds,
        parts: cleanParts(input.parts),
      })
      .eq("id", input.id);
    if (error) return { ok: false, message: error.message };

    revalidatePath("/debug");
    return { ok: true, message: "Focus updated." };
  }

  // New items land at the bottom of the list.
  const { data: last } = await ctx.supabase
    .from("debug_focus")
    .select("rank")
    .eq("active", true)
    .order("rank", { ascending: false })
    .limit(1);
  const rank = (last?.[0]?.rank ?? -1) + 1;

  const { error } = await ctx.supabase.from("debug_focus").insert({
    body: clean,
    tone,
    project_ids: projectIds,
    parts: cleanParts(input.parts),
    rank,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  notifySection(ctx, "debug", {
    kind: "debug_task_new",
    title: `Debug focus: ${clean.slice(0, 80)}`,
    href: "/debug",
  });

  revalidatePath("/debug");
  return { ok: true, message: "Focus set." };
}

/** Retire one item. The others stay — this is a list, not a single banner. */
export async function clearDebugFocus(id: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const { error } = await ctx.supabase
    .from("debug_focus")
    .update({ active: false })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return { ok: true, message: "Focus removed." };
}

/** Retire everything at once — "we're not focusing on anything in particular". */
export async function clearAllDebugFocus(): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const { error } = await ctx.supabase
    .from("debug_focus")
    .update({ active: false })
    .eq("active", true);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return { ok: true, message: "Focus cleared." };
}

/**
 * Reorder the active items. Takes ids in their new order and writes each rank
 * in one wave — the list is a handful of rows, so N small updates in parallel
 * beat any cleverness (and the whole app's perf rule is "count waves, not
 * queries").
 */
export async function reorderDebugFocus(ids: string[]): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const clean = ids.filter(Boolean);
  if (clean.length === 0) return { ok: false, message: "Nothing to reorder." };

  const results = await Promise.all(
    clean.map((id, i) =>
      ctx.supabase.from("debug_focus").update({ rank: i }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: failed.error.message };

  revalidatePath("/debug");
  return { ok: true, message: "Reordered." };
}
