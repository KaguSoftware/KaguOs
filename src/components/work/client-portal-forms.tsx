"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateForm } from "@/components/ui/create";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { createInvoice, createMilestone } from "@/lib/actions/client-portal";
import { createPaymentPlan } from "@/lib/actions/payment-plans";
import { layOutSchedule, MAX_PAYMENTS } from "@/lib/payments";
import {
  INVOICE_CURRENCIES,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
  PAYMENT_CADENCES,
  PAYMENT_CADENCE_LABELS,
  PAYMENT_PLAN_KINDS,
  PAYMENT_PLAN_KIND_LABELS,
  PAYMENT_PLAN_STATUSES,
  PAYMENT_PLAN_STATUS_LABELS,
  type PaymentCadence,
  type PaymentPlanKind,
} from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

/**
 * The three create surfaces behind the client view.
 *
 * All of them write something a CUSTOMER will read, which is why they get a
 * page each rather than an expander in the list: the empty-field confirm that
 * CreateForm gives every create flow in this app is the last thing between a
 * half-written sentence and somebody's portal.
 *
 * The defaults differ by what a mistake costs. A new phase is visible straight
 * away because the plan is agreed with the client anyway; a new invoice is
 * always a draft, because one with a digit missing is a bill. A payment plan
 * sits between the two — visible, but it writes a dozen dated rows at once, so
 * it shows them before it writes them.
 */

const MILESTONE_OPTIONS = MILESTONE_STATUSES.map((status) => ({
  value: status,
  label: MILESTONE_STATUS_LABELS[status],
}));

const INVOICE_OPTIONS = INVOICE_STATUSES.map((status) => ({
  value: status,
  label: INVOICE_STATUS_LABELS[status],
}));

const CURRENCY_OPTIONS = INVOICE_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency,
}));

const PLAN_KIND_OPTIONS = PAYMENT_PLAN_KINDS.map((kind) => ({
  value: kind,
  label: PAYMENT_PLAN_KIND_LABELS[kind],
}));

const CADENCE_OPTIONS = PAYMENT_CADENCES.map((cadence) => ({
  value: cadence,
  label: PAYMENT_CADENCE_LABELS[cadence],
}));

const PLAN_STATUS_OPTIONS = PAYMENT_PLAN_STATUSES.map((status) => ({
  value: status,
  label: PAYMENT_PLAN_STATUS_LABELS[status],
}));

/**
 * A phase of the build.
 *
 * ── Why the weight field arrives pre-filled ────────────────────────────────
 *
 * With whatever share of the project is still unallocated. A producer adding
 * the fourth phase of four should not have to open a calculator to discover
 * that 25 + 30 + 20 leaves 25 — and a form that starts at the right answer is
 * the only version of this feature where the weights routinely add up to 100.
 * It is a default, not a rule: type over it whenever the phase is a different
 * size from what is left.
 */
export function NewMilestoneForm({
  projectId,
  /** 100 minus everything already handed out, floored at 0. */
  suggestedWeight,
  allocated,
}: {
  projectId: string;
  suggestedWeight: number;
  allocated: number;
}) {
  const router = useRouter();
  const back = `/work/projects/${projectId}/client`;

  return (
    <CreateForm
      action={createMilestone}
      fieldLabels={{ title: "Title", detail: "Detail", target_on: "Target date" }}
      submitLabel="Add phase"
      onCancel={() => router.back()}
      onDone={() => router.push(back)}
    >
      <input type="hidden" name="project_id" value={projectId} />

      <Field
        label="Title"
        htmlFor="ms-title"
        hint="What the client sees in their timeline — “Menu and prices loaded”."
      >
        <Input id="ms-title" name="title" maxLength={160} />
      </Field>

      <Field
        label="Detail"
        htmlFor="ms-detail"
        hint="Optional. Read verbatim by the client, so write it in their language."
      >
        <Textarea id="ms-detail" name="detail" maxLength={4000} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Weight"
          htmlFor="ms-weight"
          hint={
            allocated > 0
              ? `Share of the whole project. ${allocated}% is already allocated across the other phases.`
              : "Share of the whole project — finishing this phase moves the client's bar by this much."
          }
        >
          <NumberInput
            id="ms-weight"
            name="weight"
            defaultValue={suggestedWeight}
            suffix="%"
          />
        </Field>
        <Field
          label="Completion"
          htmlFor="ms-completion"
          hint="How far through this phase alone. Usually 0 on a new one."
        >
          <NumberInput id="ms-completion" name="completion" defaultValue="0" suffix="%" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="ms-status">
          <Dropdown
            id="ms-status"
            name="status"
            defaultValue="planned"
            options={MILESTONE_OPTIONS}
            searchThreshold={0}
          />
        </Field>
        <Field label="Target date" htmlFor="ms-target" hint="Optional.">
          <DatePicker id="ms-target" name="target_on" />
        </Field>
      </div>

      <Checkbox
        name="visible_to_client"
        defaultChecked
        label="Visible to the client straight away"
      />
    </CreateForm>
  );
}

export function NewInvoiceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const back = `/work/projects/${projectId}/client`;
  // The paid-on field only means anything for a status of 'paid', and showing
  // it always would invite somebody to date an invoice that hasn't been paid.
  const [status, setStatus] = useState("draft");

  return (
    <CreateForm
      action={createInvoice}
      fieldLabels={{
        number: "Number",
        title: "What it is for",
        amount: "Amount",
        due_on: "Due date",
      }}
      submitLabel="Add invoice"
      onCancel={() => router.back()}
      onDone={() => router.push(back)}
    >
      <input type="hidden" name="project_id" value={projectId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Number"
          htmlFor="inv-number"
          hint="Whatever it says on the document you sent."
        >
          <Input id="inv-number" name="number" maxLength={40} />
        </Field>
        <Field label="What it is for" htmlFor="inv-title">
          <Input id="inv-title" name="title" maxLength={200} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="inv-amount">
          <NumberInput id="inv-amount" name="amount" />
        </Field>
        <Field label="Currency" htmlFor="inv-currency">
          <Dropdown
            id="inv-currency"
            name="currency"
            defaultValue="USD"
            options={CURRENCY_OPTIONS}
            searchThreshold={0}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Issued" htmlFor="inv-issued" hint="Empty = today.">
          <DatePicker id="inv-issued" name="issued_on" />
        </Field>
        <Field label="Due" htmlFor="inv-due" hint="Optional. Drives the overdue flag.">
          <DatePicker id="inv-due" name="due_on" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Status"
          htmlFor="inv-status"
          hint="A draft is invisible to the client until you set it to Sent."
        >
          <Dropdown
            id="inv-status"
            name="status"
            value={status}
            onChange={setStatus}
            options={INVOICE_OPTIONS}
            searchThreshold={0}
          />
        </Field>
        {status === "paid" && (
          <Field label="Paid on" htmlFor="inv-paid" hint="Empty = today.">
            <DatePicker id="inv-paid" name="paid_on" />
          </Field>
        )}
      </div>

      <Field
        label="Note"
        htmlFor="inv-note"
        hint="Shown to the client verbatim — a payment reference, or what a part-payment covered."
      >
        <Textarea id="inv-note" name="note" maxLength={2000} />
      </Field>
    </CreateForm>
  );
}

/**
 * A payment plan, and the schedule it implies.
 *
 * ── Why this form previews itself ──────────────────────────────────────────
 *
 * Because it is the one create surface in KaguOs where pressing the button
 * writes twelve rows instead of one. "Monthly, from the 31st, for a year" is
 * easy to say and easy to get wrong by a month, and the difference between a
 * plan that is right and one that is off by one is invisible until a client
 * reads it in their portal. So the dates appear as you type them, from the same
 * function that will write them (`layOutSchedule`).
 *
 * ── Two ways to say the amount ─────────────────────────────────────────────
 *
 * Per payment ("$1,200 a month"), or a total to divide ("$9,000 in three").
 * Both are how people actually describe the same agreement, so both are here,
 * and the per-payment figure wins if somebody fills in both — it is the more
 * specific statement, and the one the client was quoted.
 */
export function NewPaymentPlanForm({
  projectId,
  today,
}: {
  projectId: string;
  today: string;
}) {
  const router = useRouter();
  const back = `/work/projects/${projectId}/client`;

  const [kind, setKind] = useState<PaymentPlanKind>("installments");
  const [cadence, setCadence] = useState<PaymentCadence>("monthly");
  const [currency, setCurrency] = useState("USD");
  const [startsOn, setStartsOn] = useState(today);
  const [count, setCount] = useState("3");
  const [each, setEach] = useState("");
  const [total, setTotal] = useState("");

  const schedule = layOutSchedule({
    startsOn: startsOn || today,
    cadence,
    count: Math.max(0, Math.min(Number(count) || 0, MAX_PAYMENTS)),
    each: Number(each) > 0 ? Number(each) : null,
    total: Number(total) > 0 ? Number(total) : null,
  });
  const scheduled = schedule.reduce((sum, row) => sum + row.amount, 0);

  return (
    <CreateForm
      action={createPaymentPlan}
      fieldLabels={{ title: "Name", count: "Number of payments" }}
      submitLabel="Create plan"
      onCancel={() => router.back()}
      onDone={() => router.push(back)}
    >
      <input type="hidden" name="project_id" value={projectId} />

      <Field
        label="Name"
        htmlFor="pp-title"
        hint="What the client sees — “Build fee, in three” or “Monthly retainer”."
      >
        <Input id="pp-title" name="title" maxLength={160} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Shape"
          htmlFor="pp-kind"
          hint="Only changes how it is described. The payments are the same rows."
        >
          <Dropdown
            id="pp-kind"
            name="kind"
            value={kind}
            onChange={(value) => setKind(value as PaymentPlanKind)}
            options={PLAN_KIND_OPTIONS}
            searchThreshold={0}
          />
        </Field>
        <Field label="Every" htmlFor="pp-cadence">
          <Dropdown
            id="pp-cadence"
            name="cadence"
            value={cadence}
            onChange={(value) => setCadence(value as PaymentCadence)}
            options={CADENCE_OPTIONS}
            searchThreshold={0}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Amount per payment"
          htmlFor="pp-each"
          hint="The usual way."
        >
          <NumberInput
            id="pp-each"
            name="amount_each"
            onValueChange={setEach}
            suffix={currency}
          />
        </Field>
        <Field
          label="…or a total to divide"
          htmlFor="pp-total"
          hint="Split evenly; the last payment takes the odd cent."
        >
          <NumberInput
            id="pp-total"
            name="total_amount"
            onValueChange={setTotal}
            suffix={currency}
          />
        </Field>
        <Field label="Currency" htmlFor="pp-currency">
          <Dropdown
            id="pp-currency"
            name="currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
            searchThreshold={0}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First payment" htmlFor="pp-starts" hint="Empty = today.">
          <DatePicker
            id="pp-starts"
            name="starts_on"
            defaultValue={today}
            onChange={setStartsOn}
          />
        </Field>
        <Field
          label="Number of payments"
          htmlFor="pp-count"
          hint="An open-ended retainer: leave a year here and extend it later."
        >
          <NumberInput
            id="pp-count"
            name="count"
            defaultValue="3"
            decimals={0}
            onValueChange={setCount}
          />
        </Field>
        <Field
          label="Ends"
          htmlFor="pp-ends"
          hint="Optional, and shown to the client. Blank = open-ended."
        >
          <DatePicker id="pp-ends" name="ends_on" />
        </Field>
      </div>

      {/* The whole reason this form is not three fields and a button. */}
      <div className="rounded-md border border-line bg-raised/30 p-3">
        <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
          What this writes
        </p>
        {schedule.length === 0 ? (
          <p className="mt-2 text-[calc(13px*var(--text-scale,1))] text-faint">
            No amount yet — the plan saves on its own and you add its payments by
            hand, which is what a bespoke schedule wants anyway.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[calc(13px*var(--text-scale,1))] text-ink">
              {schedule.length} {schedule.length === 1 ? "payment" : "payments"},{" "}
              {formatMoney(scheduled, currency)} in total.
            </p>
            <ul className="mt-2 grid gap-0.5">
              {schedule.slice(0, 6).map((row) => (
                <li
                  key={row.seq}
                  className="flex justify-between gap-4 font-mono text-[calc(12px*var(--text-scale,1))] tabular-nums"
                >
                  <span className="text-muted">{formatDate(row.due_on)}</span>
                  <span className="text-ink">{formatMoney(row.amount, currency)}</span>
                </li>
              ))}
            </ul>
            {schedule.length > 6 && (
              <p className="mt-1.5 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                …and {schedule.length - 6} more, through{" "}
                {formatDate(schedule[schedule.length - 1].due_on)}.
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Status"
          htmlFor="pp-status"
          hint="A draft is invisible to the client, payments and all."
        >
          <Dropdown
            id="pp-status"
            name="status"
            defaultValue="active"
            options={PLAN_STATUS_OPTIONS}
            searchThreshold={0}
          />
        </Field>
      </div>

      <Field
        label="Note"
        htmlFor="pp-note"
        hint="Shown to the client verbatim — how to pay, what the retainer covers."
      >
        <Textarea id="pp-note" name="note" maxLength={2000} />
      </Field>

      <Checkbox
        name="visible_to_client"
        defaultChecked
        label="Visible to the client straight away"
      />
    </CreateForm>
  );
}
