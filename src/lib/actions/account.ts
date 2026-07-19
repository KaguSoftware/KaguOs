"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserId, getSessionContext } from "@/lib/data/session";
import { notifyWorkTeam } from "@/lib/actions/notify";
import { isValidColorKey } from "@/lib/colors";
import { STATUS_KINDS, STATUS_PRESETS, type StatusKind } from "@/lib/types";

/** Durations the picker offers, in ms. 0 = open-ended (clears any expiry). */
const STATUS_DURATIONS_MS = new Set([
  30 * 60 * 1000, // 30m
  60 * 60 * 1000, // 1h
  2 * 60 * 60 * 1000, // 2h
  12 * 60 * 60 * 1000, // "until tomorrow"-ish; client labels it
]);

export type ActionResult = {
  ok: boolean;
  message: string;
  /**
   * Id of the row a create action just inserted. Optional, and only set by the
   * actions whose forms need to do something with the new row before
   * navigating away — the debug create form attaches staged screenshots, which
   * can't be uploaded earlier because they need a task_id to belong to.
   */
  id?: string;
} | null;

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateName(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 1 || fullName.length > 80) {
    return { ok: false, message: "Name must be 1–80 characters." };
  }

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Name updated." };
}

export async function updateMyColor(colorKey: string): Promise<ActionResult> {
  if (!isValidColorKey(colorKey)) return { ok: false, message: "Pick a color from the set." };

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ color: colorKey })
    .eq("id", userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Color updated." };
}

/**
 * Set your own presence status. The status is emoji + optional note that any
 * kind can carry; `durationMs` is a relative expiry the SERVER turns into an
 * absolute timestamp (client sends a choice, not a wall-clock time — no drift,
 * nothing to tamper with). available_to_call is the one availability signal.
 */
export async function updateMyStatus(fields: {
  kind: StatusKind;
  emoji?: string | null;
  text?: string | null;
  availableToCall: boolean;
  /** Relative expiry in ms from now; 0/absent = open-ended. */
  durationMs?: number | null;
}): Promise<ActionResult> {
  let kind: StatusKind = STATUS_KINDS.includes(fields.kind) ? fields.kind : "none";
  const text = (fields.text ?? "").trim().slice(0, 80);
  const emojiRaw = (fields.emoji ?? "").trim().slice(0, 16);
  // A custom status with neither emoji nor note written is no status at all.
  if (kind === "custom" && !text && !emojiRaw) kind = "none";

  // Clearing the status clears everything hanging off it.
  const emoji = kind === "none" ? null : emojiRaw || STATUS_PRESETS[kind].emoji || null;

  // Turn the relative duration into an absolute expiry. Only a value from the
  // known set counts, and only while a status is set.
  let until: string | null = null;
  if (kind !== "none" && fields.durationMs && STATUS_DURATIONS_MS.has(fields.durationMs)) {
    until = new Date(Date.now() + fields.durationMs).toISOString();
  }

  // getSessionContext gives us the previous status (no extra query) for the
  // change comparison, plus a SessionContext for the notification fan-out.
  const ctx = await getSessionContext();
  const prev = ctx.profile;

  const availableToCall = Boolean(fields.availableToCall);
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      status_kind: kind,
      status_emoji: emoji,
      status_text: kind === "none" ? null : text || null,
      available_to_call: availableToCall,
      status_until: until,
    })
    .eq("id", ctx.userId);
  if (error) return { ok: false, message: error.message };

  // Notify the work team only on a MEANINGFUL change — a different status kind,
  // or newly opening up to calls. Editing the note, clearing a status, or just
  // changing the expiry stays quiet (avoids pinging the team on churn).
  const kindChanged = kind !== "none" && kind !== prev.status_kind;
  const nowCallable = availableToCall && !prev.available_to_call;
  if (kindChanged || nowCallable) {
    const base =
      text || (kind !== "none" ? STATUS_PRESETS[kind].label : "available to call");
    const label = emoji ? `${emoji} ${base}` : base;
    const name = prev.full_name || "A teammate";
    const tail = until
      ? ` — till ${new Date(until).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "";
    notifyWorkTeam(ctx, {
      kind: "status_change",
      title: `${name} is now ${label}${tail}`,
      href: "/",
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Status updated." };
}

export async function updatePassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };

  return { ok: true, message: "Password changed." };
}
