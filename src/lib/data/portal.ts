import "server-only";
import { cache } from "react";
import { rowsOrThrow } from "@/lib/data/query";
import { requireClient, type SessionContext } from "@/lib/data/session";
import {
  getIntakeSummaries,
  getMyClientProjects,
  type ClientProjectRef,
  type IntakeSummary,
} from "@/lib/data/intake";
import {
  type InvoiceCurrency,
  type ProjectInvoice,
  type ProjectMilestone,
  type ProjectPaymentInstallment,
  type ProjectPaymentPlan,
} from "@/lib/types";

/**
 * The client portal's reads — the money and the plan (0074), plus the arithmetic
 * both the portal and the team's client-view page score them with.
 *
 * RLS decides what comes back. `project_milestones` hides anything not yet
 * published and `project_invoices` hides drafts, both in the policy rather than
 * here (0074 §3), so a member calling these functions correctly sees MORE than a
 * client does from the same code — which is the property that lets the team's
 * page and the portal share one summariser without either having to remember
 * which audience it is rendering for.
 *
 * Every function here takes explicit project ids and never derives them: the
 * tenant rule lives in session.ts and in the database, and a third copy in the
 * data layer is how the three end up disagreeing.
 */

export async function getProjectMilestones(
  ctx: SessionContext,
  projectIds: string[]
): Promise<ProjectMilestone[]> {
  if (projectIds.length === 0) return [];
  const rows = (await rowsOrThrow(
    ctx.supabase
      .from("project_milestones")
      .select("*")
      .in("project_id", projectIds)
      .order("sort")
      .order("created_at"),
    "project_milestones"
  )) as ProjectMilestone[];
  // `numeric` arrives from PostgREST as a STRING, same as an invoice amount.
  // Coerced once, here, because these two feed arithmetic in three different
  // components and `"20" * 0.8` is not a number anybody wants on a client's bar.
  return rows.map((row) => ({
    ...row,
    weight: Number(row.weight ?? 0),
    completion: Number(row.completion ?? 0),
  }));
}

export async function getProjectInvoices(
  ctx: SessionContext,
  projectIds: string[]
): Promise<ProjectInvoice[]> {
  if (projectIds.length === 0) return [];
  const rows = (await rowsOrThrow(
    ctx.supabase
      .from("project_invoices")
      .select("*")
      .in("project_id", projectIds)
      .order("issued_on", { ascending: false })
      .order("created_at", { ascending: false }),
    "project_invoices"
  )) as ProjectInvoice[];
  // `numeric` arrives from PostgREST as a STRING — Postgres will not risk a
  // float rounding a money column on the way out. Coerced once, here, so no
  // caller has to remember that `amount + amount` would otherwise concatenate.
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/* ── Money, added up honestly ─────────────────────────────────────────────── */

/**
 * Invoice totals, PER CURRENCY.
 *
 * Deliberately not converted to one number. The app's other totals go through
 * `toTRY()` and Kagu's manually-entered `fx_rates`, which is right for Kagu's
 * own books and wrong here for two reasons: the rate is Kagu's internal
 * bookkeeping assumption rather than anything the client agreed to, and a
 * client billed in dinars who is shown a lira figure has been handed a number
 * they cannot check against their own bank statement. So a client billed in two
 * currencies sees two lines, and neither of them is an estimate.
 */
export type MoneyByCurrency = Partial<Record<InvoiceCurrency, number>>;

export type InvoiceTotals = {
  billed: MoneyByCurrency;
  paid: MoneyByCurrency;
  /** Sent, not yet paid, not void — the number that answers "what do I owe?". */
  outstanding: MoneyByCurrency;
  /** Outstanding whose `due_on` is in the past. */
  overdue: MoneyByCurrency;
  overdueCount: number;
};

function add(bucket: MoneyByCurrency, currency: InvoiceCurrency, amount: number) {
  bucket[currency] = (bucket[currency] ?? 0) + amount;
}

export function invoiceTotals(
  invoices: ProjectInvoice[],
  /** Today in Istanbul — passed in so the caller reads the clock once. */
  today: string
): InvoiceTotals {
  const totals: InvoiceTotals = {
    billed: {},
    paid: {},
    outstanding: {},
    overdue: {},
    overdueCount: 0,
  };

  for (const invoice of invoices) {
    // A void invoice was withdrawn. It stays on the statement so that a client
    // who saw it once is not left wondering where it went, but it must not
    // move a single total — including "billed", which is the one people reach
    // for when they want a lifetime figure.
    if (invoice.status === "void") continue;
    // Drafts never reach a client (RLS), but a MEMBER reading this same
    // function does see them, and an unsent invoice is not yet a claim on
    // anybody. Excluded on both sides so the two screens agree.
    if (invoice.status === "draft") continue;

    add(totals.billed, invoice.currency, invoice.amount);

    if (invoice.status === "paid") {
      add(totals.paid, invoice.currency, invoice.amount);
      continue;
    }

    add(totals.outstanding, invoice.currency, invoice.amount);
    if (invoice.due_on && invoice.due_on < today) {
      add(totals.overdue, invoice.currency, invoice.amount);
      totals.overdueCount += 1;
    }
  }

  return totals;
}

/** Is this bucket worth rendering at all? */
export function hasMoney(bucket: MoneyByCurrency): boolean {
  return Object.values(bucket).some((value) => (value ?? 0) > 0.005);
}

/** Currency/amount pairs, largest first, for a stack of money lines. */
export function moneyLines(
  bucket: MoneyByCurrency
): { currency: InvoiceCurrency; amount: number }[] {
  return (Object.entries(bucket) as [InvoiceCurrency, number][])
    .filter(([, amount]) => amount > 0.005)
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amount]) => ({ currency, amount }));
}

/* ── Progress, as a weighted fraction ─────────────────────────────────────── */

export type MilestoneProgress = {
  total: number;
  done: number;
  /** The headline. Weighted when the plan carries weights — see below. */
  pct: number;
  /** The next thing that isn't finished — what a client actually came to read. */
  next: ProjectMilestone | null;
  blocked: ProjectMilestone[];
  /** True when at least one phase has been given a weight. */
  weighted: boolean;
  /** Sum of the weights. 100 when the plan adds up; the team's page says so. */
  allocated: number;
  /** Each phase's contribution to `pct`, in points, keyed by milestone id. */
  share: Map<string, number>;
};

/**
 * The build's headline, from its phases.
 *
 * ── The arithmetic ─────────────────────────────────────────────────────────
 *
 * Each phase carries a `weight` — what share of the whole build it is worth —
 * and a `completion` — how far through that phase we are. A phase contributes
 * `weight × completion / 100` points, so a 20% phase at 80% moves the bar by
 * 16. The headline is the sum of those points.
 *
 * ── Why the denominator is `max(allocated, 100)` and not `allocated` ───────
 *
 * Normalising by the weights actually handed out would make any plan reach 100%
 * as soon as everything IN it was done — including a plan with one 20% phase in
 * it because nobody has written the other four yet. A client would be told a
 * project was finished on the strength of an unfinished plan.
 *
 * Dividing by 100 instead means an under-allocated plan reads honestly low, and
 * the producer's own page carries the "80% still unallocated" warning that
 * explains why. Over-allocation (weights summing past 100, which is somebody
 * mid-edit) divides by the real total so the bar can never exceed 100%.
 *
 * ── Plans with no weights at all ───────────────────────────────────────────
 *
 * Every phase falls back to an equal share, which is exactly what this function
 * did before weights existed (0075 §1c) — with one improvement: a half-finished
 * phase now counts as half. Nobody's bar jumps on the day this deploys.
 *
 * A blocked phase is not special-cased in the percentage: it contributes
 * whatever it has actually completed and is surfaced separately, because "78%,
 * one thing blocked" is the honest sentence and a bar that quietly absorbs a
 * blockage is how a client finds out about it in a meeting instead.
 */
export function milestoneProgress(
  milestones: ProjectMilestone[]
): MilestoneProgress {
  const total = milestones.length;
  const done = milestones.filter((m) => m.status === "done").length;
  const allocated = milestones.reduce((sum, m) => sum + Number(m.weight ?? 0), 0);
  const weighted = allocated > 0;

  // Unweighted plans: every phase is worth one share of however many there are.
  const denominator = weighted ? Math.max(allocated, 100) : total;
  const share = new Map<string, number>();
  let points = 0;

  for (const milestone of milestones) {
    const weight = weighted ? Number(milestone.weight ?? 0) : 1;
    const completion =
      milestone.status === "done" ? 100 : Number(milestone.completion ?? 0);
    const contribution =
      denominator === 0 ? 0 : ((weight * completion) / 100 / denominator) * 100;
    share.set(milestone.id, contribution);
    points += contribution;
  }

  return {
    total,
    done,
    // Rounded once, at the end. Rounding each phase first is how five 6.6%
    // phases add up to 35% on a page that also says the parts are 7% each.
    pct: Math.max(0, Math.min(100, Math.round(points))),
    next:
      milestones.find((m) => m.status === "in_progress") ??
      milestones.find((m) => m.status !== "done") ??
      null,
    blocked: milestones.filter((m) => m.status === "blocked"),
    weighted,
    allocated: Math.round(allocated * 100) / 100,
    share,
  };
}

/* ── The payment plan ─────────────────────────────────────────────────────── */

export async function getPaymentPlans(
  ctx: SessionContext,
  projectIds: string[]
): Promise<ProjectPaymentPlan[]> {
  if (projectIds.length === 0) return [];
  const rows = (await rowsOrThrow(
    ctx.supabase
      .from("project_payment_plans")
      .select("*")
      .in("project_id", projectIds)
      .order("starts_on")
      .order("created_at"),
    "project_payment_plans"
  )) as ProjectPaymentPlan[];
  return rows.map((row) => ({
    ...row,
    amount_each: row.amount_each === null ? null : Number(row.amount_each),
  }));
}

/**
 * Every payment of every plan on these projects.
 *
 * Keyed on `project_id` rather than on plan ids so it is one round-trip
 * alongside the plans instead of a second wave that depends on the first. The
 * RLS policy still hides the payments of an unpublished plan from a client
 * (0075 §2c), so a client asking for a project's payments cannot get at a
 * schedule whose plan they cannot see.
 */
export async function getPaymentInstallments(
  ctx: SessionContext,
  projectIds: string[]
): Promise<ProjectPaymentInstallment[]> {
  if (projectIds.length === 0) return [];
  const rows = (await rowsOrThrow(
    ctx.supabase
      .from("project_payment_installments")
      .select("*")
      .in("project_id", projectIds)
      .order("due_on")
      .order("seq"),
    "project_payment_installments"
  )) as ProjectPaymentInstallment[];
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

export type PlanSummary = {
  plan: ProjectPaymentPlan;
  /** In due order, waived rows included — they stay on the schedule. */
  payments: ProjectPaymentInstallment[];
  /** Everything not waived. The plan's real value. */
  total: number;
  paid: number;
  /** Scheduled or invoiced — what is still to come. */
  remaining: number;
  overdue: number;
  overdueCount: number;
  count: number;
  paidCount: number;
  pct: number;
  /** The soonest payment still to be made. The one line a client wants. */
  next: ProjectPaymentInstallment | null;
};

/**
 * One plan, scored.
 *
 * A waived payment is dropped from every total but kept in the list, for the
 * same reason a void invoice stays on the statement: a client who saw a payment
 * once should not have to wonder where it went.
 *
 * "Overdue" here means the schedule said a date and it has passed — not that a
 * bill has gone unpaid. The two are separate on purpose: an unbilled payment
 * that has slipped is Kagu's problem to chase, and the portal words it that way
 * rather than dunning a client for an invoice nobody sent them.
 */
export function planSummary(
  plan: ProjectPaymentPlan,
  payments: ProjectPaymentInstallment[],
  today: string
): PlanSummary {
  let total = 0;
  let paid = 0;
  let remaining = 0;
  let overdue = 0;
  let overdueCount = 0;
  let count = 0;
  let paidCount = 0;
  let next: ProjectPaymentInstallment | null = null;

  for (const payment of payments) {
    if (payment.status === "waived") continue;
    count += 1;
    total += payment.amount;

    if (payment.status === "paid") {
      paid += payment.amount;
      paidCount += 1;
      continue;
    }

    remaining += payment.amount;
    if (!next || payment.due_on < next.due_on) next = payment;
    if (payment.due_on < today) {
      overdue += payment.amount;
      overdueCount += 1;
    }
  }

  return {
    plan,
    payments,
    total,
    paid,
    remaining,
    overdue,
    overdueCount,
    count,
    paidCount,
    pct: total <= 0 ? 0 : Math.min(100, Math.round((paid / total) * 100)),
    next,
  };
}

/** Every plan on a project, scored, most recently started first. */
export function planSummaries(
  plans: ProjectPaymentPlan[],
  byPlan: Map<string, ProjectPaymentInstallment[]>,
  today: string
): PlanSummary[] {
  return plans.map((plan) => planSummary(plan, byPlan.get(plan.id) ?? [], today));
}

/* ── One wave for the whole portal ────────────────────────────────────────── */

/**
 * Everything a portal page needs about a set of projects, fetched together.
 *
 * The dashboard, the finance page and the progress page all render across EVERY
 * business a client has, so each of them would otherwise pay one round-trip per
 * project per concern. One wave, sliced per project in memory — the same shape
 * the teammate dashboard uses, and for the same reason: what costs ~305ms is
 * the flight to the database, not the query.
 */
export type PortalData = {
  projects: ClientProjectRef[];
  intake: Map<string, IntakeSummary>;
  milestonesByProject: Map<string, ProjectMilestone[]>;
  invoicesByProject: Map<string, ProjectInvoice[]>;
  plansByProject: Map<string, ProjectPaymentPlan[]>;
  /** Keyed by plan, not by project — a payment only means anything inside one. */
  paymentsByPlan: Map<string, ProjectPaymentInstallment[]>;
};

export async function getPortalData(
  ctx: SessionContext,
  projects: ClientProjectRef[]
): Promise<PortalData> {
  const ids = projects.map((project) => project.id);

  const [intake, milestones, invoices, plans, payments] = await Promise.all([
    getIntakeSummaries(
      ctx,
      projects.map((project) => ({ id: project.id, packKey: project.intake_pack }))
    ),
    getProjectMilestones(ctx, ids),
    getProjectInvoices(ctx, ids),
    getPaymentPlans(ctx, ids),
    getPaymentInstallments(ctx, ids),
  ]);

  const milestonesByProject = new Map<string, ProjectMilestone[]>();
  const invoicesByProject = new Map<string, ProjectInvoice[]>();
  const plansByProject = new Map<string, ProjectPaymentPlan[]>();
  for (const id of ids) {
    milestonesByProject.set(id, []);
    invoicesByProject.set(id, []);
    plansByProject.set(id, []);
  }
  for (const milestone of milestones) {
    milestonesByProject.get(milestone.project_id)?.push(milestone);
  }
  for (const invoice of invoices) {
    invoicesByProject.get(invoice.project_id)?.push(invoice);
  }
  for (const plan of plans) {
    plansByProject.get(plan.project_id)?.push(plan);
  }

  // Seeded from the PLANS rather than from the payments, so a published plan
  // with nothing scheduled in it yet still gets an (empty) entry instead of an
  // undefined the callers each have to remember to default.
  const paymentsByPlan = new Map<string, ProjectPaymentInstallment[]>();
  for (const plan of plans) paymentsByPlan.set(plan.id, []);
  for (const payment of payments) {
    paymentsByPlan.get(payment.plan_id)?.push(payment);
  }

  return {
    projects,
    intake,
    milestonesByProject,
    invoicesByProject,
    plansByProject,
    paymentsByPlan,
  };
}

/**
 * The portal's whole request, fetched ONCE.
 *
 * Every page in the client shell renders across every business the account
 * holds, and the SIDEBAR does too — it carries the "2 packs to finish" and "1
 * invoice overdue" counts, so the layout needs the same wave the page does.
 * Without cache() that is two full sets of round-trips per navigation, and the
 * counts in the rail could disagree with the page beside them by one.
 *
 * Same trick as getSessionContext(): React dedupes it per request, so layout
 * and page share one load. It guards as well as loads — `requireClient()` is
 * the only door into the (client) group, and having it here means no portal
 * page can forget to call it.
 */
export type Portal = PortalData & { ctx: SessionContext };

export const loadPortal = cache(async function loadPortal(): Promise<Portal> {
  const ctx = await requireClient();
  // Two waves, and the split is forced: the project ids come out of the first
  // one, and a client cannot read `projects` to get them any other way
  // (0072 §2).
  const projects = await getMyClientProjects(ctx);
  const data = await getPortalData(ctx, projects);
  return { ctx, ...data };
});

/** The two numbers the sidebar shows. Derived here so both shells agree. */
export type PortalCounts = {
  /** Packs that exist and have not been sent yet. */
  packsOpen: number;
  /** Invoices past their due date and still unpaid, across every business. */
  overdue: number;
};

export function portalCounts(portal: Portal, today: string): PortalCounts {
  let packsOpen = 0;
  let overdue = 0;

  for (const project of portal.projects) {
    if (!portal.intake.get(project.id)?.submittedAt) packsOpen += 1;
    const totals = invoiceTotals(
      portal.invoicesByProject.get(project.id) ?? [],
      today
    );
    overdue += totals.overdueCount;
  }

  return { packsOpen, overdue };
}
