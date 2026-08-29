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
  milestoneTree,
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

/**
 * A percentage as this panel writes it: trailing zeroes dropped, sign always
 * present. `20%` and `16.5%`, never `20.00%` — these sit inside sentences.
 */
function pct(value: number | string) {
  return `${Math.round((Number(value) || 0) * 100) / 100}%`;
}

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
  const [weight, setWeight] = useState(String(milestone.weight ?? 0));
  const [completion, setCompletion] = useState(String(milestone.completion ?? 0));

  /**
   * The status dropdown moves the completion figure with it, because the
   * database will anyway (0075 §1d). Mirrored here so the number on screen is
   * the number about to be saved — a form that shows 30% and stores 100% is
   * worse than one that has no field at all.
   */
  function changeStatus(next: ProjectMilestone["status"]) {
    setStatus(next);
    if (next === "done") setCompletion("100");
    else if (Number(completion) >= 100) setCompletion("0");
  }

  const contribution = (Number(weight) || 0) * ((Number(completion) || 0) / 100);

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
            onChange={(value) => changeStatus(value as ProjectMilestone["status"])}
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

        {/* The two numbers behind the client's bar. Side by side because they
            only mean anything as a pair, with the arithmetic spelled out under
            them — "20% of the build × 80% done = 16 points" is the sentence
            somebody needs to read once to trust the figure ever after. */}
        <div>
          <span className={LABEL}>Weight — share of the whole build</span>
          <NumberInput
            name={`m-weight-${milestone.id}`}
            defaultValue={weight}
            onValueChange={setWeight}
            suffix="%"
          />
        </div>

        <div>
          <span className={LABEL}>Completion — of this phase alone</span>
          {/* Keyed on the status so that changing the dropdown REMOUNTS this
              field. NumberInput is uncontrolled — it seeds from defaultValue
              once — so without the key, marking a phase done would move the
              value about to be saved without moving the number on screen,
              which is the exact mismatch `changeStatus` exists to prevent. */}
          <NumberInput
            key={`m-completion-${milestone.id}-${status}`}
            name={`m-completion-${milestone.id}`}
            defaultValue={completion}
            onValueChange={setCompletion}
            suffix="%"
          />
        </div>

        <p className="text-[calc(12px*var(--text-scale,1))] text-faint sm:col-span-2">
          {Number(weight) > 0 ? (
            <>
              This phase is worth{" "}
              <span className="font-mono tabular-nums text-muted">{pct(weight)}</span>{" "}
              of the project and is{" "}
              <span className="font-mono tabular-nums text-muted">{pct(completion)}</span>{" "}
              done — it moves the client&apos;s bar by{" "}
              <span className="font-mono tabular-nums text-ink">
                {pct(contribution)}
              </span>
              .
            </>
          ) : (
            <>
              No weight set. While every phase of this project is at 0, they all
              count equally; give one a weight and the unweighted ones stop
              counting at all.
            </>
          )}
        </p>

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
                  weight,
                  completion,
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


/**
 * The plan, with its weights adding up (or not) in plain sight.
 *
 * ── Why the allocation line is always there ────────────────────────────────
 *
 * Weights are the one thing on this page whose mistakes are invisible from the
 * inside. Every row can look right while the plan as a whole adds up to 60%,
 * and the only symptom is a client's bar that stops at 60 the day everything
 * ships. So the total sits in the header, permanently, and says which way it is
 * out — this is the number the producer came to check even when they didn't
 * know it.
 */
export function MilestonesPanel({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Top level only, everywhere in this panel. A sub-phase's weight is a share
  // of ITS PARENT (0078 §1c), so folding both levels into one sum produces the
  // nonsense the client's bar never shows — five tracks and twenty weeks
  // "adding up to 600%".
  const tree = milestoneTree(milestones);
  const top = tree.map((node) => node.phase);
  const published = top.filter((m) => m.visible_to_client).length;
  const allocated =
    Math.round(top.reduce((sum, m) => sum + (Number(m.weight) || 0), 0) * 100) /
    100;
  const weighted = allocated > 0;

  return (
    <Panel>
      <PanelHeader
        title="Phases the client sees"
        action={
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs text-faint">
              {published}/{top.length} published
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

      {top.length > 0 && (
        <p
          className={cn(
            "border-b border-line px-4 py-2.5 text-[calc(12px*var(--text-scale,1))]",
            weighted && allocated !== 100 ? "text-amber" : "text-faint"
          )}
        >
          {!weighted ? (
            <>
              No phase is weighted, so all {top.length} count equally —{" "}
              {pct(100 / top.length)} each. Give them weights to make the
              big ones move the bar further.
            </>
          ) : allocated === 100 ? (
            <>Weights add up to 100%. The bar reaches 100 when the plan does.</>
          ) : allocated < 100 ? (
            <>
              Weights add up to {pct(allocated)} — {pct(100 - allocated)} of the
              project is unallocated, so this plan can only ever reach{" "}
              {pct(allocated)}.
            </>
          ) : (
            <>
              Weights add up to {pct(allocated)}, past a whole project. Every
              phase is scaled down to fit, so each one moves the bar less than
              its number says.
            </>
          )}
        </p>
      )}

      {top.length === 0 ? (
        <p className="px-4 py-6 text-[calc(13px*var(--text-scale,1))] text-faint">
          Nothing published yet. Until there is, the client&apos;s Progress page
          tells them the plan hasn&apos;t been shared and points them at their
          input pack.
        </p>
      ) : (
        <ul>
          {tree.map(({ phase, steps }, index) => (
            <li key={phase.id}>
              <ul>
                <Row
                  hidden={!phase.visible_to_client}
                  open={openId === phase.id}
                  onToggle={() =>
                    setOpenId((current) => (current === phase.id ? null : phase.id))
                  }
                  summary={
                    <>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="min-w-0 truncate text-[calc(13px*var(--text-scale,1))] text-ink">
                          {phase.title}
                        </span>
                        {Number(phase.weight) > 0 && (
                          <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-muted">
                            {pct(phase.weight)} of the build
                          </span>
                        )}
                        {steps.length > 0 && (
                          <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
                            {steps.filter((s) => s.status === "done").length}/
                            {steps.length} steps
                          </span>
                        )}
                      </span>
                      <span className="block truncate font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                        {MILESTONE_STATUS_LABELS[phase.status]}
                        {` · ${pct(phase.completion)} done`}
                        {steps.length > 0 && " · rolled up"}
                        {phase.target_on && ` · target ${phase.target_on}`}
                        {phase.done_on && ` · done ${phase.done_on}`}
                      </span>
                    </>
                  }
                >
                  <MilestoneEditor
                    projectId={projectId}
                    milestone={phase}
                    first={index === 0}
                    last={index === tree.length - 1}
                    onDone={() => setOpenId(null)}
                  />
                </Row>
              </ul>

              {/* Sub-phases. Indented and rule-marked rather than merely
                  smaller, so the level is legible at a glance instead of being
                  inferred from type size. */}
              {steps.length > 0 && (
                <ul className="ms-4 border-s border-line ps-1">
                  {steps.map((step, stepIndex) => (
                    <Row
                      key={step.id}
                      hidden={!step.visible_to_client}
                      open={openId === step.id}
                      onToggle={() =>
                        setOpenId((current) => (current === step.id ? null : step.id))
                      }
                      summary={
                        <>
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="min-w-0 truncate text-[calc(12px*var(--text-scale,1))] text-muted">
                              {step.title}
                            </span>
                            {Number(step.weight) > 0 && (
                              <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
                                {pct(step.weight)} of this phase
                              </span>
                            )}
                          </span>
                          <span className="block truncate font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                            {MILESTONE_STATUS_LABELS[step.status]}
                            {` · ${pct(step.completion)} done`}
                            {step.target_on && ` · target ${step.target_on}`}
                          </span>
                        </>
                      }
                    >
                      <MilestoneEditor
                        projectId={projectId}
                        milestone={step}
                        first={stepIndex === 0}
                        last={stepIndex === steps.length - 1}
                        onDone={() => setOpenId(null)}
                      />
                    </Row>
                  ))}
                </ul>
              )}
            </li>
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
