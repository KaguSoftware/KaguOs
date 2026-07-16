"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteRecurring,
  deleteTransaction,
  setRecurringCanceled,
} from "@/lib/actions/management";
import { Badge } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { monthlyAmount, formatTRY, toTRY, type FxRates } from "@/lib/finance";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { RecurringItem, Transaction } from "@/lib/types";

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { pending, run } = useAction();
  const income = transaction.type === "income";

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
          income ? "text-primary-dim" : "text-danger"
        )}
      >
        {income ? "+" : "−"}
        {formatMoney(Number(transaction.amount), transaction.currency)}
      </td>
      <td className="max-w-40 truncate px-4 py-2.5 text-sm text-muted">
        {transaction.client || "—"}
      </td>
      <td className="max-w-56 truncate px-4 py-2.5 text-[13px] text-faint">
        {transaction.notes || ""}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="inline-flex items-center gap-1">
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

  return (
    <li className={cn("px-4 py-3", !active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{item.name}</p>
          <p className="mt-0.5 text-xs text-faint">
            {item.counterparty && `${item.counterparty} · `}
            {item.cadence} · since {formatDate(item.started_on)}
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
