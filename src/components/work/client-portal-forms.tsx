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
import {
  INVOICE_CURRENCIES,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
} from "@/lib/types";

/**
 * The two create surfaces behind the client view.
 *
 * Both write something a CUSTOMER will read, which is why they get a page each
 * rather than an expander in the list: the empty-field confirm that CreateForm
 * gives every create flow in this app is the last thing between a half-written
 * sentence and somebody's portal.
 *
 * Neither form can publish on the first submit, and that is deliberate in both
 * cases — a new milestone defaults to visible because the plan is agreed with
 * the client anyway, but a new invoice is always a draft. The difference is
 * what a mistake costs: a milestone worded badly is embarrassing, and an
 * invoice with a digit missing is a bill.
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

export function NewMilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const back = `/work/projects/${projectId}/client`;

  return (
    <CreateForm
      action={createMilestone}
      fieldLabels={{ title: "Title", detail: "Detail", target_on: "Target date" }}
      submitLabel="Add milestone"
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
