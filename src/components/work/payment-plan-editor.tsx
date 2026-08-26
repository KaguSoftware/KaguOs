"use client";

import { useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Textarea } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { LinkButton } from "@/components/ui/link-button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import {
  addInstallment,
  deleteInstallment,
  deletePaymentPlan,
  extendPaymentPlan,
  markInstallmentPaid,
  updateInstallment,
  updatePaymentPlan,
} from "@/lib/actions/payment-plans";
import { paymentDate } from "@/lib/payments";
import { useAction } from "@/lib/use-action";
import type { PlanSummary } from "@/lib/data/portal";
import {
  INSTALLMENT_STATUSES,
  INSTALLMENT_STATUS_LABELS,
  INVOICE_CURRENCIES,
  PAYMENT_CADENCES,
  PAYMENT_CADENCE_LABELS,
  PAYMENT_CADENCE_PER,
  PAYMENT_PLAN_KINDS,
  PAYMENT_PLAN_KIND_LABELS,
  PAYMENT_PLAN_STATUSES,
  PAYMENT_PLAN_STATUS_LABELS,
  type ProjectPaymentInstallment,
  type ProjectPaymentPlan,
} from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

/**
 * The payment plan, from Kagu's side.
 *
 * ── What this screen is for ────────────────────────────────────────────────
 *
 * Two jobs, and they happen at wildly different frequencies. Writing the
 * agreement happens once, on the /new page, where laying out twelve dated
 * payments from one sentence is the whole trick. Marking a payment received
 * happens every month forever — so it is one click on a row, never a trip
 * through a form, and it is the only control on this panel that isn't behind a
 * disclosure.
 *
 * ── Why the schedule is editable at all ────────────────────────────────────
 *
 * Because real schedules move. A client asks to split March, a payment slips a
 * fortnight, one gets waived after an argument. A plan that could only be
 * regenerated from its parameters would lose every one of those the next time
 * somebody fixed a typo — so generation happens once and the rows are ordinary
 * records afterwards (see the header of lib/actions/payment-plans.ts).
 *
 * ── The eye down the left ──────────────────────────────────────────────────
 *
 * Same vocabulary as the milestones and invoices beside it: a plan the client
 * cannot see is marked, unmissably, on every row. The gate itself is in the RLS
 * policy (0075 §2c) — un-publish a plan and its twelve payments vanish from the
 * portal with it, because they inherit its visibility rather than carrying
 * their own.
 */

const KIND_OPTIONS = PAYMENT_PLAN_KINDS.map((kind) => ({
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

const INSTALLMENT_OPTIONS = INSTALLMENT_STATUSES.map((status) => ({
  value: status,
  label: INSTALLMENT_STATUS_LABELS[status],
}));

const CURRENCY_OPTIONS = INVOICE_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency,
}));

const LABEL =
  "mb-1.5 block font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint";

/** "$1,200 / month", or "12 payments" when they aren't all the same. */
export function planHeadline(plan: ProjectPaymentPlan, count: number): string {
  if (plan.amount_each) {
    const each = formatMoney(plan.amount_each, plan.currency);
    return plan.kind === "recurring"
      ? `${each} / ${PAYMENT_CADENCE_PER[plan.cadence]}`
      : `${count} × ${each}`;
  }
  return count === 1 ? "1 payment" : `${count} payments`;
}

/* ── One payment ──────────────────────────────────────────────────────────── */

function PaymentRow({
  projectId,
  payment,
  currency,
  today,
}: {
  projectId: string;
  payment: ProjectPaymentInstallment;
  currency: string;
  today: string;
}) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(payment.label ?? "");
  const [amount, setAmount] = useState(String(payment.amount));
  const [dueOn, setDueOn] = useState(payment.due_on);
  const [status, setStatus] = useState<string>(payment.status);
  const [paidOn, setPaidOn] = useState(payment.paid_on ?? "");
  const [note, setNote] = useState(payment.note ?? "");

  const settled = payment.status === "paid" || payment.status === "waived";
  const late = !settled && payment.due_on < today;

  return (
    <li className="border-b border-line/60 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <span className="w-6 shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
          {payment.seq}
        </span>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-left"
        >
          <span
            className={cn(
              "font-mono text-[calc(12px*var(--text-scale,1))] tabular-nums",
              late ? "text-danger" : "text-muted"
            )}
          >
            {formatDate(payment.due_on)}
          </span>
          <span
            className={cn(
              "font-mono text-[calc(13px*var(--text-scale,1))] tabular-nums",
              payment.status === "waived" ? "text-faint line-through" : "text-ink"
            )}
          >
            {formatMoney(payment.amount, currency)}
          </span>
          {payment.label && (
            <span className="min-w-0 truncate text-[calc(12px*var(--text-scale,1))] text-faint">
              {payment.label}
            </span>
          )}
        </button>

        <PaymentBadge status={payment.status} late={late} />

        {/* The monthly click. Kept out of the disclosure because it is the one
            thing anybody does to this row after the plan is written. */}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || payment.status === "waived"}
          aria-label={payment.status === "paid" ? "Mark as unpaid" : "Mark as paid"}
          onClick={() =>
            run(() =>
              markInstallmentPaid(projectId, payment.id, payment.status !== "paid")
            )
          }
        >
          {payment.status === "paid" ? (
            <Undo2 className="size-3.5" aria-hidden />
          ) : (
            <Check className="size-3.5" aria-hidden />
          )}
        </Button>

        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-faint transition-transform duration-150 ease-mac",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </div>

      {open && (
        <div className="grid gap-4 border-t border-line/60 bg-raised/20 px-3 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor={`p-label-${payment.id}`}>
                Label
              </label>
              <Input
                id={`p-label-${payment.id}`}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={160}
                placeholder="Deposit, On delivery…"
              />
            </div>
            <div>
              <span className={LABEL}>Amount</span>
              <NumberInput
                name={`p-amount-${payment.id}`}
                defaultValue={amount}
                onValueChange={setAmount}
                suffix={currency}
              />
            </div>

            <div>
              <span className={LABEL}>Due</span>
              <DatePicker
                name={`p-due-${payment.id}`}
                defaultValue={dueOn}
                onChange={setDueOn}
              />
            </div>
            <div>
              <span className={LABEL}>Status</span>
              <Dropdown
                options={INSTALLMENT_OPTIONS}
                value={status}
                onChange={setStatus}
                searchThreshold={0}
              />
            </div>

            {status === "paid" && (
              <div>
                <span className={LABEL}>Paid on</span>
                <DatePicker
                  name={`p-paid-${payment.id}`}
                  defaultValue={paidOn}
                  onChange={setPaidOn}
                />
                <p className="mt-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
                  Left blank, it stamps today.
                </p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor={`p-note-${payment.id}`}>
                Note — shown to the client verbatim
              </label>
              <Textarea
                id={`p-note-${payment.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                placeholder="Why this one moved, or what it covers."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updateInstallment(projectId, payment.id, {
                      label,
                      amount,
                      due_on: dueOn,
                      status,
                      paid_on: paidOn,
                      note,
                    }),
                  { success: "Saved.", onSuccess: () => setOpen(false) }
                )
              }
            >
              Save
            </Button>
            <ConfirmButton
              size="sm"
              className="ml-auto"
              disabled={pending}
              onConfirm={() =>
                run(() => deleteInstallment(projectId, payment.id), {
                  success: "Payment removed.",
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </ConfirmButton>
          </div>
        </div>
      )}
    </li>
  );
}

function PaymentBadge({ status, late }: { status: string; late: boolean }) {
  if (status === "paid") return <Badge tone="green">Paid</Badge>;
  if (status === "waived") return <Badge tone="faint">Waived</Badge>;
  if (late) return <Badge tone="danger">Late</Badge>;
  if (status === "invoiced") return <Badge tone="info">Invoiced</Badge>;
  return <Badge tone="faint">Scheduled</Badge>;
}

/* ── A payment on a date somebody chose ───────────────────────── */

/**
 * The other way to build a schedule.
 *
 * "Schedule more" beside it repeats the plan's rhythm, which is what a retainer
 * needs. This is for everything that isn't a rhythm — a deposit, a payment tied
 * to a delivery, one more agreed in a phone call — and it asks for exactly the
 * two things such a payment is: a date and an amount.
 *
 * Collapsed until asked for, because on a monthly plan it is the control nobody
 * touches; one click away, because on a bespoke plan it is the only one they
 * use.
 */
function AddPaymentRow({
  projectId,
  planId,
  currency,
  suggestedDate,
  suggestedAmount,
}: {
  projectId: string;
  planId: string;
  currency: string;
  suggestedDate: string;
  suggestedAmount: string;
}) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(suggestedAmount);
  const [dueOn, setDueOn] = useState(suggestedDate);
  // Bumped after each save so the date and amount inputs, which are
  // uncontrolled, actually reset instead of holding the payment just written.
  const [round, setRound] = useState(0);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" aria-hidden />
        Add a payment
      </Button>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <span className={LABEL}>Due</span>
          <DatePicker
            key={`add-due-${planId}-${round}`}
            name={`add-due-${planId}`}
            defaultValue={dueOn}
            onChange={setDueOn}
          />
        </div>
        <div className="w-40">
          <span className={LABEL}>Amount</span>
          <NumberInput
            key={`add-amount-${planId}-${round}`}
            name={`add-amount-${planId}`}
            defaultValue={amount}
            onValueChange={setAmount}
            suffix={currency}
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className={LABEL} htmlFor={`add-label-${planId}`}>
            Label
          </label>
          <Input
            id={`add-label-${planId}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={160}
            placeholder="Deposit, On delivery…"
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => addInstallment(projectId, planId, { label, amount, due_on: dueOn }), {
              success: "Payment added.",
              onSuccess: () => {
                setLabel("");
                // The date and amount are deliberately KEPT and the inputs
                // remounted onto them: somebody entering a bespoke schedule is
                // typing a run of similar payments, and clearing the fields
                // after each one makes them retype what they just said.
                setRound((current) => current + 1);
              },
            })
          }
        >
          Add
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
      <p className="mt-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
        Goes in on the date you choose, whatever the plan’s cadence says. If the
        amount differs from the plan’s headline figure, the headline clears.
      </p>
    </div>
  );
}

/* ── One plan ─────────────────────────────────────────────────────────────── */

function PlanBlock({
  projectId,
  summary,
  today,
}: {
  projectId: string;
  summary: PlanSummary;
  today: string;
}) {
  const { plan, payments } = summary;
  const { run, pending } = useAction();
  const [openEditor, setOpenEditor] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [kind, setKind] = useState<string>(plan.kind);
  const [currency, setCurrency] = useState<string>(plan.currency);
  const [amountEach, setAmountEach] = useState(
    plan.amount_each === null ? "" : String(plan.amount_each)
  );
  const [cadence, setCadence] = useState<string>(plan.cadence);
  const [startsOn, setStartsOn] = useState(plan.starts_on);
  const [endsOn, setEndsOn] = useState(plan.ends_on ?? "");
  const [status, setStatus] = useState<string>(plan.status);
  const [note, setNote] = useState(plan.note ?? "");
  const [visible, setVisible] = useState(plan.visible_to_client);
  const [extendBy, setExtendBy] = useState("3");

  const hiddenFromClient = !plan.visible_to_client || plan.status === "draft";

  // Where the add-a-payment form opens: one cadence step past the last payment
  // on the plan, or the plan's start date when there are none. A guess, and
  // only a guess — the field is a date picker precisely because the answer is
  // often "no, the 14th".
  const last = payments[payments.length - 1];
  const nextSlot = last
    ? paymentDate(last.due_on, plan.cadence, 1)
    : plan.starts_on;

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className="shrink-0 self-center"
            title={
              hiddenFromClient ? "Not visible to the client" : "Visible to the client"
            }
          >
            {hiddenFromClient ? (
              <EyeOff className="size-3.5 text-faint" aria-hidden />
            ) : (
              <Eye className="size-3.5 text-primary-dim" aria-hidden />
            )}
            <span className="sr-only">
              {hiddenFromClient ? "Hidden from the client" : "Visible to the client"}
            </span>
          </span>

          <h3 className="min-w-0 text-[calc(14px*var(--text-scale,1))] font-medium text-ink">
            {plan.title}
          </h3>
          <span className="font-mono text-[calc(12px*var(--text-scale,1))] text-muted">
            {planHeadline(plan, summary.count)}
          </span>
          {plan.status !== "active" && (
            <Badge tone={plan.status === "cancelled" ? "danger" : "faint"}>
              {PAYMENT_PLAN_STATUS_LABELS[plan.status]}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setOpenEditor((current) => !current)}
            aria-expanded={openEditor}
          >
            {openEditor ? "Close" : "Edit plan"}
          </Button>
        </div>

        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
          <span>
            {formatMoney(summary.paid, plan.currency)} of{" "}
            {formatMoney(summary.total, plan.currency)} paid
          </span>
          <span>
            {summary.paidCount}/{summary.count} payments
          </span>
          {summary.overdueCount > 0 && (
            <span className="text-danger">
              {summary.overdueCount} past due ·{" "}
              {formatMoney(summary.overdue, plan.currency)}
            </span>
          )}
          {summary.next && (
            <span>
              next {formatDate(summary.next.due_on)} ·{" "}
              {formatMoney(summary.next.amount, plan.currency)}
            </span>
          )}
        </p>
      </div>

      {openEditor && (
        <div className="grid gap-4 border-t border-line/60 bg-raised/20 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor={`pl-title-${plan.id}`}>
                Name — the client reads this
              </label>
              <Input
                id={`pl-title-${plan.id}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
              />
            </div>

            <div>
              <span className={LABEL}>Shape</span>
              <Dropdown
                options={KIND_OPTIONS}
                value={kind}
                onChange={setKind}
                searchThreshold={0}
              />
            </div>
            <div>
              <span className={LABEL}>Every</span>
              <Dropdown
                options={CADENCE_OPTIONS}
                value={cadence}
                onChange={setCadence}
                searchThreshold={0}
              />
            </div>

            <div>
              <span className={LABEL}>Amount each</span>
              <NumberInput
                name={`pl-each-${plan.id}`}
                defaultValue={amountEach}
                onValueChange={setAmountEach}
                suffix={currency}
              />
              <p className="mt-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
                The headline figure. Blank when the payments differ.
              </p>
            </div>
            <div>
              <span className={LABEL}>Currency</span>
              <Dropdown
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={setCurrency}
                searchThreshold={0}
              />
            </div>

            <div>
              <span className={LABEL}>Starts</span>
              <DatePicker
                name={`pl-starts-${plan.id}`}
                defaultValue={startsOn}
                onChange={setStartsOn}
              />
            </div>
            <div>
              <span className={LABEL}>Ends</span>
              <DatePicker
                name={`pl-ends-${plan.id}`}
                defaultValue={endsOn}
                onChange={setEndsOn}
              />
              <p className="mt-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
                Blank on an open-ended retainer.
              </p>
            </div>

            <div>
              <span className={LABEL}>Status</span>
              <Dropdown
                options={PLAN_STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                searchThreshold={0}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor={`pl-note-${plan.id}`}>
                Note — shown to the client verbatim
              </label>
              <Textarea
                id={`pl-note-${plan.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                placeholder="How to pay, what the retainer covers, when it is reviewed."
              />
            </div>
          </div>

          <Checkbox
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
            label="Visible to the client"
          />

          <p className="text-[calc(12px*var(--text-scale,1))] text-faint">
            Changing the start date or cadence here does not move the payments
            already scheduled below — edit those directly, so you can see what
            you are moving.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updatePaymentPlan(projectId, plan.id, {
                      title,
                      kind,
                      currency,
                      amount_each: amountEach,
                      cadence,
                      starts_on: startsOn,
                      ends_on: endsOn,
                      status,
                      note,
                      visible_to_client: visible,
                    }),
                  { success: "Saved.", onSuccess: () => setOpenEditor(false) }
                )
              }
            >
              Save
            </Button>
            <ConfirmButton
              size="sm"
              className="ml-auto"
              disabled={pending}
              onConfirm={() =>
                run(() => deletePaymentPlan(projectId, plan.id), {
                  success: "Payment plan removed.",
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete plan and its {summary.payments.length} payments
            </ConfirmButton>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="px-4 pb-4 text-[calc(13px*var(--text-scale,1))] text-faint">
          No payments scheduled yet.
        </p>
      ) : (
        <ul className="border-t border-line/60">
          {payments.map((payment) => (
            <PaymentRow
              key={payment.id}
              projectId={projectId}
              payment={payment}
              currency={plan.currency}
              today={today}
            />
          ))}
        </ul>
      )}

      {/* Two ways to grow a schedule, and they answer different questions.
          Extending repeats the plan's rhythm — how an open-ended retainer stays
          open-ended, laid out a year at a time rather than forever so the
          portal never shows dates past what anybody agreed to. Adding one
          payment ignores the rhythm entirely, which is what a deposit or a
          delivery payment actually is. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line/60 px-4 py-2.5">
        <AddPaymentRow
          projectId={projectId}
          planId={plan.id}
          currency={plan.currency}
          suggestedDate={nextSlot}
          suggestedAmount={plan.amount_each === null ? "" : String(plan.amount_each)}
        />

        <span className="font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
          Schedule more
        </span>
        <NumberInput
          name={`pl-extend-${plan.id}`}
          defaultValue={extendBy}
          decimals={0}
          onValueChange={setExtendBy}
          className="w-20"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => extendPaymentPlan(projectId, plan.id, Number(extendBy)))}
        >
          <CalendarPlus className="size-3.5" aria-hidden />
          Add {PAYMENT_CADENCE_LABELS[plan.cadence].toLowerCase()} payments
        </Button>
      </div>
    </li>
  );
}

/* ── The panel ────────────────────────────────────────────────────────────── */

export function PaymentPlansPanel({
  projectId,
  summaries,
  today,
}: {
  projectId: string;
  summaries: PlanSummary[];
  today: string;
}) {
  const hidden = summaries.filter(
    (entry) => !entry.plan.visible_to_client || entry.plan.status === "draft"
  ).length;

  return (
    <Panel>
      <PanelHeader
        title="Payment plan"
        action={
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs text-faint">
              {summaries.length} {summaries.length === 1 ? "plan" : "plans"}
              {hidden > 0 && ` · ${hidden} unpublished`}
            </span>
            <LinkButton
              href={`/work/projects/${projectId}/client/new-payment-plan`}
              variant="outline"
              size="sm"
            >
              <Plus className="size-3.5" aria-hidden />
              Add
            </LinkButton>
          </span>
        }
      />

      {summaries.length === 0 ? (
        <p className="px-4 py-6 text-[calc(13px*var(--text-scale,1))] text-faint">
          No plan agreed. A plan is what the client is shown BEFORE the invoices
          exist — &ldquo;a third up front, a third on delivery, a third on
          launch&rdquo;, or a monthly retainer — and it lays the payments out
          dated so nobody has to work them out again each month.
        </p>
      ) : (
        <ul>
          {summaries.map((summary) => (
            <PlanBlock
              key={summary.plan.id}
              projectId={projectId}
              summary={summary}
              today={today}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
