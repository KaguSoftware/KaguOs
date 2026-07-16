"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteRecurring,
  deleteTransaction,
  setRecurringCanceled,
} from "@/lib/actions/management";
import { Badge } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { monthlyAmount, formatTRY, toTRY, type FxRates } from "@/lib/finance";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { RecurringItem, Transaction } from "@/lib/types";

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const [pending, startTransition] = useTransition();
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
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Delete?"
          onConfirm={() =>
            startTransition(async () => {
              await deleteTransaction(transaction.id);
            })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
          <span className="sr-only">Delete transaction</span>
        </ConfirmButton>
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await setRecurringCanceled(item.id, active);
              if (result && !result.ok) setError(result.message);
            });
          }}
        >
          {active ? "Cancel" : "Reactivate"}
        </Button>
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Delete?"
          onConfirm={() =>
            startTransition(async () => {
              await deleteRecurring(item.id);
            })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
          <span className="sr-only">Delete recurring item</span>
        </ConfirmButton>
      </div>
      {error && (
        <p role="status" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
