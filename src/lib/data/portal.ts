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
  return (await rowsOrThrow(
    ctx.supabase
      .from("project_milestones")
      .select("*")
      .in("project_id", projectIds)
      .order("sort")
      .order("created_at"),
    "project_milestones"
  )) as ProjectMilestone[];
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

/* ── Progress, as a fraction ──────────────────────────────────────────────── */

export type MilestoneProgress = {
  total: number;
  done: number;
  pct: number;
  /** The next thing that isn't finished — what a client actually came to read. */
  next: ProjectMilestone | null;
  blocked: ProjectMilestone[];
};

/**
 * The build's headline, from its milestones.
 *
 * A blocked milestone counts as NOT done and is surfaced separately rather than
 * folded into the percentage. "78%, one thing blocked" is the honest sentence;
 * a bar that quietly absorbs a blockage is how a client finds out about it in a
 * meeting instead of on this page.
 */
export function milestoneProgress(
  milestones: ProjectMilestone[]
): MilestoneProgress {
  const total = milestones.length;
  const done = milestones.filter((m) => m.status === "done").length;
  return {
    total,
    done,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
    next:
      milestones.find((m) => m.status === "in_progress") ??
      milestones.find((m) => m.status !== "done") ??
      null,
    blocked: milestones.filter((m) => m.status === "blocked"),
  };
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
};

export async function getPortalData(
  ctx: SessionContext,
  projects: ClientProjectRef[]
): Promise<PortalData> {
  const ids = projects.map((project) => project.id);

  const [intake, milestones, invoices] = await Promise.all([
    getIntakeSummaries(
      ctx,
      projects.map((project) => ({ id: project.id, packKey: project.intake_pack }))
    ),
    getProjectMilestones(ctx, ids),
    getProjectInvoices(ctx, ids),
  ]);

  const milestonesByProject = new Map<string, ProjectMilestone[]>();
  const invoicesByProject = new Map<string, ProjectInvoice[]>();
  for (const id of ids) {
    milestonesByProject.set(id, []);
    invoicesByProject.set(id, []);
  }
  for (const milestone of milestones) {
    milestonesByProject.get(milestone.project_id)?.push(milestone);
  }
  for (const invoice of invoices) {
    invoicesByProject.get(invoice.project_id)?.push(invoice);
  }

  return { projects, intake, milestonesByProject, invoicesByProject };
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
