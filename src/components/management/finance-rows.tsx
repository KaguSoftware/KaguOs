"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteRecurring,
  deleteTransaction,
  setRecurringCanceled,
  setTransactionPaid,
} from "@/lib/actions/management";
import { Badge } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import {
  billingScheduleLabel,
  monthlyAmount,
  nextBillingOn,
  formatTRY,
  toTRY,
  type FxRates,
} from "@/lib/finance";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { RecurringItem, Transaction } from "@/lib/types";

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { pending, run } = useAction();
  const income = transaction.type === "income";
  const paid = transaction.status === "paid";

  return (
    <tr className="transition-colors duration-150 hover:bg-raised/60">
      <td className="px-4 py-2.5 font-mono text-xs text-faint">
        {formatDate(transaction.occurred_on)}
      </td>
      <td className="px-4 py-2.5">
        <Badge tone={income ? "green" : "danger"}>{income ? "in" : "out"}</Badge>
      </td>
      <td
        className={cn(
          "px-4 py-2.5 text-right font-mono text-sm",
          income ? "text-primary-dim" : "text-danger",
          // Pending money isn't real yet — the amount recedes until it settles,
          // so a column of figures reads as "what actually moved" at a glance.
          !paid && "opacity-60"
        )}
      >
        {income ? "+" : "−"}
        {formatMoney(Number(transaction.amount), transaction.currency)}
      </td>
      <td className="px-4 py-2.5">
        {/* Paid is the quiet default state of this table; only pending needs
            to be loud (amber = "waiting on something", same as everywhere
            else in the app). */}
        <Badge tone={paid ? "faint" : "amber"}>{paid ? "paid" : "pending"}</Badge>
      </td>
      <td className="max-w-40 truncate px-4 py-2.5 text-sm text-muted">
        {transaction.client || "—"}
      </td>
      <td className="max-w-56 truncate px-4 py-2.5 text-[calc(13px*var(--text-scale,1))] text-faint">
        {transaction.notes || ""}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="inline-flex items-center gap-1">
          {/* The one-click settle, mirroring RecurringRow's Cancel/Reactivate.
              Shown as words, not an icon — "Mark paid" is the whole point of
              the feature and shouldn't hide behind hover-discovery. */}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => setTransactionPaid(transaction.id, !paid), {
                success: paid ? "Marked pending." : "Marked paid.",
              })
            }
          >
            {paid ? "Reopen" : "Mark paid"}
          </Button>
          <Link
            href={`/management/finance/transactions/${transaction.id}`}
            title="Edit transaction"
            className="inline-flex h-7 items-center rounded-md px-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <Pencil className="size-3.5" aria-hidden />
            <span className="sr-only">Edit transaction</span>
          </Link>
          <ConfirmButton
            size="sm"
            disabled={pending}
            confirmLabel="Delete?"
            onConfirm={() =>
              run(() => deleteTransaction(transaction.id), {
                success: "Transaction deleted.",
              })
            }
          >
            <Trash2 className="size-3.5" aria-hidden />
            <span className="sr-only">Delete transaction</span>
          </ConfirmButton>
        </span>
      </td>
    </tr>
  );
}

export function RecurringRow({
  item,
  rates,
}: {
  item: RecurringItem;
  rates: FxRates;
}) {
  const { pending, run } = useAction();
  const income = item.type === "income";
  const active = item.canceled_on === null;
  const monthlyTRY = toTRY(monthlyAmount(item), item.currency, rates);
  const nextBill = nextBillingOn(item);

  return (
    <li className={cn("px-4 py-3", !active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{item.name}</p>
          <p className="mt-0.5 text-xs text-faint">
            {item.counterparty && `${item.counterparty} · `}
            {billingScheduleLabel(item)} · since {formatDate(item.started_on)}
            {!active && ` · canceled ${formatDate(item.canceled_on)}`}
          </p>
        </div>
        <span
          className={cn(
            "font-mono text-sm",
            income ? "text-primary-dim" : "text-danger"
          )}
        >
          {income ? "+" : "−"}
          {formatMoney(Number(item.amount), item.currency)}
          <span className="text-xs text-faint">/{item.cadence === "monthly" ? "mo" : "yr"}</span>
        </span>
        <span className="w-24 text-right font-mono text-xs text-muted">
          {monthlyTRY !== null ? `${formatTRY(monthlyTRY)}/mo` : "no rate"}
        </span>
        {/* The date the money next leaves, next to the amount that leaves —
            the pair is the question this list gets asked. A canceled item has
            no next bill, and says so rather than showing a date that will
            never happen. */}
        <span className="w-28 whitespace-nowrap text-right text-xs text-faint">
          {nextBill ? (
            <>
              next <span className="text-muted">{formatDate(nextBill)}</span>
            </>
          ) : (
            "—"
          )}
        </span>
        <Badge tone={active ? "green" : "faint"}>{active ? "active" : "canceled"}</Badge>
        <Link
          href={`/management/finance/recurring/${item.id}`}
          title="Edit recurring item"
          className="inline-flex h-7 items-center rounded-md px-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          <Pencil className="size-3.5" aria-hidden />
          <span className="sr-only">Edit recurring item</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => setRecurringCanceled(item.id, active), {
              success: active ? "Marked canceled." : "Reactivated.",
            })
          }
        >
          {active ? "Cancel" : "Reactivate"}
        </Button>
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Delete?"
          onConfirm={() =>
            run(() => deleteRecurring(item.id), { success: "Recurring item deleted." })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
          <span className="sr-only">Delete recurring item</span>
        </ConfirmButton>
      </div>
    </li>
  );
}
