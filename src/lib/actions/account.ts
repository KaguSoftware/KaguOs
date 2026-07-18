"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data/session";
import { isValidColorKey } from "@/lib/colors";
import { STATUS_KINDS, type StatusKind } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string } | null;

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

/** Set your own presence status + call availability (team widget). */
export async function updateMyStatus(fields: {
  kind: StatusKind;
  text: string;
  availableToCall: boolean;
}): Promise<ActionResult> {
  let kind: StatusKind = STATUS_KINDS.includes(fields.kind)
    ? fields.kind
    : "none";
  const text = fields.text.trim().slice(0, 80);
  // A custom status with nothing written is no status at all.
  if (kind === "custom" && !text) kind = "none";

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({
      status_kind: kind,
      status_text: kind === "custom" ? text : null,
      available_to_call: Boolean(fields.availableToCall),
    })
    .eq("id", userId);
  if (error) return { ok: false, message: error.message };

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
