"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setFxRate } from "@/lib/actions/management";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { cn, formatDate } from "@/lib/utils";
import type { FxRates } from "@/lib/finance";

function RateRow({
  currency,
  current,
}: {
  currency: "USD" | "EUR";
  current: number | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Number(new FormData(event.currentTarget).get(`rate-${currency}`));
        setMessage(null);
        startTransition(async () => {
          const result = await setFxRate(currency, value);
          if (result) setMessage({ ok: result.ok, text: result.message });
        });
      }}
    >
      <span className="w-16 font-mono text-sm text-muted">1 {currency} =</span>
      <NumberInput
        name={`rate-${currency}`}
        defaultValue={current ?? ""}
        decimals={4}
        suffix="TL"
        className="w-36"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        Save
      </Button>
      {message && (
        <span
          role="status"
          className={cn("text-[13px]", message.ok ? "text-primary-dim" : "text-danger")}
        >
          {message.text}
        </span>
      )}
    </form>
  );
}

export function FxEditor({
  rates,
  updatedAt,
}: {
  rates: FxRates;
  updatedAt: string | null;
}) {
  return (
    <div className="space-y-3 p-4">
      <RateRow currency="USD" current={rates.USD} />
      <RateRow currency="EUR" current={rates.EUR} />
      <p className="text-xs text-faint">
        Entered by hand and stored until changed — all TL totals use these.
        {updatedAt && ` Last change: ${formatDate(updatedAt)}.`}
      </p>
    </div>
  );
}
