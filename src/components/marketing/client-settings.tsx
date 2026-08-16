"use client";

import { useState } from "react";
import { updateClient } from "@/lib/actions/marketing";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import type { Client, ClientStatus, EngagementKind } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Active", hint: "Work is running." },
  { value: "paused", label: "Paused", hint: "On hold, coming back." },
  { value: "ended", label: "Ended", hint: "Finished. Kept for the record." },
];

const ENGAGEMENT_OPTIONS = [
  { value: "retainer", label: "Retainer", hint: "A fixed fee for a set number of videos." },
  { value: "project", label: "Project", hint: "One-off, priced as a job." },
  { value: "ad_fee", label: "% of ad spend", hint: "A cut of what runs through their ads." },
];

/**
 * The client's standing facts: how the engagement works, and how they like
 * things done.
 *
 * `brand_notes` is the documentation that survives a person leaving — the
 * voice, the posting times, the things this client will not sign off. It is a
 * plain textarea rather than a structured form on purpose: nobody fills in
 * eleven fields about tone of voice, and the useful version of this is three
 * sentences someone actually wrote.
 */
export function ClientSettings({
  client,
  canWrite,
}: {
  client: Client;
  canWrite: boolean;
}) {
  const { pending, run } = useAction();
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const [engagement, setEngagement] = useState<EngagementKind>(client.engagement_kind);
  const [notes, setNotes] = useState(client.brand_notes ?? "");

  if (!canWrite) {
    return (
      <Panel>
        <PanelHeader title="How this client works" />
        <div className="space-y-3 px-4 py-4">
          <Fact label="Engagement" value={engagementLabel(client.engagement_kind)} />
          {client.monthly_deliverables !== null && (
            <Fact label="Videos a month" value={String(client.monthly_deliverables)} />
          )}
          <Fact
            label="Ad account"
            value={client.ad_account_owner === "kagu" ? "Kagu's" : "The client's"}
          />
          {client.brand_notes && (
            <div>
              <p className="text-[calc(13px*var(--text-scale,1))] font-medium text-muted">Notes</p>
              <p className="mt-0.5 max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] text-ink">
                {client.brand_notes}
              </p>
            </div>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader title="How this client works" />
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="client-status">
            <Dropdown
              id="client-status"
              value={status}
              options={STATUS_OPTIONS}
              disabled={pending}
              onChange={(next) => {
                const was = status;
                run(() => updateClient(client.id, { status: next as ClientStatus }), {
                  optimistic: () => setStatus(next as ClientStatus),
                  rollback: () => setStatus(was),
                });
              }}
            />
          </Field>
          <Field
            label="Engagement"
            htmlFor="client-engagement"
            hint="Change it freely — nothing downstream depends on the answer yet."
          >
            <Dropdown
              id="client-engagement"
              value={engagement}
              options={ENGAGEMENT_OPTIONS}
              disabled={pending}
              onChange={(next) => {
                const was = engagement;
                run(
                  () =>
                    updateClient(client.id, {
                      engagement_kind: next as EngagementKind,
                    }),
                  {
                    optimistic: () => setEngagement(next as EngagementKind),
                    rollback: () => setEngagement(was),
                  }
                );
              }}
            />
          </Field>
          {engagement === "retainer" && (
            <Field
              label="Videos a month"
              htmlFor="client-deliverables"
              hint="What the retainer owes them. Saved when you click away."
            >
              <NumberInput
                id="client-deliverables"
                name="monthly_deliverables"
                decimals={0}
                defaultValue={client.monthly_deliverables ?? ""}
                onCommit={(next) => {
                  const parsed = next.trim() ? Number(next) : null;
                  if (parsed !== null && !Number.isFinite(parsed)) return;
                  if (parsed === client.monthly_deliverables) return;
                  run(() =>
                    updateClient(client.id, { monthly_deliverables: parsed })
                  );
                }}
              />
            </Field>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Brand notes" />
        <div className="space-y-3 px-4 py-4">
          <Textarea
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Voice, what they'll never approve, best posting times, who signs off, anything the next person would have to ask about."
            aria-label="Brand notes"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => updateClient(client.id, { brand_notes: notes || null }), {
                success: "Notes saved.",
              })
            }
          >
            Save notes
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function engagementLabel(kind: EngagementKind) {
  return (
    ENGAGEMENT_OPTIONS.find((o) => o.value === kind)?.label ?? kind
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-32 shrink-0 text-[calc(13px*var(--text-scale,1))] text-muted">{label}</span>
      <span className="text-[calc(13px*var(--text-scale,1))] text-ink">{value}</span>
    </div>
  );
}
