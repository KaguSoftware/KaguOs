"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";
import type { ContactKind, ContactStatus } from "@/lib/types";

const KINDS: ContactKind[] = ["lead", "client"];
const STATUSES: ContactStatus[] = [
  "new", "contacted", "negotiating", "won", "lost", "active", "dormant",
];

function str(v: FormDataEntryValue | null, max = 300): string | null {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
}

export async function createContact(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireSection("comms");
  const kind = String(formData.get("kind") ?? "lead") as ContactKind;
  const status = String(formData.get("status") ?? "new") as ContactStatus;

  const { data, error } = await ctx.supabase
    .from("contacts")
    .insert({
      name: str(formData.get("name"), 160) || "Untitled contact",
      company: str(formData.get("company")),
      kind: KINDS.includes(kind) ? kind : "lead",
      status: STATUSES.includes(status) ? status : "new",
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      owner_id: str(formData.get("owner_id")),
      notes: str(formData.get("notes"), 2000),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  redirect(`/comms/${data.id}`);
}

export async function updateContact(
  contactId: string,
  fields: {
    name: string;
    company: string;
    kind: ContactKind;
    status: ContactStatus;
    email: string;
    phone: string;
    notes: string;
  }
): Promise<ActionResult> {
  const ctx = await requireSection("comms");
  const name = fields.name.trim().slice(0, 160);
  if (!name) return { ok: false, message: "A contact needs a name." };

  const { error } = await ctx.supabase
    .from("contacts")
    .update({
      name,
      company: fields.company.trim() || null,
      kind: KINDS.includes(fields.kind) ? fields.kind : "lead",
      status: STATUSES.includes(fields.status) ? fields.status : "new",
      email: fields.email.trim() || null,
      phone: fields.phone.trim() || null,
      notes: fields.notes.trim() || null,
    })
    .eq("id", contactId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  revalidatePath(`/comms/${contactId}`);
  return { ok: true, message: "Contact updated." };
}

export async function setContactStatus(
  contactId: string,
  status: ContactStatus
): Promise<ActionResult> {
  const ctx = await requireSection("comms");
  if (!STATUSES.includes(status)) return { ok: false, message: "Invalid status." };

  const { error } = await ctx.supabase
    .from("contacts")
    .update({ status })
    .eq("id", contactId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  revalidatePath(`/comms/${contactId}`);
  return { ok: true, message: "Status updated." };
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  const ctx = await requireSection("comms");
  const { error } = await ctx.supabase.from("contacts").delete().eq("id", contactId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  redirect("/comms");
}

export async function addContactLink(
  contactId: string,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireSection("comms");
  const label = str(formData.get("label"), 160);
  if (!label) return { ok: false, message: "A link needs a label." };

  let url = str(formData.get("url"));
  if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;

  const { error } = await ctx.supabase.from("contact_links").insert({
    contact_id: contactId,
    label,
    url,
    note: str(formData.get("note")),
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/comms/${contactId}`);
  return { ok: true, message: "Link added." };
}

export async function deleteContactLink(
  linkId: string,
  contactId: string
): Promise<ActionResult> {
  const ctx = await requireSection("comms");
  const { error } = await ctx.supabase
    .from("contact_links")
    .delete()
    .eq("id", linkId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/comms/${contactId}`);
  return { ok: true, message: "Link deleted." };
}
