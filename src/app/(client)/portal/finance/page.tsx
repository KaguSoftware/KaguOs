import type { Metadata } from "next";
import { Building2, CalendarClock, Receipt } from "lucide-react";
import {
  hasMoney,
  invoiceTotals,
  loadPortal,
  planSummaries,
  type PlanSummary,
} from "@/lib/data/portal";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Panel } from "@/components/ui/panel";
import { ProgressMeter } from "@/components/portal/progress-meter";
import {
  BusinessHeading,
  InvoiceBadge,
  Money,
  Stat,
} from "@/components/portal/bits";
import { Badge } from "@/components/ui/badge";
import {
  PAYMENT_CADENCE_PER,
  type InvoiceCurrency,
  type ProjectInvoice,
  type ProjectPaymentInstallment,
} from "@/lib/types";
import { cn, formatDate, formatMoney, todayInIstanbul } from "@/lib/utils";

export const metadata: Metadata = { title: "Finance" };

/**
 * The statement.
 *
 * ── What this page is, and what it deliberately is not ─────────────────────
 *
 * It answers one question — "what do I owe, and what have I paid?" — and it
 * answers it with rows the client can check against their own bank. It is NOT
 * Kagu's finance section wearing a different hat: there are no expenses here,
 * no margins, no other client's numbers, and no TRY conversion. Those live in
 * `transactions` behind the management section, and the reason this page reads
 * a separate table is that an RLS arm grants every column of a row at once
 * (0074's header).
 *
 * ── Why the totals stack per currency ──────────────────────────────────────
 *
 * Kagu bills some clients in dollars and some in dinars, and converts its own
 * books to lira through rates it types in by hand. Showing a client one
 * converted figure would put a number on this page that they cannot reconcile
 * against anything, computed with an assumption they never agreed to. Two lines
 * is the honest answer.
 */
export default async function PortalFinancePage() {
  const portal = await loadPortal();
  const today = todayInIstanbul();

  // Every business's invoices, and the totals across all of them. Computed in
  // one pass because the top of the page is the whole account and the rest of
  // it is the same rows split up — two passes is how the two disagree.
  const perBusiness = portal.projects.map((project) => {
    const invoices = portal.invoicesByProject.get(project.id) ?? [];
    // Only plans that are actually running. A completed or cancelled one is
    // history, and a client reading "what do I pay next" should not have to
    // work out which of three schedules is the live one. RLS has already
    // dropped the drafts and the unpublished before any of this (0075 §2c).
    const plans = planSummaries(
      (portal.plansByProject.get(project.id) ?? []).filter(
        (plan) => plan.status === "active"
      ),
      portal.paymentsByPlan,
      today
    );
    return { project, invoices, plans, totals: invoiceTotals(invoices, today) };
  });

  const overall = invoiceTotals(
    perBusiness.flatMap((entry) => entry.invoices),
    today
  );
  const overdueCount = overall.overdueCount;
  const anyInvoices = perBusiness.some((entry) => entry.invoices.length > 0);
  const anyPlans = perBusiness.some((entry) => entry.plans.length > 0);

  // The soonest payment still to be made, across every business and every
  // plan — the one thing somebody opens this page to check when they are not
  // chasing an invoice.
  const nextPayment = perBusiness
    .flatMap((entry) =>
      entry.plans
        .filter((plan) => plan.next)
        .map((plan) => ({ plan, payment: plan.next! }))
    )
    .sort((a, b) => a.payment.due_on.localeCompare(b.payment.due_on))[0];

  return (
    <>
      {/* A payment marked received while the client is looking at the page is
          exactly the moment they should see it land. */}
      <LiveRefresh
        tables={[
          "project_invoices",
          "project_payment_plans",
          "project_payment_installments",
        ]}
      />

      <PageHeader
        title="Finance"
        description="What you have been invoiced, what is scheduled next, and where each of them stands. Drafts aren't shown — an invoice appears here once it's been sent."
      />

      {portal.projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title="Nothing shared with you yet"
            hint="As soon as Kagu shares a project with your account, its invoices appear here."
          />
        </div>
      ) : (
        <>
          <div
            className={cn(
              "mb-8 grid gap-3",
              nextPayment ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
            )}
          >
            <Stat
              label="Outstanding"
              note={
                overdueCount > 0
                  ? `${overdueCount} past due`
                  : hasMoney(overall.outstanding)
                    ? "Nothing overdue"
                    : "Nothing owed right now"
              }
              tone={overdueCount > 0 ? "danger" : undefined}
            >
              <Money bucket={overall.outstanding} size="lg" />
            </Stat>
            <Stat label="Overdue" note={overdueCount > 0 ? "Please settle when you can" : undefined}>
              <Money
                bucket={overall.overdue}
                size="lg"
                tone={hasMoney(overall.overdue) ? "danger" : "ink"}
              />
            </Stat>
            <Stat label="Paid to date">
              <Money bucket={overall.paid} size="lg" tone="muted" />
            </Stat>
            {nextPayment && (
              <Stat
                label="Next scheduled payment"
                note={`${formatDate(nextPayment.payment.due_on)} · ${nextPayment.plan.plan.title}`}
                tone={nextPayment.payment.due_on < today ? "danger" : undefined}
              >
                <span className="font-mono text-[calc(22px*var(--text-scale,1))] font-medium tabular-nums text-ink">
                  {formatMoney(
                    nextPayment.payment.amount,
                    nextPayment.plan.plan.currency
                  )}
                </span>
              </Stat>
            )}
          </div>

          {!anyInvoices && !anyPlans ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState
                icon={Receipt}
                title="No invoices yet"
                hint="Nothing has been billed for your projects, and no payment plan has been agreed. When either happens, it shows up here with its dates."
              />
            </div>
          ) : (
            <div className="grid gap-8">
              {perBusiness.map(({ project, invoices, plans, totals }) => (
                // min-w-0: this is a grid item, whose automatic minimum
                // size is its own min-content — and the invoice table below
                // sets a 38rem floor to keep its columns readable. Without
                // this the section refuses to shrink past ~610px, overflows
                // the grid, and takes the whole page's horizontal scroll with
                // it on a phone. The table still scrolls inside its own box;
                // that is the point of giving it one.
                <section key={project.id} className="min-w-0">
                  <BusinessHeading
                    name={project.name}
                    action={
                      <span className="flex items-baseline gap-2 text-[calc(12px*var(--text-scale,1))] text-faint">
                        outstanding
                        <Money
                          bucket={totals.outstanding}
                          tone={totals.overdueCount > 0 ? "danger" : "muted"}
                        />
                      </span>
                    }
                  />

                  {/* The plan comes FIRST, above the invoices. An invoice is
                      something that already happened; the plan is what happens
                      next, which is the question somebody with a retainer
                      opens this page to answer. */}
                  {plans.length > 0 && (
                    <div className="mb-6 grid gap-4">
                      {plans.map((plan) => (
                        <PlanPanel key={plan.plan.id} summary={plan} today={today} />
                      ))}
                    </div>
                  )}

                  {invoices.length === 0 ? (
                    <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
                      {plans.length > 0
                        ? "Nothing invoiced yet — the payments above are the schedule, and each one gets an invoice when it comes due."
                        : "Nothing invoiced for this one yet."}
                    </p>
                  ) : (
                    <InvoiceTable invoices={invoices} today={today} />
                  )}
                </section>
              ))}
            </div>
          )}

          <p className="mt-8 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] text-faint">
            Something here look wrong? Tell whoever you normally speak to at
            Kagu — this page is a copy of our records, not a place to dispute
            them, and we would rather fix it at the source.
          </p>
        </>
      )}
    </>
  );
}

/**
 * The invoices themselves.
 *
 * A real table, because the reason to open this page is to compare down a
 * column — which date, which amount, which is late — and a stack of cards makes
 * that impossible. It scrolls inside its own container rather than widening the
 * page, so a phone gets a swipeable table instead of a broken layout.
 */
function InvoiceTable({
  invoices,
  today,
}: {
  invoices: ProjectInvoice[];
  today: string;
}) {
  return (
    <>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[38rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-raised/40">
              {["Invoice", "Issued", "Due", "Amount", "Status"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 font-mono text-[calc(10px*var(--text-scale,1))] font-normal uppercase tracking-wider text-faint"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              // "Overdue" is derived, not stored: sent, dated, and that date has
              // passed. Written out rather than hidden in a helper because the
              // finance page and the rail's count have to mean the same thing.
              const overdue =
                invoice.status === "sent" &&
                invoice.due_on !== null &&
                invoice.due_on < today;
              return (
                <tr key={invoice.id} className="border-b border-line/60 last:border-b-0">
                  <td className="px-3 py-2.5 align-top">
                    <span className="block font-mono text-[calc(12px*var(--text-scale,1))] text-muted">
                      {invoice.number}
                    </span>
                    {invoice.title && (
                      <span className="block text-[calc(13px*var(--text-scale,1))] text-ink">
                        {invoice.title}
                      </span>
                    )}
                    {/* The note is the one place Kagu writes a sentence to the
                        client on this page — a payment reference, what a partial
                        payment covered. Under the title rather than in its own
                        column, which would be empty for most rows. */}
                    {invoice.note && (
                      <span className="mt-0.5 block max-w-[40ch] text-[calc(12px*var(--text-scale,1))] text-faint">
                        {invoice.note}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[calc(12px*var(--text-scale,1))] text-muted">
                    {formatDate(invoice.issued_on)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 align-top font-mono text-[calc(12px*var(--text-scale,1))]",
                      overdue ? "text-danger" : "text-muted"
                    )}
                  >
                    {invoice.due_on ? formatDate(invoice.due_on) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[calc(13px*var(--text-scale,1))] tabular-nums text-ink">
                    <AmountCell
                      amount={invoice.amount}
                      currency={invoice.currency}
                      struck={invoice.status === "void"}
                    />
                    {invoice.paid_on && (
                      <span className="mt-0.5 block text-[calc(11px*var(--text-scale,1))] text-primary-dim">
                        paid {formatDate(invoice.paid_on)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <InvoiceBadge status={invoice.status} overdue={overdue} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* The horizontal scroll is the deliberate answer to a narrow screen
          (see above), but a table that simply stops mid-column at the edge of
          a phone reads as a broken page rather than as a swipeable one. One
          line says which it is, below `sm` — above it the 38rem floor fits. */}
      <p className="mt-1.5 text-[calc(11px*var(--text-scale,1))] text-faint sm:hidden">
        Swipe the table sideways for the amount and status.
      </p>
    </>
  );
}

/** A void invoice keeps its figure but strikes it — it was withdrawn, not paid. */
function AmountCell({
  amount,
  currency,
  struck,
}: {
  amount: number;
  currency: InvoiceCurrency;
  struck: boolean;
}) {
  return (
    <span className={cn(struck && "text-faint line-through")}>
      {formatMoney(amount, currency)}
    </span>
  );
}

/**
 * One payment plan, as the client reads it.
 *
 * ── Why the whole schedule, and not just what's next ───────────────────────
 *
 * Because the question underneath "what do I pay next?" is almost always "and
 * how much longer for?". A retainer shown one month at a time is a subscription
 * somebody has to keep asking about; the same retainer shown as twelve dated
 * lines with four of them ticked is a commitment they can see the end of.
 *
 * ── Why the paid ones stay ─────────────────────────────────────────────────
 *
 * Same reason a void invoice stays on the statement above: a client who saw a
 * payment last month should not have to wonder where it went. They are dimmed
 * and ticked, not removed — and a waived one keeps its figure struck through,
 * because "we agreed you wouldn't pay this" is a fact worth being able to point
 * at later.
 *
 * The wording throughout is careful about one distinction: a scheduled payment
 * that has slipped past its date is LATE, not overdue — nobody has invoiced it,
 * so nobody has been dunned. The invoice table below is where "overdue" means
 * what it says.
 */
function PlanPanel({ summary, today }: { summary: PlanSummary; today: string }) {
  const { plan, payments } = summary;
  const headline = plan.amount_each
    ? plan.kind === "recurring"
      ? `${formatMoney(plan.amount_each, plan.currency)} / ${PAYMENT_CADENCE_PER[plan.cadence]}`
      : `${summary.count} × ${formatMoney(plan.amount_each, plan.currency)}`
    : `${summary.count} ${summary.count === 1 ? "payment" : "payments"}`;

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex min-w-0 items-center gap-2 text-[calc(14px*var(--text-scale,1))] font-semibold text-ink">
          <CalendarClock className="size-4 shrink-0 text-faint" aria-hidden />
          {plan.title}
        </h3>
        <span className="font-mono text-[calc(13px*var(--text-scale,1))] tabular-nums text-muted">
          {headline}
        </span>
      </div>

      <p className="mt-1 text-[calc(12px*var(--text-scale,1))] text-faint">
        {plan.kind === "recurring" ? "Recurring" : "Instalments"} from{" "}
        {formatDate(plan.starts_on)}
        {plan.ends_on ? ` to ${formatDate(plan.ends_on)}` : " — ongoing"}
      </p>

      <div className="mt-3">
        <ProgressMeter
          pct={summary.pct}
          done={summary.paidCount}
          total={summary.count}
          caption={`${summary.paidCount}/${summary.count}`}
          label={`${plan.title} — payments made`}
        />
        <p className="mt-1.5 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
          {formatMoney(summary.paid, plan.currency)} paid ·{" "}
          {formatMoney(summary.remaining, plan.currency)} to come
          {summary.overdueCount > 0 && (
            <span className="text-danger">
              {" "}
              · {summary.overdueCount} past its date
            </span>
          )}
        </p>
      </div>

      {plan.note && (
        <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
          {plan.note}
        </p>
      )}

      {payments.length > 0 && (
        <ul className="mt-3 grid gap-px overflow-hidden rounded-md border border-line">
          {payments.map((payment) => (
            <PaymentLine
              key={payment.id}
              payment={payment}
              currency={plan.currency}
              next={summary.next?.id === payment.id}
              today={today}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** One line of a schedule: when, how much, and whether it still needs paying. */
function PaymentLine({
  payment,
  currency,
  next,
  today,
}: {
  payment: ProjectPaymentInstallment;
  currency: InvoiceCurrency;
  /** The soonest one still to be paid — the only row anybody has to act on. */
  next: boolean;
  today: string;
}) {
  const settled = payment.status === "paid" || payment.status === "waived";
  const late = !settled && payment.due_on < today;

  return (
    <li
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line/60 px-3 py-2 last:border-b-0",
        next && "bg-raised/40",
        settled && "opacity-70"
      )}
    >
      <span
        className={cn(
          "w-24 shrink-0 font-mono text-[calc(12px*var(--text-scale,1))] tabular-nums",
          late ? "text-danger" : "text-muted"
        )}
      >
        {formatDate(payment.due_on)}
      </span>

      <span
        className={cn(
          "font-mono text-[calc(13px*var(--text-scale,1))] tabular-nums",
          payment.status === "waived" ? "text-faint line-through" : "text-ink"
        )}
      >
        {formatMoney(payment.amount, currency)}
      </span>

      {/* On a phone the row has no room for four things side by side: the
          label ends up crushed to a few pixels of ellipsis between the amount
          and the badge, which reads as a rendering fault rather than as a
          label. Below `sm` it drops to its own full-width line under the row —
          ordered last, so the date, the figure and the status still read
          across the top — and above `sm` it goes back to the single truncating
          line this row was designed as. */}
      {payment.label && (
        <span className="order-last w-full text-[calc(12px*var(--text-scale,1))] text-muted sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate">
          {payment.label}
        </span>
      )}

      <span className="ml-auto flex items-center gap-2">
        {next && !late && <Badge tone="info">Next</Badge>}
        {payment.status === "paid" ? (
          <Badge tone="green">
            {payment.paid_on ? `Paid ${formatDate(payment.paid_on)}` : "Paid"}
          </Badge>
        ) : payment.status === "waived" ? (
          <Badge tone="faint">Waived</Badge>
        ) : late ? (
          <Badge tone="danger">Past its date</Badge>
        ) : payment.status === "invoiced" ? (
          <Badge tone="info">Invoiced</Badge>
        ) : (
          <Badge tone="faint">Scheduled</Badge>
        )}
      </span>

      {payment.note && (
        <span className="order-last w-full text-[calc(12px*var(--text-scale,1))] text-faint">
          {payment.note}
        </span>
      )}
    </li>
  );
}
