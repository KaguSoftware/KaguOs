"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { CreateForm } from "@/components/ui/create";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  createInvoice,
  createMilestone,
  createProjectLink,
} from "@/lib/actions/client-portal";
import { createPaymentPlan } from "@/lib/actions/payment-plans";
import { cleanCustomSchedule, layOutSchedule, MAX_PAYMENTS } from "@/lib/payments";
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
  PROJECT_LINK_KINDS,
  PROJECT_LINK_KIND_HINTS,
  PROJECT_LINK_KIND_LABELS,
  type PaymentCadence,
  type PaymentPlanKind,
  type ProjectLinkKind,
} from "@/lib/types";
import { addMonths, formatDate, formatMoney } from "@/lib/utils";

/**
 * The four create surfaces behind the client view.
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

const LINK_KIND_OPTIONS = PROJECT_LINK_KINDS.map((kind) => ({
  value: kind,
  label: PROJECT_LINK_KIND_LABELS[kind],
  hint: PROJECT_LINK_KIND_HINTS[kind],
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

/* ── A schedule with no rhythm ────────────────────────────────────────────── */

type CustomRow = { key: number; label: string; amount: string; due_on: string };

/**
 * The typed-out schedule of a custom plan (0078).
 *
 * ── Why this replaces the generator rather than sitting beside it ──────────
 *
 * Because the two describe incompatible things. A cadence, a count and a start
 * date are a rule that produces dates; a custom plan HAS no rule, and leaving
 * the generator's fields on screen next to a list you are typing would leave
 * the producer guessing which of the two the button is about to obey. Choosing
 * "Custom dates" is choosing which one, so the other one goes away.
 *
 * ── Why the rows are JSON in a hidden field ────────────────────────────────
 *
 * FormData is a flat map of strings, and a variable-length list of triples
 * either becomes `row[3][amount]`-style key parsing on the server or one field
 * that says exactly what it is. The action parses it defensively either way —
 * a POST from outside this form can put anything in there — so the honest
 * shape wins. See `parseCustomRows`.
 *
 * ── The blank row at the bottom ────────────────────────────────────────────
 *
 * There is always one, and it is not an error. Somebody typing a schedule ends
 * every row wanting another; `cleanCustomSchedule` drops the unfilled ones on
 * both sides, so the trailing blank costs nothing and removes a click per
 * payment.
 */
function CustomSchedule({
  rows,
  setRows,
  currency,
}: {
  rows: CustomRow[];
  setRows: (next: CustomRow[]) => void;
  currency: string;
}) {
  function update(key: number, patch: Partial<CustomRow>) {
    const next = rows.map((row) => (row.key === key ? { ...row, ...patch } : row));
    const last = next[next.length - 1];
    // Typing into the trailing blank grows the list, so the next row is always
    // there without anybody asking for it.
    if (last && (last.amount !== "" || last.due_on !== "" || last.label !== "")) {
      const guess = last.due_on ? addMonths(last.due_on, 1) : "";
      next.push({ key: last.key + 1, label: "", amount: "", due_on: guess });
    }
    setRows(next.slice(0, MAX_PAYMENTS + 1));
  }

  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={row.key} className="flex flex-wrap items-center gap-2">
          <span className="w-5 shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
            {index + 1}
          </span>
          <div className="w-40">
            <DatePicker
              name={`custom-due-${row.key}`}
              defaultValue={row.due_on}
              onChange={(iso) => update(row.key, { due_on: iso })}
            />
          </div>
          <div className="w-36">
            <NumberInput
              name={`custom-amount-${row.key}`}
              defaultValue={row.amount}
              onValueChange={(value) => update(row.key, { amount: value })}
              suffix={currency}
            />
          </div>
          <div className="min-w-[9rem] flex-1">
            <Input
              value={row.label}
              onChange={(event) => update(row.key, { label: event.target.value })}
              maxLength={160}
              placeholder="On signature, on launch…"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove payment ${index + 1}`}
            // The last row is the blank one you type into; removing it would
            // leave nowhere to add the next payment.
            disabled={rows.length === 1 || index === rows.length - 1}
            onClick={() => setRows(rows.filter((entry) => entry.key !== row.key))}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      ))}
    </div>
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
  const [rows, setRows] = useState<CustomRow[]>([
    { key: 0, label: "", amount: "", due_on: today },
  ]);

  const custom = kind === "custom";

  // Both branches end in the same shape, so everything downstream — the
  // preview, the total, the hidden field — is written once rather than twice.
  const schedule = useMemo(
    () =>
      custom
        ? cleanCustomSchedule(rows)
        : layOutSchedule({
            startsOn: startsOn || today,
            cadence,
            count: Math.max(0, Math.min(Number(count) || 0, MAX_PAYMENTS)),
            each: Number(each) > 0 ? Number(each) : null,
            total: Number(total) > 0 ? Number(total) : null,
          }),
    [custom, rows, startsOn, today, cadence, count, each, total]
  );
  const scheduled = schedule.reduce((sum, row) => sum + row.amount, 0);

  return (
    <CreateForm
      action={createPaymentPlan}
      // `count` is only a field when the generator is on screen. Listing it on a
      // custom plan would make the empty-field confirm fire on every submit,
      // for an input that isn't there — and a confirm that always fires is one
      // people learn to click through.
      fieldLabels={
        custom
          ? { title: "Name" }
          : { title: "Name", count: "Number of payments" }
      }
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
        {!custom && (
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
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {!custom && (
          <>
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
          </>
        )}
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

      {/* The generator's inputs — a rule that produces dates. A custom plan has
          no such rule, so they are replaced rather than disabled: leaving a
          cadence and a count on screen beside a list you are typing leaves it
          ambiguous which of the two the button obeys. */}
      {custom ? (
        <Field
          label="The payments"
          hint="A date and an amount each. The label is optional and the client reads it. Type in the last row to add another; they sort by date when saved."
        >
          <CustomSchedule rows={rows} setRows={setRows} currency={currency} />
        </Field>
      ) : (
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
      )}

      {/* The rows, as the action will read them. Hidden rather than assembled
          from named inputs because they are a variable-length list — see
          CustomSchedule's header. */}
      {custom && (
        <input
          type="hidden"
          name="custom_rows"
          value={JSON.stringify(
            schedule.map((row) => ({
              label: row.label ?? "",
              amount: row.amount,
              due_on: row.due_on,
            }))
          )}
        />
      )}

      {/* The whole reason this form is not three fields and a button. */}
      <div className="rounded-md border border-line bg-raised/30 p-3">
        <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
          What this writes
        </p>
        {schedule.length === 0 ? (
          <p className="mt-2 text-[calc(13px*var(--text-scale,1))] text-faint">
            {custom
              ? "Nothing filled in yet — a payment needs a date and an amount above zero to count."
              : "No amount yet — the plan saves on its own and you add its payments by hand, which is what a bespoke schedule wants anyway."}
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[calc(13px*var(--text-scale,1))] text-ink">
              {schedule.length} {schedule.length === 1 ? "payment" : "payments"},{" "}
              {formatMoney(scheduled, currency)} in total.
            </p>
            {/* A generated schedule is a rule, and six rows are enough to see
                the rule is right. A typed one is not — every row is a separate
                decision somebody made, and truncating it hides the one they
                fat-fingered. */}
            <ul className="mt-2 grid gap-0.5">
              {(custom ? schedule : schedule.slice(0, 6)).map((row) => (
                <li
                  key={row.seq}
                  className="flex justify-between gap-4 font-mono text-[calc(12px*var(--text-scale,1))] tabular-nums"
                >
                  <span className="text-muted">
                    {formatDate(row.due_on)}
                    {row.label && (
                      <span className="ml-2 text-faint">{row.label}</span>
                    )}
                  </span>
                  <span className="text-ink">{formatMoney(row.amount, currency)}</span>
                </li>
              ))}
            </ul>
            {!custom && schedule.length > 6 && (
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

/**
 * Something the client can go and open (0082).
 *
 * ── Why this gets a page like the other two ────────────────────────────────
 *
 * A link is two fields and could plausibly be an inline "+" in the panel. It
 * gets the full surface anyway, because of the third field: the paragraph
 * underneath. A TestFlight invite with no instructions produces a message back
 * asking what TestFlight is, and an inline row is exactly the shape that makes
 * somebody skip writing them. The empty-field confirm names Detail for the
 * same reason.
 *
 * ── The visibility default, and why it is the opposite of an invoice's ─────
 *
 * Checked. A link is pasted in at the moment somebody wants it seen — usually
 * with the client already asking — and the mistake it guards against is small
 * and instantly reversible. An invoice defaults to draft because the mistake
 * there is a bill.
 */
export function NewProjectLinkForm({
  projectId,
  /** This project's phases, "The whole project" first. */
  phases,
}: {
  projectId: string;
  phases: { value: string; label: string }[];
}) {
  const router = useRouter();
  const back = `/work/projects/${projectId}/client`;
  const [kind, setKind] = useState<ProjectLinkKind>("preview");

  return (
    <CreateForm
      action={createProjectLink}
      fieldLabels={{ label: "Name", url: "Address", detail: "Detail" }}
      submitLabel="Add link"
      onCancel={() => router.back()}
      onDone={() => router.push(back)}
    >
      <input type="hidden" name="project_id" value={projectId} />

      <Field
        label="Name"
        htmlFor="pl-label"
        hint="What the client sees — “Your booking app (test build)”, not “web-preview-3”."
      >
        <Input id="pl-label" name="label" maxLength={120} />
      </Field>

      <Field
        label="Address"
        htmlFor="pl-url"
        hint="Paste it whole. Anything that isn't an http or https address is refused."
      >
        <Input
          id="pl-url"
          name="url"
          type="url"
          inputMode="url"
          maxLength={2000}
          placeholder="https://touch-padel.vercel.app"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" htmlFor="pl-kind" hint={PROJECT_LINK_KIND_HINTS[kind]}>
          <Dropdown
            id="pl-kind"
            name="kind"
            defaultValue="preview"
            options={LINK_KIND_OPTIONS}
            onChange={(value) => setKind(value as ProjectLinkKind)}
            searchThreshold={0}
          />
        </Field>
        <Field
          label="Belongs to"
          htmlFor="pl-milestone"
          hint="Which phase this is for. Leave it on the whole project for a site or a doc that isn't about one part."
        >
          <Dropdown
            id="pl-milestone"
            name="milestone_id"
            defaultValue=""
            options={phases}
            placeholder="The whole project"
          />
        </Field>
      </div>

      <Field
        label="Detail"
        htmlFor="pl-detail"
        hint="Optional, and usually the difference between a link that gets used and a message asking how. Read verbatim by the client."
      >
        <Textarea
          id="pl-detail"
          name="detail"
          maxLength={2000}
          placeholder="Install TestFlight from the App Store first, then open this on the same phone. Tell us which Apple ID to invite and we'll add it."
        />
      </Field>

      <Checkbox
        name="visible_to_client"
        defaultChecked
        label="Visible to the client straight away"
      />
    </CreateForm>
  );
}
