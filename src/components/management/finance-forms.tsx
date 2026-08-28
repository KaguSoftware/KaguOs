"use client";

import { useRouter } from "next/navigation";
import {
  createRecurring,
  createTransaction,
  updateRecurring,
  updateTransaction,
} from "@/lib/actions/management";
import type { RecurringItem, Transaction } from "@/lib/types";
import { ordinalDay } from "@/lib/finance";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";

const TYPE_OPTIONS = [
  { value: "income", label: "Incoming", hint: "Money coming in" },
  { value: "expense", label: "Outgoing", hint: "Money going out" },
];

const CURRENCY_OPTIONS = [
  { value: "TRY", label: "TRY — Turkish lira" },
  { value: "USD", label: "USD — US dollar" },
  { value: "EUR", label: "EUR — Euro" },
];

/**
 * The day of the month a subscription charges on. "Same day it started" leads,
 * because it's true of most rows and saves the extra decision; picking a day is
 * for the common case where it isn't — a trial that converted on the 1st, a
 * retainer invoiced every 15th.
 *
 * 29–31 are offered rather than hidden. They're real billing days, and the
 * hint says what happens in the months that are shorter instead of making
 * someone guess.
 */
const BILLING_DAY_OPTIONS = [
  { value: "", label: "Same day it started" },
  ...Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return {
      value: String(day),
      label: `The ${ordinalDay(day)}`,
      hint: day > 28 ? "Shorter months bill on their last day" : undefined,
    };
  }),
];

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid", hint: "The money has moved" },
  { value: "pending", label: "Pending", hint: "Invoice sent / bill due — not settled yet" },
];

export function NewTransactionForm({
  projects,
  transaction,
}: {
  projects: { id: string; name: string }[];
  transaction?: Transaction;
}) {
  const router = useRouter();
  return (
    <CreateForm
      action={transaction ? updateTransaction : createTransaction}
      fieldLabels={{
        amount: "Amount",
        occurred_on: "Date",
        client: "Client",
        notes: "Notes",
      }}
      submitLabel={transaction ? "Save transaction" : "Record transaction"}
      onCancel={() => router.back()}
      onDone={() => router.push("/management/finance")}
    >
      {transaction && <input type="hidden" name="id" value={transaction.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Direction" htmlFor="txn-type">
          <Dropdown
            id="txn-type"
            name="type"
            defaultValue={transaction?.type ?? "income"}
            options={TYPE_OPTIONS}
          />
        </Field>
        <Field label="Date" htmlFor="txn-date" hint="Empty = today.">
          <DatePicker
            id="txn-date"
            name="occurred_on"
            defaultValue={transaction?.occurred_on ?? ""}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="txn-amount">
          <NumberInput
            id="txn-amount"
            name="amount"
            defaultValue={transaction ? Number(transaction.amount) : ""}
          />
        </Field>
        <Field label="Currency" htmlFor="txn-currency">
          <Dropdown
            id="txn-currency"
            name="currency"
            defaultValue={transaction?.currency ?? "TRY"}
            options={CURRENCY_OPTIONS}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="txn-status" hint="Pending stays out of totals until paid.">
          <Dropdown
            id="txn-status"
            name="status"
            defaultValue={transaction?.status ?? "paid"}
            options={STATUS_OPTIONS}
          />
        </Field>
        <Field label="Project" htmlFor="txn-project">
          <Dropdown
            id="txn-project"
            name="project_id"
            defaultValue={transaction?.project_id ?? ""}
            options={[
              { value: "", label: "No project" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </Field>
      </div>
      <Field label="Client" htmlFor="txn-client">
        <Input
          id="txn-client"
          name="client"
          maxLength={160}
          defaultValue={transaction?.client ?? ""}
          placeholder="Who it's from / to"
        />
      </Field>
      <Field label="Notes" htmlFor="txn-notes">
        <Textarea
          id="txn-notes"
          name="notes"
          rows={3}
          defaultValue={transaction?.notes ?? ""}
        />
      </Field>
    </CreateForm>
  );
}

export function NewRecurringForm({ item }: { item?: RecurringItem }) {
  const router = useRouter();
  return (
    <CreateForm
      action={item ? updateRecurring : createRecurring}
      fieldLabels={{
        name: "Name",
        amount: "Amount",
        counterparty: "Counterparty",
        started_on: "Start date",
        notes: "Notes",
      }}
      submitLabel={item ? "Save recurring item" : "Add recurring item"}
      onCancel={() => router.back()}
      onDone={() => router.push("/management/finance")}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="rec-name">
          <Input
            id="rec-name"
            name="name"
            maxLength={160}
            autoFocus={!item}
            defaultValue={item?.name ?? ""}
            placeholder="e.g. Vercel Pro"
          />
        </Field>
        <Field label="Direction" htmlFor="rec-type">
          <Dropdown
            id="rec-type"
            name="type"
            defaultValue={item?.type ?? "expense"}
            options={[
              { value: "expense", label: "Subscription we pay" },
              { value: "income", label: "Recurring income (retainer)" },
            ]}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount" htmlFor="rec-amount">
          <NumberInput
            id="rec-amount"
            name="amount"
            defaultValue={item ? Number(item.amount) : ""}
          />
        </Field>
        <Field label="Currency" htmlFor="rec-currency">
          <Dropdown
            id="rec-currency"
            name="currency"
            defaultValue={item?.currency ?? "USD"}
            options={CURRENCY_OPTIONS}
          />
        </Field>
        <Field label="Billing" htmlFor="rec-cadence">
          <Dropdown
            id="rec-cadence"
            name="cadence"
            defaultValue={item?.cadence ?? "monthly"}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Started" htmlFor="rec-started" hint="Empty = today.">
          <DatePicker
            id="rec-started"
            name="started_on"
            defaultValue={item?.started_on ?? ""}
          />
        </Field>
        {/* Sits beside the start date because the two are read together: when
            it began, and which day it charges from then on. */}
        <Field
          label="Bills on"
          htmlFor="rec-billing-day"
          hint="Which day the money actually moves."
        >
          <Dropdown
            id="rec-billing-day"
            name="billing_day"
            defaultValue={item?.billing_day ? String(item.billing_day) : ""}
            options={BILLING_DAY_OPTIONS}
            searchPlaceholder="Day…"
          />
        </Field>
      </div>
      <Field label="Counterparty" htmlFor="rec-counterparty" hint="Vendor or client.">
        <Input
          id="rec-counterparty"
          name="counterparty"
          maxLength={160}
          defaultValue={item?.counterparty ?? ""}
        />
      </Field>
      <Field label="Notes" htmlFor="rec-notes">
        <Textarea id="rec-notes" name="notes" rows={3} defaultValue={item?.notes ?? ""} />
      </Field>
    </CreateForm>
  );
}
