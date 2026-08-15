"use client";

import { useState } from "react";
import { ExternalLink, Megaphone, Trash2 } from "lucide-react";
import { useAction } from "@/lib/use-action";
import {
  deleteCampaign,
  saveCampaignRetro,
  setCampaignStatus,
} from "@/lib/actions/marketing";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { CAMPAIGN_STATUS_OPTIONS, CHANNEL_OPTIONS, optionLabel } from "@/lib/options";
import { formatDate, formatMoney } from "@/lib/utils";
import type { CampaignStatus, MarketingCampaign } from "@/lib/types";

const TONE: Record<CampaignStatus, BadgeTone> = {
  idea: "faint",
  planned: "info",
  running: "green",
  done: "neutral",
};

const GOAL_LABEL = {
  reach: "reach",
  leads: "leads",
  sales: "sales",
  followers: "followers",
} as const;

export function CampaignList({
  campaigns,
  canWrite,
}: {
  campaigns: MarketingCampaign[];
  canWrite: boolean;
}) {
  if (campaigns.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Megaphone}
          title="No campaigns for this client"
          hint="A campaign groups the videos that ran together and carries the budget and the goal they ran against. It's also where the retro lives when it ends."
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <CampaignRow key={campaign.id} campaign={campaign} canWrite={canWrite} />
      ))}
    </div>
  );
}

function CampaignRow({
  campaign,
  canWrite,
}: {
  campaign: MarketingCampaign;
  canWrite: boolean;
}) {
  const { pending, run } = useAction();
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);

  // Spend against budget as a bar, because the only question anyone asks of
  // these two numbers is "how much is left" and a ratio answers it faster than
  // two figures do. Over budget clamps the bar and turns it red — the number
  // beside it still says how far over.
  const budget = campaign.budget ?? 0;
  const spent = campaign.spend_actual;
  const ratio = budget > 0 ? spent / budget : 0;
  const over = budget > 0 && spent > budget;

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            {campaign.name}
            {campaign.url && (
              <a
                href={campaign.url}
                target="_blank"
                rel="noreferrer"
                className="text-faint hover:text-ink"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">Open campaign link</span>
              </a>
            )}
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Badge tone={TONE[status]}>{status}</Badge>
            {canWrite && (
              <Dropdown
                className="w-32"
                value={status}
                options={CAMPAIGN_STATUS_OPTIONS}
                disabled={pending}
                onChange={(next) => {
                  const was = status;
                  run(() => setCampaignStatus(campaign.id, next as CampaignStatus), {
                    optimistic: () => setStatus(next as CampaignStatus),
                    rollback: () => setStatus(was),
                  });
                }}
              />
            )}
          </div>
        }
      />

      <div className="space-y-3 px-4 py-3">
        <p className="text-xs text-faint">
          {optionLabel(CHANNEL_OPTIONS, campaign.channel)}
          {campaign.platform && ` · ${campaign.platform} ads`}
          {campaign.starts_on &&
            ` · ${formatDate(campaign.starts_on)}${campaign.ends_on ? ` → ${formatDate(campaign.ends_on)}` : ""}`}
          {campaign.goal_target !== null &&
            campaign.goal_metric &&
            ` · goal ${campaign.goal_target} ${GOAL_LABEL[campaign.goal_metric]}`}
        </p>

        {budget > 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-mono tabular-nums text-ink">
                {formatMoney(spent, campaign.currency)}
              </span>
              <span className="font-mono text-xs tabular-nums text-faint">
                of {formatMoney(budget, campaign.currency)}
              </span>
            </div>
            <div
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-raised"
              role="img"
              aria-label={`${Math.round(ratio * 100)} percent of budget spent`}
            >
              <div
                className={`h-full rounded-full ${over ? "bg-danger" : "bg-primary"}`}
                style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
              />
            </div>
          </div>
        )}

        {campaign.notes && (
          <p className="max-w-[70ch] text-[13px] text-muted">{campaign.notes}</p>
        )}

        <Retro campaign={campaign} canWrite={canWrite} />

        {canWrite && (
          <div className="pt-1">
            <ConfirmButton
              size="sm"
              disabled={pending}
              confirmLabel="Really delete?"
              onConfirm={() =>
                run(() => deleteCampaign(campaign.id), { success: "Campaign deleted." })
              }
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </ConfirmButton>
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * The retro: two boxes, written when a campaign ends.
 *
 * These are the highest-value fields in the section — a campaign that closes
 * without them teaches nothing and the knowledge leaves with whoever ran it —
 * so they are shown as an open prompt on a finished campaign rather than hidden
 * behind an edit screen. On a campaign that is still running they collapse to a
 * line, because asking "what would you avoid next time" mid-flight gets a blank
 * box and trains people to ignore the question.
 */
function Retro({
  campaign,
  canWrite,
}: {
  campaign: MarketingCampaign;
  canWrite: boolean;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(campaign.status === "done");
  const [worked, setWorked] = useState(campaign.retro_worked ?? "");
  const [avoid, setAvoid] = useState(campaign.retro_avoid ?? "");
  const hasRetro = Boolean(campaign.retro_worked || campaign.retro_avoid);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-faint underline-offset-2 transition-colors duration-150 hover:text-muted hover:underline"
      >
        {hasRetro ? "Show retro" : "Add a retro"}
      </button>
    );
  }

  if (!canWrite) {
    return (
      <div className="space-y-2 border-t border-line pt-3">
        <RetroRead label="What worked" body={campaign.retro_worked} />
        <RetroRead label="What to avoid" body={campaign.retro_avoid} />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <Field label="What worked" htmlFor={`worked-${campaign.id}`}>
        <Textarea
          id={`worked-${campaign.id}`}
          rows={2}
          value={worked}
          onChange={(e) => setWorked(e.target.value)}
          placeholder="The hook that landed, the format, the posting time…"
        />
      </Field>
      <Field label="What to avoid" htmlFor={`avoid-${campaign.id}`}>
        <Textarea
          id={`avoid-${campaign.id}`}
          rows={2}
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          placeholder="What cost money or time and didn't pay for itself."
        />
      </Field>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => saveCampaignRetro(campaign.id, worked, avoid), {
            success: "Retro saved.",
          })
        }
      >
        Save retro
      </Button>
    </div>
  );
}

function RetroRead({ label, body }: { label: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="max-w-[70ch] text-[13px] text-ink">{body}</p>
    </div>
  );
}
