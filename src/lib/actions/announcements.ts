"use server";

import { revalidatePath } from "next/cache";
import { blockIfShowcase, requireAdmin } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

type Tone = "info" | "primary" | "warning";
const TONES: Tone[] = ["info", "primary", "warning"];

export async function postAnnouncement(
  body: string,
  tone: Tone
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const clean = body.trim().slice(0, 500);
  if (!clean) return { ok: false, message: "Write something first." };

  // One active announcement at a time: retire the others, post this one.
  await ctx.supabase
    .from("announcements")
    .update({ active: false })
    .eq("active", true);

  const { error } = await ctx.supabase.from("announcements").insert({
    body: clean,
    tone: TONES.includes(tone) ? tone : "info",
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Announcement posted." };
}

export async function dismissAnnouncement(id: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const { error } = await ctx.supabase
    .from("announcements")
    .update({ active: false })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Announcement retired." };
}
