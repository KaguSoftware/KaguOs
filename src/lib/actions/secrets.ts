"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

function clean(value: FormDataEntryValue | null, max = 300): string | null {
  const v = String(value ?? "").trim().slice(0, max);
  return v || null;
}

export async function addSecret(
  projectId: string,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireSection("management");
  const label = clean(formData.get("label"), 120);
  if (!label) return { ok: false, message: "A credential needs a label." };

  const { error } = await ctx.supabase.from("project_secrets").insert({
    project_id: projectId,
    label,
    username: clean(formData.get("username")),
    secret: clean(formData.get("secret")),
    url: clean(formData.get("url")),
    note: clean(formData.get("note")),
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/work/projects/${projectId}`);
  return { ok: true, message: "Credential saved." };
}

export async function deleteSecret(
  secretId: string,
  projectId: string
): Promise<ActionResult> {
  const ctx = await requireSection("management");
  const { error } = await ctx.supabase
    .from("project_secrets")
    .delete()
    .eq("id", secretId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/work/projects/${projectId}`);
  return { ok: true, message: "Credential deleted." };
}
