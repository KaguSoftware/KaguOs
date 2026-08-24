"use server";

import { revalidatePath } from "next/cache";
import {
  canWrite,
  getSessionContext,
  isClient,
  type SessionContext,
} from "@/lib/data/session";
import {
  INVOICE_CURRENCIES,
  INVOICE_STATUSES,
  MILESTONE_STATUSES,
  type InvoiceCurrency,
  type InvoiceStatus,
  type MilestoneStatus,
} from "@/lib/types";
import type { ActionResult } from "@/lib/actions/account";
import { todayInIstanbul } from "@/lib/utils";

/**
 * What the team publishes TO a client — the milestones and invoices behind the
 * portal's progress and finance pages (0074).
 *
 * ── The one guard, and why it is written here rather than reused ────────────
 *
 * Every action opens with `guard()`, which mirrors the RLS policy exactly:
 * `can_write('work') OR can_write('management')`. Neither `blockIfReadOnly`
 * variant expresses that — they each take ONE section — and calling
 * blockIfReadOnly("work") would refuse the finance person whose whole job this
 * is, with a message about a section they can see perfectly well.
 *
 * A client is refused in its own arm, above everything. It should be
 * unreachable (these actions are imported only by a page inside the teammate
 * shell), and the database refuses it independently — but a client account
 * writing its own milestones would be the portal telling a customer a thing the
 * customer told it, which is worth two lines to make impossible.
 */

type Guarded =
  | { ctx: SessionContext; stop?: undefined }
  | { ctx?: undefined; stop: { ok: false; message: string } };

async function guard(projectId: string): Promise<Guarded> {
  if (!projectId) return { stop: { ok: false, message: "Missing project." } };

  const ctx = await getSessionContext();

  if (isClient(ctx)) {
    return { stop: { ok: false, message: "That isn't something your account can do." } };
  }
  if (ctx.showcase) {
    return {
      stop: {
        ok: false,
        message: "Showcase mode is read-only — exit showcase to make changes.",
      },
    };
  }
  if (!canWrite(ctx, "work") && !canWrite(ctx, "management")) {
    return {
      stop: {
        ok: false,
        message: "You need edit access to Work or Management to publish this.",
      },
    };
  }
  return { ctx };
}

/**
 * Both sides of every one of these rows, refreshed together.
 *
 * A milestone marked done changes what the CLIENT sees, and the client's pages
 * are server-rendered — revalidating only the member's own route would leave
 * the portal reading a stale plan until it happened to re-render. The portal's
 * three pages are listed individually because they are separate routes with
 * separate caches; `/portal` is not a prefix wildcard.
 */
function revalidateBoth(projectId: string) {
  revalidatePath(`/work/projects/${projectId}/client`);
  revalidatePath(`/work/projects/${projectId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/progress");
  revalidatePath("/portal/finance");
}

/* ── Small validators, so a direct POST can't write nonsense ──────────────── */

/**
 * Server actions are reachable by direct POST, not only through the form, so
 * every enum arrives as an untrusted string. The database would refuse a bad
 * one via its check constraint — this turns that 400 into a sentence, and stops
 * the round-trip.
 */
function asMilestoneStatus(value: unknown): MilestoneStatus | null {
  return MILESTONE_STATUSES.includes(value as MilestoneStatus)
    ? (value as MilestoneStatus)
    : null;
}

function asInvoiceStatus(value: unknown): InvoiceStatus | null {
  return INVOICE_STATUSES.includes(value as InvoiceStatus)
    ? (value as InvoiceStatus)
    : null;
}

function asCurrency(value: unknown): InvoiceCurrency | null {
  return INVOICE_CURRENCIES.includes(value as InvoiceCurrency)
    ? (value as InvoiceCurrency)
    : null;
}

/** Trimmed, capped, and null rather than "" — the columns are nullable text. */
function text(value: unknown, max: number): string | null {
  const trimmed = String(value ?? "").trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

/** `YYYY-MM-DD` or null. Anything else is dropped rather than guessed at. */
function date(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/* ── Milestones ───────────────────────────────────────────────────────────── */

export type MilestoneInput = {
  title: string;
  detail?: string;
  status?: string;
  target_on?: string;
  done_on?: string;
  visible_to_client?: boolean;
};

/**
 * Creating goes through a FormData action on a dedicated /new page, while
 * editing goes through the object-argument actions below.
 *
 * That split is the house rule, not an accident: an "add new X" in KaguOs is
 * always a spacious surface of its own, because the moment of writing something
 * down is the moment it deserves room — and a milestone is a sentence a
 * customer will read. Editing one afterwards is usually flipping a status while
 * looking at the rest of the plan, which a page navigation would hide.
 */
export async function createMilestone(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const projectId = String(formData.get("project_id") ?? "");
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const title = text(formData.get("title"), 160);
  if (!title) return { ok: false, message: "A milestone needs a title." };

  // Append: read the current tail rather than counting, so deleting one in the
  // middle doesn't put the next new row on top of an existing sort value.
  const { data: last } = await ctx.supabase
    .from("project_milestones")
    .select("sort")
    .eq("project_id", projectId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await ctx.supabase
    .from("project_milestones")
    .insert({
      project_id: projectId,
      title,
      detail: text(formData.get("detail"), 4000),
      status: asMilestoneStatus(formData.get("status")) ?? "planned",
      target_on: date(formData.get("target_on")),
      sort: (last?.sort ?? -1) + 1,
      // A checkbox absent from FormData means unchecked, which is the one
      // encoding where "the field wasn't submitted" and "the user said no" are
      // the same thing — so this reads the presence, not a parsed value.
      visible_to_client: formData.get("visible_to_client") !== null,
      created_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Milestone added.", id: data?.id };
}

export async function updateMilestone(
  projectId: string,
  milestoneId: string,
  input: MilestoneInput
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const title = text(input.title, 160);
  if (!title) return { ok: false, message: "A milestone needs a title." };

  const status = asMilestoneStatus(input.status) ?? "planned";
  const doneOn = date(input.done_on);

  const { error } = await ctx.supabase
    .from("project_milestones")
    .update({
      title,
      detail: text(input.detail, 4000),
      status,
      target_on: date(input.target_on),
      // Marking a step done without typing a date is the common case, and a
      // "done" milestone with no date reads on the client's timeline as if we
      // are not sure when it happened. Filled in from today, but never
      // overwritten — an explicitly back-dated completion survives.
      done_on: status === "done" ? (doneOn ?? todayInIstanbul()) : null,
      visible_to_client: input.visible_to_client ?? true,
    })
    .eq("id", milestoneId)
    // Belt and braces on top of RLS: without it a caller could pass any row id
    // and edit another project's milestone, because the policy approves the
    // UPDATE on the writer's section access alone.
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Saved." };
}

export async function deleteMilestone(
  projectId: string,
  milestoneId: string
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { error } = await ctx.supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Milestone removed." };
}

/**
 * Move one milestone up or down.
 *
 * A swap of two `sort` values rather than a renumber of the whole list: the
 * plan is what the client reads top to bottom, two writes is cheap, and
 * renumbering means every row in the table changes every time somebody nudges
 * one — which realtime then broadcasts to every open portal.
 */
export async function moveMilestone(
  projectId: string,
  milestoneId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { data: rows, error: readError } = await ctx.supabase
    .from("project_milestones")
    .select("id, sort")
    .eq("project_id", projectId)
    .order("sort")
    .order("created_at");
  if (readError) return { ok: false, message: readError.message };

  const list = rows ?? [];
  const index = list.findIndex((row) => row.id === milestoneId);
  if (index === -1) return { ok: false, message: "That milestone is gone." };

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) return { ok: true, message: "" };

  const a = list[index];
  const b = list[swapWith];
  // Two rows can share a sort value (both default to 0 before anybody
  // reorders), and swapping equal numbers is a no-op that looks like a broken
  // button. Fall back to their positions when that happens.
  const aSort = a.sort === b.sort ? swapWith : b.sort;
  const bSort = a.sort === b.sort ? index : a.sort;

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    ctx.supabase
      .from("project_milestones")
      .update({ sort: aSort })
      .eq("id", a.id)
      .eq("project_id", projectId),
    ctx.supabase
      .from("project_milestones")
      .update({ sort: bSort })
      .eq("id", b.id)
      .eq("project_id", projectId),
  ]);
  if (e1 || e2) return { ok: false, message: (e1 ?? e2)!.message };

  revalidateBoth(projectId);
  return { ok: true, message: "" };
}

/* ── Invoices ─────────────────────────────────────────────────────────────── */

export type InvoiceInput = {
  number: string;
  title?: string;
  amount: string;
  currency?: string;
  issued_on?: string;
  due_on?: string;
  status?: string;
  paid_on?: string;
  note?: string;
};

function amountOf(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

export async function createInvoice(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const projectId = String(formData.get("project_id") ?? "");
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const number = text(formData.get("number"), 40);
  if (!number) return { ok: false, message: "An invoice needs a number." };
  const amount = amountOf(formData.get("amount"));
  if (amount === null) return { ok: false, message: "Enter an amount above zero." };

  const status = asInvoiceStatus(formData.get("status")) ?? "draft";
  const paidOn = date(formData.get("paid_on"));

  const { data, error } = await ctx.supabase
    .from("project_invoices")
    .insert({
      project_id: projectId,
      number,
      title: text(formData.get("title"), 200),
      amount,
      currency: asCurrency(formData.get("currency")) ?? "USD",
      issued_on: date(formData.get("issued_on")) ?? todayInIstanbul(),
      due_on: date(formData.get("due_on")),
      status,
      paid_on: status === "paid" ? (paidOn ?? todayInIstanbul()) : null,
      note: text(formData.get("note"), 2000),
      created_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return {
    ok: true,
    message:
      status === "draft"
        ? "Saved as a draft — the client can't see it yet."
        : "Invoice added.",
    id: data?.id,
  };
}

export async function updateInvoice(
  projectId: string,
  invoiceId: string,
  input: InvoiceInput
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const number = text(input.number, 40);
  if (!number) return { ok: false, message: "An invoice needs a number." };
  const amount = amountOf(input.amount);
  if (amount === null) return { ok: false, message: "Enter an amount above zero." };

  const status = asInvoiceStatus(input.status) ?? "draft";
  const paidOn = date(input.paid_on);

  const { error } = await ctx.supabase
    .from("project_invoices")
    .update({
      number,
      title: text(input.title, 200),
      amount,
      currency: asCurrency(input.currency) ?? "USD",
      issued_on: date(input.issued_on) ?? todayInIstanbul(),
      due_on: date(input.due_on),
      status,
      // Same reasoning as a done milestone: "paid" with no date is a row the
      // client cannot reconcile. Stamped when it's missing, never overwritten.
      paid_on: status === "paid" ? (paidOn ?? todayInIstanbul()) : null,
      note: text(input.note, 2000),
    })
    .eq("id", invoiceId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Saved." };
}

export async function deleteInvoice(
  projectId: string,
  invoiceId: string
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { error } = await ctx.supabase
    .from("project_invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Invoice removed." };
}
