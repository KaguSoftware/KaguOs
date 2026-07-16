"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTRY, type MonthPoint } from "@/lib/finance";

// Chart marks — darker steps of the theme hues, validated with the dataviz
// palette validator (L band 0.48–0.67 dark, CVD floor met with fixed bar
// positions + legend as secondary encoding).
const INCOME = "oklch(0.62 0.13 160)";
const EXPENSE = "oklch(0.55 0.16 25)";

function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const expense = payload.find((p) => p.dataKey === "expense")?.value ?? 0;
  return (
    <div className="rounded-md border border-line bg-raised/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur-md">
      <p className="mb-1 text-xs font-medium text-ink">{label}</p>
      <p className="flex justify-between gap-4 text-xs text-muted">
        <span>In</span>
        <span className="font-mono text-ink">{formatTRY(income)}</span>
      </p>
      <p className="flex justify-between gap-4 text-xs text-muted">
        <span>Out</span>
        <span className="font-mono text-ink">{formatTRY(expense)}</span>
      </p>
      <p className="mt-1 flex justify-between gap-4 border-t border-line pt-1 text-xs text-muted">
        <span>Net</span>
        <span className="font-mono text-ink">{formatTRY(income - expense)}</span>
      </p>
    </div>
  );
}

export function CashflowChart({ data }: { data: MonthPoint[] }) {
  return (
    <div>
      <div className="flex items-center gap-4 px-4 pt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: INCOME }} aria-hidden />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: EXPENSE }} aria-hidden />
          Expense
        </span>
        <span className="ml-auto text-faint">TL equivalent, last 12 months</span>
      </div>
      <div className="h-64 px-2 pb-2 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--faint)", fontSize: 11 }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={compact}
              tick={{ fill: "var(--faint)", fontSize: 11 }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "oklch(1 0 0 / 5%)" }}
            />
            <Bar dataKey="income" name="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="expense" name="Expense" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type BreakdownItem = { name: string; value: number; type: "income" | "expense" };

export function RecurringBreakdown({ items }: { items: BreakdownItem[] }) {
  const height = Math.max(120, items.length * 34 + 24);
  return (
    <div className="px-2 pb-2" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false}>
            {items.map((item) => (
              <Cell key={item.name} fill={item.type === "income" ? INCOME : EXPENSE} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value) => formatTRY(Number(value))}
              style={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
