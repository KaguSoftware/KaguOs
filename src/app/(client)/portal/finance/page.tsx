import type { Metadata } from "next";
import { cookies } from "next/headers";
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
  cadencePerLabel,
  dict,
  installmentStatusLabel,
  invoiceStatusLabel,
  planKindLabel,
  type PortalDict,
} from "@/lib/i18n";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/lib/locale";
import {
  type InvoiceCurrency,
  type ProjectInvoice,
  type ProjectPaymentInstallment,
} from "@/lib/types";
import {
  cn,
  formatDateIn,
  formatMoneyIn,
  isolate,
  todayInIstanbul,
} from "@/lib/utils";

// A static `metadata` export cannot read a cookie, so the tab title was
// structurally incapable of following the client's language. `generateMetadata`
// runs per request and can.
export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: dict(locale).navFinance };
}

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
 *
 * ── Why the figures stay in Latin digits in Arabic ─────────────────────────
 *
 * Because this page's job is reconciliation, and the invoice PDF and the wire
 * confirmation the client is holding both carry Latin digits (lib/utils.ts's
 * `formatMoneyIn`). The Amount column is set in Geist Mono for the same reason:
 * Arabic-Indic digits have no glyphs there and would fall back to a
 * proportional face, destroying the alignment that makes a column scannable.
 */
export default async function PortalFinancePage() {
  const portal = await loadPortal();
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dict(locale);
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

      <PageHeader title={t.navFinance} description={t.financeBlurb} />

      {portal.projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title={t.nothingSharedTitle}
            hint={t.financeNothingSharedHint}
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
              label={t.outstanding}
              note={
                overdueCount > 0
                  ? t.pastDueCount(overdueCount)
                  : hasMoney(overall.outstanding)
                    ? t.nothingOverdue
                    : t.nothingOwedNow
              }
              tone={overdueCount > 0 ? "danger" : undefined}
            >
              <Money bucket={overall.outstanding} size="lg" locale={locale} />
            </Stat>
            <Stat
              label={t.overdueLabel}
              note={overdueCount > 0 ? t.settleWhenYouCan : undefined}
            >
              <Money
                bucket={overall.overdue}
                size="lg"
                tone={hasMoney(overall.overdue) ? "danger" : "ink"}
                locale={locale}
              />
            </Stat>
            <Stat label={t.paidToDate}>
              <Money bucket={overall.paid} size="lg" tone="muted" locale={locale} />
            </Stat>
            {nextPayment && (
              /* The note needs no dictionary key: it is a date and a
                 staff-typed plan title, with no English word between them.
                 Both halves are isolated because the `·` between them is
                 bidi-neutral and would otherwise take the paragraph's
                 direction and jump to the wrong end of the line. */
              <Stat
                label={t.nextScheduledPayment}
                note={`${isolate(formatDateIn(locale, nextPayment.payment.due_on))} · ${isolate(nextPayment.plan.plan.title)}`}
                tone={nextPayment.payment.due_on < today ? "danger" : undefined}
              >
                <span className="font-mono text-[calc(22px*var(--text-scale,1))] font-medium tabular-nums text-ink">
                  <bdi>
                    {formatMoneyIn(
                      locale,
                      nextPayment.payment.amount,
                      nextPayment.plan.plan.currency
                    )}
                  </bdi>
                </span>
              </Stat>
            )}
          </div>

          {!anyInvoices && !anyPlans ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState
                icon={Receipt}
                title={t.noInvoicesTitle}
                hint={t.noInvoicesHint}
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
                        {t.outstandingInline}
                        <Money
                          bucket={totals.outstanding}
                          tone={totals.overdueCount > 0 ? "danger" : "muted"}
                          locale={locale}
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
                        <PlanPanel
                          key={plan.plan.id}
                          summary={plan}
                          today={today}
                          t={t}
                          locale={locale}
                        />
                      ))}
                    </div>
                  )}

                  {invoices.length === 0 ? (
                    <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
                      {plans.length > 0
                        ? t.nothingInvoicedWithPlan
                        : t.nothingInvoicedYet}
                    </p>
                  ) : (
                    <InvoiceTable
                      invoices={invoices}
                      today={today}
                      t={t}
                      locale={locale}
                    />
                  )}
                </section>
              ))}
            </div>
          )}

          <p className="mt-8 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] text-faint">
            {t.financeDisputeNote}
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
 *
 * It takes the Dict itself rather than a bundle of resolved strings: this is a
 * server component in the same module as the page, so there is no client
 * boundary to serialise across — the `labels` indirection the portal uses
 * elsewhere only exists for `"use client"` files.
 */
function InvoiceTable({
  invoices,
  today,
  t,
  locale,
}: {
  invoices: ProjectInvoice[];
  today: string;
  t: PortalDict;
  locale: Locale;
}) {
  return (
    <>
      <div className="overflow-x-auto rounded-md border border-line">
        {/* `text-start`, not `text-left`: the cells follow the writing
            direction, so an Arabic table is not force-aligned to the left edge
            of a right-aligned page. */}
        <table className="w-full min-w-[38rem] border-collapse text-start">
          <thead>
            <tr className="border-b border-line bg-raised/40">
              {[
                t.invoiceColInvoice,
                t.invoiceColIssued,
                t.invoiceColDue,
                t.invoiceColAmount,
                t.invoiceColStatus,
              ].map((heading, index) => (
                <th
                  // The index, not the heading: keying on the display string
                  // changes every cell's identity when the language does, which
                  // remounts the whole thead for no reason.
                  key={index}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 font-mono text-[calc(10px*var(--text-scale,1))] font-normal uppercase tracking-wider text-faint rtl:font-sans rtl:normal-case rtl:tracking-normal"
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
                      <span
                        dir="auto"
                        className="block text-[calc(13px*var(--text-scale,1))] text-ink"
                      >
                        {invoice.title}
                      </span>
                    )}
                    {/* The note is the one place Kagu writes a sentence to the
                        client on this page — a payment reference, what a partial
                        payment covered. Under the title rather than in its own
                        column, which would be empty for most rows. `dir="auto"`
                        because it is staff-typed and may be English on an
                        Arabic page, or the other way round. */}
                    {invoice.note && (
                      <span
                        dir="auto"
                        className="mt-0.5 block max-w-[40ch] text-[calc(12px*var(--text-scale,1))] text-faint"
                      >
                        {invoice.note}
                      </span>
                    )}
                  </td>
                  {/* `rtl:font-sans` on the date cells: an Arabic date carries a
                      month name, and Geist Mono has no Arabic glyphs — left as
                      mono the line ends up set in two typefaces. `tabular-nums`
                      stays; the digits are Latin either way. */}
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[calc(12px*var(--text-scale,1))] text-muted rtl:font-sans">
                    {formatDateIn(locale, invoice.issued_on)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 align-top font-mono text-[calc(12px*var(--text-scale,1))] rtl:font-sans",
                      overdue ? "text-danger" : "text-muted"
                    )}
                  >
                    {formatDateIn(locale, invoice.due_on)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[calc(13px*var(--text-scale,1))] tabular-nums text-ink">
                    <AmountCell
                      amount={invoice.amount}
                      currency={invoice.currency}
                      struck={invoice.status === "void"}
                      locale={locale}
                    />
                    {invoice.paid_on && (
                      <span className="mt-0.5 block text-[calc(11px*var(--text-scale,1))] text-primary-dim">
                        {t.invoicePaidOn(
                          isolate(formatDateIn(locale, invoice.paid_on))
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <InvoiceBadge
                      status={invoice.status}
                      overdue={overdue}
                      label={invoiceStatusLabel(t, invoice.status, overdue)}
                    />
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
        {t.swipeTableHint}
      </p>
    </>
  );
}

/** A void invoice keeps its figure but strikes it — it was withdrawn, not paid. */
function AmountCell({
  amount,
  currency,
  struck,
  locale,
}: {
  amount: number;
  currency: InvoiceCurrency;
  struck: boolean;
  locale: Locale;
}) {
  return (
    <span className={cn(struck && "text-faint line-through")}>
      {/* <bdi> for the same reason `Money` uses one: a currency run is Latin in
          both locales, so inside a right-to-left column the symbol or the
          trailing code would otherwise land on the wrong side of the figure. */}
      <bdi>{formatMoneyIn(locale, amount, currency)}</bdi>
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
 * what it says. Arabic keeps the distinction with two different words:
 * `installmentStatusLate` (تجاوزت موعدها) here, `invoiceStatusOverdue`
 * (متأخرة السداد) up there.
 */
function PlanPanel({
  summary,
  today,
  t,
  locale,
}: {
  summary: PlanSummary;
  today: string;
  t: PortalDict;
  locale: Locale;
}) {
  const { plan, payments } = summary;
  // Whole sentences from the dictionary rather than a template assembled here:
  // English quotes a retainer as a fraction ("$1,200 / month") and Arabic as an
  // adverb ("1,200 $ شهريًا"), so the slash itself is a translatable decision.
  const headline = plan.amount_each
    ? plan.kind === "recurring"
      ? t.planRecurringHeadline(
          formatMoneyIn(locale, plan.amount_each, plan.currency),
          cadencePerLabel(t, plan.cadence)
        )
      : t.planInstalmentsHeadline(
          summary.count,
          formatMoneyIn(locale, plan.amount_each, plan.currency)
        )
    : t.planPaymentCount(summary.count);

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex min-w-0 items-center gap-2 text-[calc(14px*var(--text-scale,1))] font-semibold text-ink">
          <CalendarClock className="size-4 shrink-0 text-faint" aria-hidden />
          <span dir="auto">{plan.title}</span>
        </h3>
        <span className="font-mono text-[calc(13px*var(--text-scale,1))] tabular-nums text-muted rtl:font-sans">
          {headline}
        </span>
      </div>

      {/* One dictionary call rather than four fragments, so Arabic can supply
          its own من/إلى and its own "ongoing" tail. `planKindLabel` also covers
          `custom`, which the old two-way ternary mislabelled as instalments. */}
      <p className="mt-1 text-[calc(12px*var(--text-scale,1))] text-faint">
        {t.planRange(
          planKindLabel(t, plan.kind),
          isolate(formatDateIn(locale, plan.starts_on)),
          plan.ends_on ? isolate(formatDateIn(locale, plan.ends_on)) : null
        )}
      </p>

      <div className="mt-3">
        <ProgressMeter
          pct={summary.pct}
          done={summary.paidCount}
          total={summary.count}
          caption={t.paymentsMade(summary.paidCount, summary.count)}
          label={t.planPaymentsAria(plan.title)}
        />
        <p className="mt-1.5 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint rtl:font-sans">
          {t.paidAndToCome(
            isolate(formatMoneyIn(locale, summary.paid, plan.currency)),
            isolate(formatMoneyIn(locale, summary.remaining, plan.currency))
          )}
          {summary.overdueCount > 0 && (
            <>
              {/* The separator is its own element rather than leading text on
                  the red span: a bidi-neutral `·` at the start of a node takes
                  the paragraph direction and jumps to the far end of the line. */}
              <span aria-hidden> · </span>
              <span className="text-danger">
                {t.pastItsDateCount(summary.overdueCount)}
              </span>
            </>
          )}
        </p>
      </div>

      {plan.note && (
        <p
          dir="auto"
          className="mt-3 max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted"
        >
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
              t={t}
              locale={locale}
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
  t,
  locale,
}: {
  payment: ProjectPaymentInstallment;
  currency: InvoiceCurrency;
  /** The soonest one still to be paid — the only row anybody has to act on. */
  next: boolean;
  today: string;
  t: PortalDict;
  locale: Locale;
}) {
  const settled = payment.status === "paid" || payment.status === "waived";
  const late = !settled && payment.due_on < today;

  return (
    <li
      className={cn(
        // Four things do not fit across a phone, and letting them wrap leaves
        // the badge stranded on a line of its own — which reads as a broken
        // row rather than as a wrapped one. Below `sm` this is a two-column
        // grid instead: date over amount down the left, status flush right,
        // label beside the amount. Nothing is ragged because nothing wraps by
        // accident. From `sm` up it is the single flex line it was designed
        // as, and the grid placements below are inert on a flex item.
        "grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-line/60 px-3 py-2 last:border-b-0 sm:flex sm:flex-wrap sm:gap-y-0.5",
        next && "bg-raised/40",
        settled && "opacity-70"
      )}
    >
      {/* The date column was a flat `w-24`, which fits "3 Sep 2026" but not the
          spelled-out Arabic month beside the same digits — `3 نوفمبر 2026`
          overruns it and either wraps or collides with the amount in the
          `sm:flex` line above. A floor on a phone, a wider fixed column from
          `sm` up, where the flex row needs the columns to line up. */}
      <span
        className={cn(
          "col-start-1 row-start-1 min-w-24 shrink-0 font-mono text-[calc(12px*var(--text-scale,1))] tabular-nums rtl:font-sans sm:w-28",
          late ? "text-danger" : "text-muted"
        )}
      >
        {formatDateIn(locale, payment.due_on)}
      </span>

      <span
        className={cn(
          "col-start-1 row-start-2 font-mono text-[calc(13px*var(--text-scale,1))] tabular-nums",
          payment.status === "waived" ? "text-faint line-through" : "text-ink"
        )}
      >
        <bdi>{formatMoneyIn(locale, payment.amount, currency)}</bdi>
      </span>

      {/* It wraps on a phone rather than truncating: the column is wide enough
          for most labels, and half of "on delivery and written acceptance" is
          worth less than the line it saves. */}
      {payment.label && (
        <span
          dir="auto"
          className="col-start-2 row-start-2 text-[calc(12px*var(--text-scale,1))] text-muted sm:min-w-0 sm:flex-1 sm:truncate"
        >
          {payment.label}
        </span>
      )}

      {/* `ms-auto`, not `ml-auto`: the margin has to follow the writing
          direction the way the `col-start-*` placements beside it already do. */}
      <span className="col-start-2 row-start-1 ms-auto flex items-center gap-2">
        {next && !late && <Badge tone="info">{t.installmentNext}</Badge>}
        {/* Two of these five pills are derived rather than stored — a paid row
            says when it was paid, and a scheduled row past its date says so —
            which is why the stored four go through `installmentStatusLabel` and
            those two read their own keys. */}
        {payment.status === "paid" ? (
          <Badge tone="green">
            {payment.paid_on
              ? t.installmentPaidOn(isolate(formatDateIn(locale, payment.paid_on)))
              : installmentStatusLabel(t, payment.status)}
          </Badge>
        ) : payment.status === "waived" ? (
          <Badge tone="faint">{installmentStatusLabel(t, payment.status)}</Badge>
        ) : late ? (
          <Badge tone="danger">{t.installmentStatusLate}</Badge>
        ) : payment.status === "invoiced" ? (
          <Badge tone="info">{installmentStatusLabel(t, payment.status)}</Badge>
        ) : (
          <Badge tone="faint">{installmentStatusLabel(t, payment.status)}</Badge>
        )}
      </span>

      {payment.note && (
        <span
          dir="auto"
          className="col-span-2 w-full text-[calc(12px*var(--text-scale,1))] text-faint"
        >
          {payment.note}
        </span>
      )}
    </li>
  );
}
