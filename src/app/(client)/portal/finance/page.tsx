import type { Metadata } from "next";
import { Building2, Receipt } from "lucide-react";
import { hasMoney, invoiceTotals, loadPortal } from "@/lib/data/portal";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveRefresh } from "@/components/shell/live-refresh";
import {
  BusinessHeading,
  InvoiceBadge,
  Money,
  Stat,
} from "@/components/portal/bits";
import type { InvoiceCurrency, ProjectInvoice } from "@/lib/types";
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
    return { project, invoices, totals: invoiceTotals(invoices, today) };
  });

  const overall = invoiceTotals(
    perBusiness.flatMap((entry) => entry.invoices),
    today
  );
  const overdueCount = overall.overdueCount;
  const anyInvoices = perBusiness.some((entry) => entry.invoices.length > 0);

  return (
    <>
      {/* A payment marked received while the client is looking at the page is
          exactly the moment they should see it land. */}
      <LiveRefresh tables={["project_invoices"]} />

      <PageHeader
        title="Finance"
        description="Everything Kagu has invoiced you, and where each one stands. Drafts aren't shown — an invoice appears here once it's been sent."
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
          <div className="mb-8 grid gap-3 sm:grid-cols-3">
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
          </div>

          {!anyInvoices ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState
                icon={Receipt}
                title="No invoices yet"
                hint="Nothing has been billed for your projects. When something is, it shows up here with its due date."
              />
            </div>
          ) : (
            <div className="grid gap-8">
              {perBusiness.map(({ project, invoices, totals }) => (
                <section key={project.id}>
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

                  {invoices.length === 0 ? (
                    <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
                      Nothing invoiced for this one yet.
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
