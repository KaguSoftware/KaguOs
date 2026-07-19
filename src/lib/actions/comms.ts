"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockIfShowcase, requireSection } from "@/lib/data/session";
import { todayInIstanbul } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/account";
import type { ContactKind, ContactStatus, InteractionKind } from "@/lib/types";

const KINDS: ContactKind[] = ["lead", "client"];
const INTERACTION_KINDS: InteractionKind[] = [
  "call", "email", "meeting", "message", "note",
];
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
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
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
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
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
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
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
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
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
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
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
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");
  const { error } = await ctx.supabase
    .from("contact_links")
    .delete()
    .eq("id", linkId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/comms/${contactId}`);
  return { ok: true, message: "Link deleted." };
}

export async function logInteraction(
  contactId: string,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");

  const summary = str(formData.get("summary"), 2000);
  if (!summary) return { ok: false, message: "Say what happened." };

  const rawKind = String(formData.get("kind") ?? "note") as InteractionKind;
  const kind = INTERACTION_KINDS.includes(rawKind) ? rawKind : "note";
  // Blank date → today (the column default). A future date is allowed (logging a
  // scheduled touch is a valid use), so we don't clamp it.
  const happenedOn = str(formData.get("happened_on")) || null;

  const { error } = await ctx.supabase.from("contact_interactions").insert({
    contact_id: contactId,
    kind,
    summary,
    ...(happenedOn ? { happened_on: happenedOn } : {}),
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/comms/${contactId}`);
  return { ok: true, message: "Interaction logged." };
}

export async function deleteInteraction(
  interactionId: string,
  contactId: string
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");
  const { error } = await ctx.supabase
    .from("contact_interactions")
    .delete()
    .eq("id", interactionId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/comms/${contactId}`);
  return { ok: true, message: "Interaction removed." };
}

// ---- Internal comms: meetings + notes ---------------------------------------
//
// The inward-facing half of the section. Everything above this line is about
// people OUTSIDE the company; everything below is about us.

/** Record a meeting that happened. Create and edit share this action. */
export async function saveMeeting(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");

  const id = String(formData.get("id") ?? "").trim() || null;
  // No required fields (create-flow rule) — fall back so NOT NULL stays valid.
  const title =
    String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled meeting";
  const heldOn = String(formData.get("held_on") ?? "").trim() || todayInIstanbul();
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const attendees = formData
    .getAll("attendees")
    .map((v) => String(v))
    .filter(Boolean);

  const fields = { title, held_on: heldOn, attendees, summary, notes };

  const { error } = id
    ? await ctx.supabase.from("comms_meetings").update(fields).eq("id", id)
    : await ctx.supabase
        .from("comms_meetings")
        .insert({ ...fields, is_demo: ctx.showcase, created_by: ctx.userId });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  return { ok: true, message: id ? "Meeting updated." : "Meeting recorded." };
}

export async function deleteMeeting(meetingId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");

  const { error } = await ctx.supabase
    .from("comms_meetings")
    .delete()
    .eq("id", meetingId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  return { ok: true, message: "Meeting removed." };
}

/**
 * Jot something down. One field on purpose — the moment this needs a title and
 * a category, people stop using it and the thing gets forgotten instead.
 */
export async function addNote(body: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");

  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, message: "Nothing to note." };

  const { error } = await ctx.supabase.from("comms_notes").insert({
    body: text,
    is_demo: ctx.showcase,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  return { ok: true, message: "Noted." };
}

export async function setNotePinned(
  noteId: string,
  pinned: boolean
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");

  const { error } = await ctx.supabase
    .from("comms_notes")
    .update({ pinned })
    .eq("id", noteId);
  if (error) return { ok: false, message: error.message };

  // No revalidatePath: the pin is optimistic in the client and LiveRefresh
  // covers other tabs. Re-rendering the whole section on a pin toggle would
  // make it feel slower than it is.
  return { ok: true, message: pinned ? "Pinned." : "Unpinned." };
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("comms");

  const { error } = await ctx.supabase
    .from("comms_notes")
    .delete()
    .eq("id", noteId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/comms");
  return { ok: true, message: "Note removed." };
}
