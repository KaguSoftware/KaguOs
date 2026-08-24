"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Textarea } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { LinkButton } from "@/components/ui/link-button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import {
  deleteInvoice,
  deleteMilestone,
  moveMilestone,
  updateInvoice,
  updateMilestone,
} from "@/lib/actions/client-portal";
import { useAction } from "@/lib/use-action";
import {
  INVOICE_CURRENCIES,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
  type ProjectInvoice,
  type ProjectMilestone,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/**
 * What the team publishes to the client portal, edited.
 *
 * ── Why editing is inline when creating is a page ──────────────────────────
 *
 * Adding a milestone or an invoice goes through a dedicated /new surface, the
 * way every "add new X" in KaguOs does — the moment of writing a sentence a
 * customer will read deserves room, and the empty-field confirm on that surface
 * is the last check before it goes out.
 *
 * Editing is the opposite shape of job. It is almost always "mark that one
 * done" or "this invoice was paid on Tuesday", done while looking at the rest
 * of the plan, and a page navigation per one-word change would hide the list at
 * exactly the moment the reader is comparing against it. So rows expand in
 * place: the panel stays legible when nothing is open — one line each, the way
 * the client will read them — and opening one shows every field it has.
 *
 * Behind a Save button rather than save-on-blur, unlike the client's own input
 * pack. These rows are things Kagu SAYS to a customer, and a half-typed
 * sentence reaching the portal on blur is a different kind of mistake from a
 * half-typed answer reaching Kagu.
 *
 * ── The visibility switch ──────────────────────────────────────────────────
 *
 * A milestone can be planned internally before it is announced, and an invoice
 * is a draft until it is sent. Both states are gated in the RLS policy (0074
 * §3), not here — this component only has to make which one a row is in
 * unmissable, which is what the eye/eye-off marker down the left is for.
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

const LABEL =
  "mb-1.5 block font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint";

/** Row shell: the collapsed summary line, and the expanded editor beneath it. */
function Row({
  summary,
  hidden,
  open,
  onToggle,
  children,
}: {
  summary: React.ReactNode;
  /** True when the client cannot see this row — draft invoice, unpublished step. */
  hidden: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span
          className="mt-0.5 shrink-0"
          title={hidden ? "Not visible to the client" : "Visible to the client"}
        >
          {hidden ? (
            <EyeOff className="size-3.5 text-faint" aria-hidden />
          ) : (
            <Eye className="size-3.5 text-primary-dim" aria-hidden />
          )}
          <span className="sr-only">
            {hidden ? "Hidden from the client" : "Visible to the client"}
          </span>
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          {summary}
        </button>

        <ChevronDown
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-faint transition-transform duration-150 ease-mac",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </div>

      {open && <div className="border-t border-line/60 bg-raised/20 px-3 py-4">{children}</div>}
    </li>
  );
}

/* ── Milestones ───────────────────────────────────────────────────────────── */

function MilestoneEditor({
  projectId,
  milestone,
  first,
  last,
  onDone,
}: {
  projectId: string;
  milestone: ProjectMilestone;
  first: boolean;
  last: boolean;
  onDone: () => void;
}) {
  const { run, pending } = useAction();
  const [status, setStatus] = useState(milestone.status);
  const [visible, setVisible] = useState(milestone.visible_to_client);
  const [title, setTitle] = useState(milestone.title);
  const [detail, setDetail] = useState(milestone.detail ?? "");
  const [targetOn, setTargetOn] = useState(milestone.target_on ?? "");
  const [doneOn, setDoneOn] = useState(milestone.done_on ?? "");

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor={`m-title-${milestone.id}`}>
            Title
          </label>
          <Input
            id={`m-title-${milestone.id}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor={`m-detail-${milestone.id}`}>
            Detail — the client reads this verbatim
          </label>
          <Textarea
            id={`m-detail-${milestone.id}`}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            maxLength={4000}
            placeholder="One sentence in their language. Not a commit message."
          />
        </div>

        <div>
          <span className={LABEL}>Status</span>
          <Dropdown
            options={MILESTONE_OPTIONS}
            value={status}
            onChange={(value) => setStatus(value as ProjectMilestone["status"])}
          />
        </div>

        <div>
          <span className={LABEL}>Target date</span>
          <DatePicker
            name={`m-target-${milestone.id}`}
            defaultValue={targetOn}
            onChange={setTargetOn}
          />
        </div>

        {status === "done" && (
          <div>
            <span className={LABEL}>Completed on</span>
            <DatePicker
              name={`m-done-${milestone.id}`}
              defaultValue={doneOn}
              onChange={setDoneOn}
            />
            <p className="mt-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
              Left blank, it stamps today.
            </p>
          </div>
        )}
      </div>

      <Checkbox
        checked={visible}
        onChange={(event) => setVisible(event.target.checked)}
        label="Visible to the client"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                updateMilestone(projectId, milestone.id, {
                  title,
                  detail,
                  status,
                  target_on: targetOn,
                  done_on: doneOn,
                  visible_to_client: visible,
                }),
              { success: "Saved.", onSuccess: onDone }
            )
          }
        >
          Save
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={pending || first}
          aria-label="Move up"
          onClick={() => run(() => moveMilestone(projectId, milestone.id, "up"))}
        >
          <ChevronUp className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || last}
          aria-label="Move down"
          onClick={() => run(() => moveMilestone(projectId, milestone.id, "down"))}
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </Button>

        <ConfirmButton
          size="sm"
          className="ml-auto"
          disabled={pending}
          onConfirm={() =>
            run(() => deleteMilestone(projectId, milestone.id), {
              success: "Milestone removed.",
              onSuccess: onDone,
            })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete
        </ConfirmButton>
      </div>
    </div>
  );
}


export function MilestonesPanel({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const published = milestones.filter((m) => m.visible_to_client).length;

  return (
    <Panel>
      <PanelHeader
        title="Plan the client sees"
        action={
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs text-faint">
              {published}/{milestones.length} published
            </span>
            <LinkButton
              href={`/work/projects/${projectId}/client/new-milestone`}
              variant="outline"
              size="sm"
            >
              <Plus className="size-3.5" aria-hidden />
              Add
            </LinkButton>
          </span>
        }
      />

      {milestones.length === 0 ? (
        <p className="px-4 py-6 text-[calc(13px*var(--text-scale,1))] text-faint">
          Nothing published yet. Until there is, the client&apos;s Progress page
          tells them the plan hasn&apos;t been shared and points them at their
          input pack.
        </p>
      ) : (
        <ul>
          {milestones.map((milestone, index) => (
            <Row
              key={milestone.id}
              hidden={!milestone.visible_to_client}
              open={openId === milestone.id}
              onToggle={() =>
                setOpenId((current) => (current === milestone.id ? null : milestone.id))
              }
              summary={
                <>
                  <span className="block truncate text-[calc(13px*var(--text-scale,1))] text-ink">
                    {milestone.title}
                  </span>
                  <span className="block truncate font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                    {MILESTONE_STATUS_LABELS[milestone.status]}
                    {milestone.target_on && ` · target ${milestone.target_on}`}
                    {milestone.done_on && ` · done ${milestone.done_on}`}
                  </span>
                </>
              }
            >
              <MilestoneEditor
                projectId={projectId}
                milestone={milestone}
                first={index === 0}
                last={index === milestones.length - 1}
                onDone={() => setOpenId(null)}
              />
            </Row>
          ))}
        </ul>
      )}

    </Panel>
  );
}

/* ── Invoices ─────────────────────────────────────────────────────────────── */

function InvoiceEditor({
  projectId,
  invoice,
  onDone,
}: {
  projectId: string;
  invoice: ProjectInvoice;
  onDone: () => void;
}) {
  const { run, pending } = useAction();
  const [number, setNumber] = useState(invoice.number);
  const [title, setTitle] = useState(invoice.title ?? "");
  const [amount, setAmount] = useState(String(invoice.amount));
  const [currency, setCurrency] = useState<string>(invoice.currency);
  const [status, setStatus] = useState<string>(invoice.status);
  const [issuedOn, setIssuedOn] = useState(invoice.issued_on);
  const [dueOn, setDueOn] = useState(invoice.due_on ?? "");
  const [paidOn, setPaidOn] = useState(invoice.paid_on ?? "");
  const [note, setNote] = useState(invoice.note ?? "");

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor={`i-number-${invoice.id}`}>
            Number
          </label>
          <Input
            id={`i-number-${invoice.id}`}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            maxLength={40}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor={`i-title-${invoice.id}`}>
            What it is for
          </label>
          <Input
            id={`i-title-${invoice.id}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
        </div>

        <div>
          <span className={LABEL}>Amount</span>
          <NumberInput
            name={`i-amount-${invoice.id}`}
            defaultValue={amount}
            onValueChange={setAmount}
          />
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
          <span className={LABEL}>Status</span>
          <Dropdown
            options={INVOICE_OPTIONS}
            value={status}
            onChange={setStatus}
            searchThreshold={0}
          />
        </div>
        <div>
          <span className={LABEL}>Issued</span>
          <DatePicker
            name={`i-issued-${invoice.id}`}
            defaultValue={issuedOn}
            onChange={setIssuedOn}
          />
        </div>

        <div>
          <span className={LABEL}>Due</span>
          <DatePicker
            name={`i-due-${invoice.id}`}
            defaultValue={dueOn}
            onChange={setDueOn}
          />
        </div>
        {status === "paid" && (
          <div>
            <span className={LABEL}>Paid on</span>
            <DatePicker
              name={`i-paid-${invoice.id}`}
              defaultValue={paidOn}
              onChange={setPaidOn}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor={`i-note-${invoice.id}`}>
            Note — shown to the client verbatim
          </label>
          <Textarea
            id={`i-note-${invoice.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            placeholder="A payment reference, or what a part-payment covered."
          />
        </div>
      </div>

      {status === "draft" && (
        <p className="text-[calc(13px*var(--text-scale,1))] text-amber">
          Drafts are invisible to the client. Set it to Sent when it has actually
          gone out.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                updateInvoice(projectId, invoice.id, {
                  number,
                  title,
                  amount,
                  currency,
                  status,
                  issued_on: issuedOn,
                  due_on: dueOn,
                  paid_on: paidOn,
                  note,
                }),
              { success: "Saved.", onSuccess: onDone }
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
            run(() => deleteInvoice(projectId, invoice.id), {
              success: "Invoice removed.",
              onSuccess: onDone,
            })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete
        </ConfirmButton>
      </div>
    </div>
  );
}


export function InvoicesPanel({
  projectId,
  invoices,
}: {
  projectId: string;
  invoices: ProjectInvoice[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const drafts = invoices.filter((invoice) => invoice.status === "draft").length;

  return (
    <Panel>
      <PanelHeader
        title="Invoices"
        action={
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs text-faint">
              {invoices.length} total{drafts > 0 && ` · ${drafts} draft`}
            </span>
            <LinkButton
              href={`/work/projects/${projectId}/client/new-invoice`}
              variant="outline"
              size="sm"
            >
              <Plus className="size-3.5" aria-hidden />
              Add
            </LinkButton>
          </span>
        }
      />

      {invoices.length === 0 ? (
        <p className="px-4 py-6 text-[calc(13px*var(--text-scale,1))] text-faint">
          Nothing billed for this project. These rows are the client&apos;s
          statement — Kagu&apos;s own books stay in Management.
        </p>
      ) : (
        <ul>
          {invoices.map((invoice) => (
            <Row
              key={invoice.id}
              hidden={invoice.status === "draft"}
              open={openId === invoice.id}
              onToggle={() =>
                setOpenId((current) => (current === invoice.id ? null : invoice.id))
              }
              summary={
                <>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[calc(12px*var(--text-scale,1))] text-muted">
                      {invoice.number}
                    </span>
                    <span className="min-w-0 truncate text-[calc(13px*var(--text-scale,1))] text-ink">
                      {invoice.title ?? "—"}
                    </span>
                  </span>
                  <span className="block truncate font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                    {formatMoney(invoice.amount, invoice.currency)} ·{" "}
                    {INVOICE_STATUS_LABELS[invoice.status]}
                    {invoice.due_on && ` · due ${invoice.due_on}`}
                  </span>
                </>
              }
            >
              <InvoiceEditor
                projectId={projectId}
                invoice={invoice}
                onDone={() => setOpenId(null)}
              />
            </Row>
          ))}
        </ul>
      )}

    </Panel>
  );
}
