import "server-only";
import { getIntakePack } from "@/lib/data/intake";
import {
  getPaymentInstallments,
  getPaymentPlans,
  getProjectInvoices,
  getProjectMilestones,
  invoiceTotals,
  milestoneProgress,
  planSummary,
} from "@/lib/data/portal";
import type { SessionContext } from "@/lib/data/session";
import { absoluteUrl } from "@/lib/email/config";
import type { ClientEmailKind } from "@/lib/email/kinds";
import {
  financeReminderEmail,
  inputsReminderEmail,
  progressUpdateEmail,
  type ClientEmail,
  type UnpaidInvoiceLine,
} from "@/lib/email/templates";
import { pick, type Locale } from "@/lib/locale";
import type { ProjectPaymentInstallment } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * What each of the three client emails says, assembled from the database.
 *
 * ── Why this is not inside the server action ───────────────────────────────
 *
 * Because "who may send this" and "what does it say" are two different
 * questions, and only the first one is about the person pressing the button.
 * `actions/client-email.ts` answers the first — guard, recipients, transport,
 * the sentence that comes back in a toast — and reads as a door. This answers
 * the second and reads as a query.
 *
 * The split is what makes an email inspectable without sending one: a preview,
 * a test send to an internal address, or a future digest can call these and get
 * BYTE-IDENTICAL output to what a customer receives, because it is the same
 * function rather than a second implementation that drifts the first time a
 * template gains a field. A `"use server"` module cannot be used that way —
 * every export in one becomes a callable endpoint, so a builder taking a
 * session context could not live there even if it wanted to.
 *
 * ── One rule holds across all three ────────────────────────────────────────
 *
 * The caller is a MEMBER, and RLS hands a member more than it hands a client.
 * Every builder below therefore filters to what the customer can actually see —
 * client-visible phases, published plans, non-draft invoices — because an email
 * quoting a row the portal is still hiding sends a client to a link that
 * disagrees with the message that brought them there.
 */

/** The columns of `projects` an email needs. Read once by the caller. */
export type MailableProject = {
  id: string;
  name: string;
  intake_pack: string | null;
};

/**
 * "Your input pack is still open".
 *
 * The outstanding list is built from the same `buildChecks` pass the client's
 * own checklist renders, so the email cannot name a section the portal thinks
 * is finished. Optional cards are excluded from both the meter and the list,
 * exactly as `progressOf` excludes them — a client should not be chased for the
 * sub-recipes their business does not have.
 */
async function inputsReminder(
  ctx: SessionContext,
  project: MailableProject,
  locale: Locale,
  note: string | null
): Promise<ClientEmail> {
  const pack = await getIntakePack(ctx, project.id, project.intake_pack);

  return inputsReminderEmail({
    locale,
    projectName: project.name,
    done: pack.progress.done,
    total: pack.progress.total,
    outstanding: pack.checks
      .filter((check) => !check.ok && !check.optional)
      .map((check) => pick(locale, check.label, check.labelAr)),
    note,
    url: absoluteUrl(`/portal/inputs/${project.id}`),
  });
}

/**
 * "Progress has been updated".
 *
 * Reads the same numbers the client's progress page will show them when they
 * follow the link: `milestoneProgress` over the CLIENT-VISIBLE phases only, so
 * an email can never quote a percentage that includes a phase the portal is
 * still hiding.
 */
async function progressUpdate(
  ctx: SessionContext,
  project: MailableProject,
  locale: Locale,
  note: string | null
): Promise<ClientEmail> {
  const milestones = await getProjectMilestones(ctx, [project.id]);
  const progress = milestoneProgress(
    milestones.filter((milestone) => milestone.visible_to_client)
  );

  return progressUpdateEmail({
    locale,
    projectName: project.name,
    pct: progress.pct,
    done: progress.done,
    total: progress.total,
    // Phase titles are written once, in the language the plan was written in —
    // unlike a pack question they carry no Arabic twin, so they travel as-is.
    nextTitle: progress.next?.title ?? null,
    blocked: progress.blocked.map((milestone) => milestone.title),
    note,
    url: absoluteUrl("/portal/progress"),
  });
}

/**
 * "A payment is due".
 *
 * ── The two filters that are not optional ──────────────────────────────────
 *
 * `visible_to_client` and a status of `active`, applied to the plans by hand.
 * On the CLIENT's own finance page the first of those is done by RLS (0075 §2c)
 * and the page only writes the second; here the caller is a member, who is
 * given every plan on the project including the drafts and the ones nobody has
 * published yet. Left unfiltered this email would quote a schedule the client
 * cannot open — and the button under it goes to the page that would refuse to
 * show it.
 *
 * Invoices need no such filter: `invoiceTotals` already drops drafts and voids
 * on both sides of the wall, which is exactly why the two screens agree.
 */
async function financeReminder(
  ctx: SessionContext,
  project: MailableProject,
  locale: Locale,
  note: string | null
): Promise<ClientEmail> {
  const today = todayInIstanbul();
  const [invoices, plans, installments] = await Promise.all([
    getProjectInvoices(ctx, [project.id]),
    getPaymentPlans(ctx, [project.id]),
    getPaymentInstallments(ctx, [project.id]),
  ]);

  const totals = invoiceTotals(invoices, today);

  // "Overdue" is derived, not stored: sent, dated, and that date has passed.
  // Written the same way the portal's invoice table writes it so the email and
  // the page it links to cannot disagree about which row is late.
  const unpaid: UnpaidInvoiceLine[] = invoices
    .filter((invoice) => invoice.status === "sent")
    .map((invoice) => ({
      number: invoice.number,
      title: invoice.title,
      amount: invoice.amount,
      currency: invoice.currency,
      dueOn: invoice.due_on,
      overdue: invoice.due_on !== null && invoice.due_on < today,
    }))
    // Soonest due first, and an undated invoice last: a bill with no date is
    // the one nobody is waiting on, so it must not head a list whose point is
    // what to pay next.
    .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));

  const live = plans.filter(
    (plan) => plan.visible_to_client && plan.status === "active"
  );
  const byPlan = new Map<string, ProjectPaymentInstallment[]>();
  for (const plan of live) byPlan.set(plan.id, []);
  for (const payment of installments) byPlan.get(payment.plan_id)?.push(payment);
  const summaries = live.map((plan) =>
    planSummary(plan, byPlan.get(plan.id) ?? [], today)
  );

  // A client can be on two schedules at once (a build fee and a retainer). The
  // email carries ONE meter, and the plan it belongs to is the one the next
  // payment falls under — that is the schedule the reader is being written to
  // about. With nothing left to pay anywhere, the first published plan stands
  // in, so a finished plan still shows its own 100%.
  const withNext = summaries.filter((summary) => summary.next);
  withNext.sort((a, b) => a.next!.due_on.localeCompare(b.next!.due_on));
  const primary = withNext[0] ?? summaries[0] ?? null;

  return financeReminderEmail({
    locale,
    projectName: project.name,
    outstanding: totals.outstanding,
    overdue: totals.overdue,
    paid: totals.paid,
    unpaid,
    plan: primary
      ? {
          title: primary.plan.title,
          currency: primary.plan.currency,
          pct: primary.pct,
          paidCount: primary.paidCount,
          count: primary.count,
          paid: primary.paid,
          total: primary.total,
        }
      : null,
    next: primary?.next
      ? {
          amount: primary.next.amount,
          currency: primary.plan.currency,
          dueOn: primary.next.due_on,
          label: primary.next.label,
          overdue: primary.next.due_on < today,
        }
      : null,
    note,
    url: absoluteUrl("/portal/finance"),
  });
}

/** The dial. One kind in, one rendered email out. */
export async function buildClientEmail(
  ctx: SessionContext,
  project: MailableProject,
  kind: ClientEmailKind,
  locale: Locale,
  note: string | null
): Promise<ClientEmail> {
  switch (kind) {
    case "inputs":
      return inputsReminder(ctx, project, locale, note);
    case "progress":
      return progressUpdate(ctx, project, locale, note);
    case "finance":
      return financeReminder(ctx, project, locale, note);
  }
}
