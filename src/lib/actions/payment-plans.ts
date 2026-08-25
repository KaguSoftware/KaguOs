"use server";

import {
  INVOICE_CURRENCIES,
  INSTALLMENT_STATUSES,
  PAYMENT_CADENCES,
  PAYMENT_PLAN_KINDS,
  PAYMENT_PLAN_STATUSES,
  type InstallmentStatus,
  type InvoiceCurrency,
  type PaymentCadence,
  type PaymentPlanKind,
  type PaymentPlanStatus,
} from "@/lib/types";
import type { ActionResult } from "@/lib/actions/account";
import {
  amountOf,
  countOf,
  date,
  guard,
  revalidateBoth,
  text,
} from "@/lib/actions/portal-write";
import {
  countBetween,
  layOutSchedule,
  MAX_PAYMENTS,
  paymentDate,
} from "@/lib/payments";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Payment plans — the agreement behind the invoices (0075 §2).
 *
 * ── What "creating a plan" actually does ───────────────────────────────────
 *
 * It writes the agreement AND the payments it implies, in one go. That is the
 * feature: "twelve months at $1,200 from March" is a sentence somebody says in
 * a meeting, and the whole point of this surface is that it becomes twelve
 * dated rows without anybody typing twelve dates. Generation happens once, at
 * creation, and the rows are then ordinary editable records — because a real
 * schedule always ends up with one payment moved, one split, one waived, and a
 * plan that regenerated itself from its own parameters would eat those edits
 * every time somebody fixed a typo in the title.
 *
 * ── The cap ────────────────────────────────────────────────────────────────
 *
 * 120 payments. Ten years of monthly, and past it somebody has mistyped a
 * figure into a field that writes a row per unit — the one shape of mistake in
 * this file that costs more than an apology.
 *
 * Everything here goes through the same `guard()` as the milestone and invoice
 * actions: `can_write('work') OR can_write('management')`, clients refused
 * outright, showcase refused. See `portal-write.ts`.
 */

/* ── Untrusted strings, narrowed ──────────────────────────────────────────── */

function asKind(value: unknown): PaymentPlanKind | null {
  return PAYMENT_PLAN_KINDS.includes(value as PaymentPlanKind)
    ? (value as PaymentPlanKind)
    : null;
}

function asCadence(value: unknown): PaymentCadence | null {
  return PAYMENT_CADENCES.includes(value as PaymentCadence)
    ? (value as PaymentCadence)
    : null;
}

function asPlanStatus(value: unknown): PaymentPlanStatus | null {
  return PAYMENT_PLAN_STATUSES.includes(value as PaymentPlanStatus)
    ? (value as PaymentPlanStatus)
    : null;
}

function asInstallmentStatus(value: unknown): InstallmentStatus | null {
  return INSTALLMENT_STATUSES.includes(value as InstallmentStatus)
    ? (value as InstallmentStatus)
    : null;
}

function asCurrency(value: unknown): InvoiceCurrency | null {
  return INVOICE_CURRENCIES.includes(value as InvoiceCurrency)
    ? (value as InvoiceCurrency)
    : null;
}

/* ── Plans ────────────────────────────────────────────────────────────────── */

/**
 * Create a plan and lay out its payments.
 *
 * The form offers two ways to say the same thing and this reconciles them:
 * an amount PER payment ("$1,200 a month"), or a TOTAL to divide ("$9,000 in
 * three"). Given both, the per-payment figure wins — it is the more specific
 * statement, and it is the one the client was quoted.
 *
 * Given neither, the plan is still created with no payments in it. That is a
 * legitimate half-step: a bespoke schedule where every payment differs gets
 * built row by row from the panel, and refusing to save the agreement until
 * somebody invents a number would just teach them to type one in.
 */
export async function createPaymentPlan(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const projectId = String(formData.get("project_id") ?? "");
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const title = text(formData.get("title"), 160);
  if (!title) return { ok: false, message: "A payment plan needs a name." };

  const kind = asKind(formData.get("kind")) ?? "installments";
  const cadence = asCadence(formData.get("cadence")) ?? "monthly";
  const currency = asCurrency(formData.get("currency")) ?? "USD";
  const startsOn = date(formData.get("starts_on")) ?? todayInIstanbul();
  const endsOn = date(formData.get("ends_on"));
  const status = asPlanStatus(formData.get("status")) ?? "active";

  if (endsOn && endsOn < startsOn) {
    return { ok: false, message: "The end date is before the start date." };
  }

  const each = amountOf(formData.get("amount_each"));
  const total = amountOf(formData.get("total_amount"));

  // How many payments to lay out, in order of how explicitly it was said:
  // a typed count, then an end date, then the default for this kind of plan.
  const count =
    countOf(formData.get("count"), MAX_PAYMENTS) ??
    (endsOn ? countBetween(startsOn, endsOn, cadence) : null) ??
    (kind === "recurring" ? 12 : 1);

  // One function, shared with the form's preview, so what gets written is
  // exactly what the producer was shown before they pressed the button.
  const schedule = layOutSchedule({ startsOn, cadence, count, each, total });
  const amounts = schedule.map((row) => row.amount);

  const { data: plan, error } = await ctx.supabase
    .from("project_payment_plans")
    .insert({
      project_id: projectId,
      title,
      kind,
      currency,
      // The headline figure, and only when it is true of every payment. A
      // schedule split off a total ends on an odd cent, so it has no single
      // "each" to quote and the plan says so by leaving this null.
      amount_each:
        each ?? (amounts.length > 0 && new Set(amounts).size === 1 ? amounts[0] : null),
      cadence,
      starts_on: startsOn,
      ends_on: endsOn,
      status,
      note: text(formData.get("note"), 2000),
      visible_to_client: formData.get("visible_to_client") !== null,
      created_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!plan) return { ok: false, message: "The plan could not be saved." };

  if (schedule.length > 0) {
    const { error: rowsError } = await ctx.supabase
      .from("project_payment_installments")
      .insert(
        schedule.map((row) => ({
          plan_id: plan.id,
          project_id: projectId,
          seq: row.seq,
          amount: row.amount,
          due_on: row.due_on,
        }))
      );
    // The plan itself is already saved, so this is reported rather than rolled
    // back: an agreement with no schedule under it is recoverable from the
    // panel in ten seconds, and deleting the row the producer just wrote is
    // not what they want to happen next.
    if (rowsError) {
      revalidateBoth(projectId);
      return {
        ok: false,
        message: `Plan saved, but its payments could not be laid out: ${rowsError.message}`,
      };
    }
  }

  revalidateBoth(projectId);
  return {
    ok: true,
    message:
      schedule.length === 0
        ? "Plan saved. Add its payments from the panel."
        : status === "draft"
          ? `Saved as a draft — ${schedule.length} payments laid out, none of them visible to the client yet.`
          : `Plan added — ${schedule.length} payments laid out.`,
    id: plan.id,
  };
}

export type PaymentPlanInput = {
  title: string;
  kind?: string;
  currency?: string;
  amount_each?: string;
  cadence?: string;
  starts_on?: string;
  ends_on?: string;
  status?: string;
  note?: string;
  visible_to_client?: boolean;
};

/**
 * Edit the agreement — NOT the payments under it.
 *
 * Changing a plan's start date or cadence deliberately leaves its existing
 * schedule alone. Re-laying it out would silently move dates a client has
 * already been shown, and the case where that is what somebody meant ("we're
 * pushing everything back a month") is rare enough to be worth doing payment by
 * payment, where they can see what they are moving.
 */
export async function updatePaymentPlan(
  projectId: string,
  planId: string,
  input: PaymentPlanInput
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const title = text(input.title, 160);
  if (!title) return { ok: false, message: "A payment plan needs a name." };

  const startsOn = date(input.starts_on) ?? todayInIstanbul();
  const endsOn = date(input.ends_on);
  if (endsOn && endsOn < startsOn) {
    return { ok: false, message: "The end date is before the start date." };
  }

  const { error } = await ctx.supabase
    .from("project_payment_plans")
    .update({
      title,
      kind: asKind(input.kind) ?? "installments",
      currency: asCurrency(input.currency) ?? "USD",
      amount_each: amountOf(input.amount_each),
      cadence: asCadence(input.cadence) ?? "monthly",
      starts_on: startsOn,
      ends_on: endsOn,
      status: asPlanStatus(input.status) ?? "active",
      note: text(input.note, 2000),
      visible_to_client: input.visible_to_client ?? true,
    })
    .eq("id", planId)
    // Belt and braces on top of RLS, same as every other write here: the policy
    // approves the UPDATE on the writer's section access alone, so without this
    // a caller could pass any plan id and edit another project's agreement.
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Saved." };
}

export async function deletePaymentPlan(
  projectId: string,
  planId: string
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  // The payments go with it, by `on delete cascade` (0075 §2b) rather than by a
  // second statement here — a half-deleted plan would leave orphaned rows that
  // the portal has no way to render.
  const { error } = await ctx.supabase
    .from("project_payment_plans")
    .delete()
    .eq("id", planId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Payment plan removed." };
}

/* ── The payments themselves ──────────────────────────────────────────────── */

export type InstallmentInput = {
  label?: string;
  amount: string;
  due_on?: string;
  status?: string;
  paid_on?: string;
  note?: string;
};

export async function updateInstallment(
  projectId: string,
  installmentId: string,
  input: InstallmentInput
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const amount = amountOf(input.amount);
  if (amount === null) return { ok: false, message: "Enter an amount above zero." };
  const dueOn = date(input.due_on);
  if (!dueOn) return { ok: false, message: "A payment needs a due date." };

  const status = asInstallmentStatus(input.status) ?? "scheduled";
  const paidOn = date(input.paid_on);

  const { error } = await ctx.supabase
    .from("project_payment_installments")
    .update({
      label: text(input.label, 160),
      amount,
      due_on: dueOn,
      status,
      // Same rule as a paid invoice and a done phase: a settled row with no
      // date is one the client cannot reconcile against their bank. Stamped
      // when missing, never overwritten.
      paid_on: status === "paid" ? (paidOn ?? todayInIstanbul()) : null,
      note: text(input.note, 2000),
    })
    .eq("id", installmentId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Saved." };
}

/**
 * "That one's landed."
 *
 * Its own action rather than a trip through the editor, because it is what
 * somebody does to this table ninety times out of a hundred — once a month,
 * per plan, while looking at a bank statement in another window.
 */
export async function markInstallmentPaid(
  projectId: string,
  installmentId: string,
  paid: boolean
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { error } = await ctx.supabase
    .from("project_payment_installments")
    .update(
      paid
        ? { status: "paid", paid_on: todayInIstanbul() }
        : { status: "scheduled", paid_on: null }
    )
    .eq("id", installmentId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: paid ? "Marked as paid." : "Marked as unpaid." };
}

export async function deleteInstallment(
  projectId: string,
  installmentId: string
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { error } = await ctx.supabase
    .from("project_payment_installments")
    .delete()
    .eq("id", installmentId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return { ok: true, message: "Payment removed." };
}

/**
 * Add more payments to the end of a plan.
 *
 * The reason an open-ended retainer is possible at all. A plan with no end date
 * is laid out a year at a time — generating rows forever would put a schedule
 * in the portal stretching past the point anybody has agreed to — and this is
 * how the next year gets added when the first runs out.
 *
 * Continues from the LAST existing payment rather than from the plan's start,
 * so extending a schedule somebody has already shuffled by hand doesn't write
 * rows on top of dates that have moved.
 */
export async function extendPaymentPlan(
  projectId: string,
  planId: string,
  count: number
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const howMany = countOf(count, 60);
  if (howMany === null) return { ok: false, message: "How many payments?" };

  const { data: plan, error: planError } = await ctx.supabase
    .from("project_payment_plans")
    .select("id, cadence, amount_each, starts_on")
    .eq("id", planId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (planError) return { ok: false, message: planError.message };
  if (!plan) return { ok: false, message: "That plan is gone." };

  const { data: rows, error: rowsError } = await ctx.supabase
    .from("project_payment_installments")
    .select("seq, amount, due_on")
    .eq("plan_id", planId)
    .eq("project_id", projectId)
    .order("due_on", { ascending: false })
    .order("seq", { ascending: false })
    .limit(1);
  if (rowsError) return { ok: false, message: rowsError.message };

  const last = rows?.[0];
  const cadence = (plan.cadence as PaymentCadence) ?? "monthly";
  const amount =
    (plan.amount_each === null || plan.amount_each === undefined
      ? null
      : Number(plan.amount_each)) ??
    (last ? Number(last.amount) : null);
  if (!amount || amount <= 0) {
    return {
      ok: false,
      message: "This plan has no per-payment amount to repeat — add one by hand.",
    };
  }

  const anchor = last?.due_on ?? plan.starts_on;
  const startSeq = (last?.seq ?? 0) + 1;
  // `anchor` is an existing payment when there is one, so the new ones start at
  // index 1 off it; on an empty plan the anchor is the start date itself and
  // index 0 is the first payment.
  const offset = last ? 1 : 0;

  const { error } = await ctx.supabase
    .from("project_payment_installments")
    .insert(
      Array.from({ length: howMany }, (_unused, index) => ({
        plan_id: planId,
        project_id: projectId,
        seq: startSeq + index,
        amount,
        due_on: paymentDate(anchor, cadence, index + offset),
      }))
    );
  if (error) return { ok: false, message: error.message };

  revalidateBoth(projectId);
  return {
    ok: true,
    message: `${howMany} more ${howMany === 1 ? "payment" : "payments"} scheduled.`,
  };
}
