import Link from "next/link";
import { CircleDashed, CircleDot, CircleSlash, CircleCheck } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { MoneyByCurrency } from "@/lib/data/portal";
import { moneyLines } from "@/lib/data/portal";
import {
  INVOICE_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  type InvoiceStatus,
  type MilestoneStatus,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/**
 * The small shared pieces of the client portal.
 *
 * Kept together because the three pages are three views of the same two facts —
 * where the build is, and what is owed — and a status pill that means one thing
 * on the dashboard and another on the finance page is the fastest way to make a
 * customer distrust all of it.
 */

/* ── Money ────────────────────────────────────────────────────────────────── */

/**
 * A total, per currency, stacked.
 *
 * Never one converted number: see the note on `invoiceTotals`. A client billed
 * in dinars and in dollars is shown two lines, both of which they can check
 * against their own bank, rather than one figure computed with Kagu's internal
 * FX assumption.
 */
export function Money({
  bucket,
  className,
  tone = "ink",
  size = "md",
}: {
  bucket: MoneyByCurrency;
  className?: string;
  tone?: "ink" | "danger" | "muted";
  size?: "md" | "lg";
}) {
  const lines = moneyLines(bucket);
  if (lines.length === 0) {
    return <span className={cn("font-mono text-faint", className)}>—</span>;
  }
  return (
    <span className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-0.5", className)}>
      {lines.map((line) => (
        <span
          key={line.currency}
          className={cn(
            "font-mono tabular-nums",
            size === "lg"
              ? "text-[calc(22px*var(--text-scale,1))] font-medium"
              : "text-[calc(14px*var(--text-scale,1))]",
            tone === "danger" && "text-danger",
            tone === "muted" && "text-muted",
            tone === "ink" && "text-ink"
          )}
        >
          {formatMoney(line.amount, line.currency)}
        </span>
      ))}
    </span>
  );
}

/**
 * One headline figure with its name above it.
 *
 * Deliberately not the banned hero-metric template: these sit three-across in a
 * row of equals, none of them is enlarged for drama, and each one is a number a
 * client would otherwise have to ask for by email.
 */
export function Stat({
  label,
  children,
  note,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
  tone?: "danger" | "amber";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-4">
      <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
        {label}
      </p>
      <div className="mt-2">{children}</div>
      {note && (
        <p
          className={cn(
            "mt-1.5 text-[calc(12px*var(--text-scale,1))]",
            tone === "danger" ? "text-danger" : tone === "amber" ? "text-amber" : "text-faint"
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}

/* ── Status vocabulary ────────────────────────────────────────────────────── */

const MILESTONE_TONES: Record<MilestoneStatus, BadgeTone> = {
  planned: "faint",
  in_progress: "amber",
  done: "green",
  blocked: "danger",
};

export function MilestoneBadge({ status }: { status: MilestoneStatus }) {
  return (
    <Badge tone={MILESTONE_TONES[status]}>{MILESTONE_STATUS_LABELS[status]}</Badge>
  );
}

/** The dot down the left of the timeline. Shape carries the state, not colour alone. */
export function MilestoneDot({ status }: { status: MilestoneStatus }) {
  const Icon =
    status === "done"
      ? CircleCheck
      : status === "in_progress"
        ? CircleDot
        : status === "blocked"
          ? CircleSlash
          : CircleDashed;
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        status === "done" && "text-primary",
        status === "in_progress" && "text-amber",
        status === "blocked" && "text-danger",
        status === "planned" && "text-faint"
      )}
      aria-hidden
    />
  );
}

const INVOICE_TONES: Record<InvoiceStatus, BadgeTone> = {
  draft: "faint",
  sent: "info",
  paid: "green",
  void: "faint",
};

/**
 * An invoice's state as the CLIENT experiences it.
 *
 * "Overdue" is not a stored status — it is `sent` plus a due date in the past —
 * and the pill says so rather than making the reader compare two columns. The
 * flag is computed by the caller, which has already read the clock once.
 */
export function InvoiceBadge({
  status,
  overdue,
}: {
  status: InvoiceStatus;
  overdue?: boolean;
}) {
  if (overdue && status === "sent") return <Badge tone="danger">Overdue</Badge>;
  return <Badge tone={INVOICE_TONES[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

/* ── Navigation between businesses ────────────────────────────────────────── */

/**
 * The business switcher.
 *
 * Only rendered when there is more than one — a "switcher" with a single option
 * is a control that teaches the reader they are missing something. A client
 * with two businesses genuinely does need it on every page, because the pages
 * are otherwise identical and the only way to tell them apart is the heading.
 */
export function BusinessTabs({
  businesses,
  activeId,
  hrefFor,
}: {
  businesses: { id: string; name: string }[];
  activeId: string;
  hrefFor: (id: string) => string;
}) {
  if (businesses.length < 2) return null;
  return (
    <nav
      aria-label="Your businesses"
      className="mb-6 flex flex-wrap gap-1.5 border-b border-line pb-3"
    >
      {businesses.map((business) => {
        const active = business.id === activeId;
        return (
          <Link
            key={business.id}
            href={hrefFor(business.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[calc(13px*var(--text-scale,1))] transition-colors duration-150",
              active
                ? "bg-raised font-medium text-ink"
                : "text-muted hover:bg-raised/60 hover:text-ink"
            )}
          >
            {business.name}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * A section heading for a business, used on the pages that stack every business
 * down one scroll rather than switching between them (finance, progress).
 */
export function BusinessHeading({
  name,
  action,
  id,
}: {
  name: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <header
      id={id}
      className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2.5"
    >
      <h2 className="text-[calc(16px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
        {name}
      </h2>
      {action}
    </header>
  );
}
