"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

export type ReminderScope = "personal" | "team";

export async function addReminder(
  text: string,
  scope: ReminderScope
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const clean = text.trim().slice(0, 300);
  if (!clean) return { ok: false, message: "Write something first." };

  const { error } = await ctx.supabase.from("reminders").insert({
    scope,
    owner_id: scope === "personal" ? ctx.userId : null,
    text: clean,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: scope === "team" ? "Shared with the team." : "Added." };
}

export async function toggleReminder(
  id: string,
  done: boolean
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const { error } = await ctx.supabase
    .from("reminders")
    .update({ done })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const { error } = await ctx.supabase.from("reminders").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "" };
}
