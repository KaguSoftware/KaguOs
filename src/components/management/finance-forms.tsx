"use client";

import { useRouter } from "next/navigation";
import { createRecurring, createTransaction } from "@/lib/actions/management";
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

export function NewTransactionForm({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <CreateForm
      action={createTransaction}
      fieldLabels={{
        amount: "Amount",
        occurred_on: "Date",
        client: "Client",
        notes: "Notes",
      }}
      submitLabel="Record transaction"
      onCancel={() => router.back()}
      onDone={() => router.push("/management/finance")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Direction" htmlFor="txn-type">
          <Dropdown id="txn-type" name="type" defaultValue="income" options={TYPE_OPTIONS} />
        </Field>
        <Field label="Date" htmlFor="txn-date" hint="Empty = today.">
          <DatePicker id="txn-date" name="occurred_on" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="txn-amount">
          <NumberInput id="txn-amount" name="amount" />
        </Field>
        <Field label="Currency" htmlFor="txn-currency">
          <Dropdown
            id="txn-currency"
            name="currency"
            defaultValue="TRY"
            options={CURRENCY_OPTIONS}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="txn-client">
          <Input id="txn-client" name="client" maxLength={160} placeholder="Who it's from / to" />
        </Field>
        <Field label="Project" htmlFor="txn-project">
          <Dropdown
            id="txn-project"
            name="project_id"
            defaultValue=""
            options={[
              { value: "", label: "No project" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </Field>
      </div>
      <Field label="Notes" htmlFor="txn-notes">
        <Textarea id="txn-notes" name="notes" rows={3} />
      </Field>
    </CreateForm>
  );
}

export function NewRecurringForm() {
  const router = useRouter();
  return (
    <CreateForm
      action={createRecurring}
      fieldLabels={{
        name: "Name",
        amount: "Amount",
        counterparty: "Counterparty",
        started_on: "Start date",
        notes: "Notes",
      }}
      submitLabel="Add recurring item"
      onCancel={() => router.back()}
      onDone={() => router.push("/management/finance")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="rec-name">
          <Input id="rec-name" name="name" maxLength={160} autoFocus placeholder="e.g. Vercel Pro" />
        </Field>
        <Field label="Direction" htmlFor="rec-type">
          <Dropdown
            id="rec-type"
            name="type"
            defaultValue="expense"
            options={[
              { value: "expense", label: "Subscription we pay" },
              { value: "income", label: "Recurring income (retainer)" },
            ]}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount" htmlFor="rec-amount">
          <NumberInput id="rec-amount" name="amount" />
        </Field>
        <Field label="Currency" htmlFor="rec-currency">
          <Dropdown
            id="rec-currency"
            name="currency"
            defaultValue="USD"
            options={CURRENCY_OPTIONS}
          />
        </Field>
        <Field label="Billing" htmlFor="rec-cadence">
          <Dropdown
            id="rec-cadence"
            name="cadence"
            defaultValue="monthly"
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Counterparty" htmlFor="rec-counterparty" hint="Vendor or client.">
          <Input id="rec-counterparty" name="counterparty" maxLength={160} />
        </Field>
        <Field label="Started" htmlFor="rec-started" hint="Empty = today.">
          <DatePicker id="rec-started" name="started_on" />
        </Field>
      </div>
      <Field label="Notes" htmlFor="rec-notes">
        <Textarea id="rec-notes" name="notes" rows={3} />
      </Field>
    </CreateForm>
  );
}
