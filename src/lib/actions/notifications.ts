"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

/** Mark all of my unread notifications as read. */
export async function markAllRead(): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const { error } = await ctx.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.userId)
    .is("read_at", null);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "" };
}

/** Clear (delete) all of my notifications. */
export async function clearAll(): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const { error } = await ctx.supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", ctx.userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "" };
}
