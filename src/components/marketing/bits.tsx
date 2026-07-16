"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useAction } from "@/lib/use-action";
import {
  createCampaign,
  createLink,
  createPost,
  deleteCampaign,
  deleteLink,
  deletePost,
  setCampaignStatus,
  setPostStatus,
} from "@/lib/actions/marketing";
import type { ActionResult } from "@/lib/actions/account";
import { CreateForm } from "@/components/ui/create";
import { ConfirmButton } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import { UrlInput } from "@/components/ui/typed-inputs";
import { CAMPAIGN_STATUS_OPTIONS, CHANNEL_OPTIONS, optionLabel } from "@/lib/options";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type {
  CampaignStatus,
  Currency,
  MarketingCampaign,
  MarketingPost,
  MembersMap,
  PostStatus,
} from "@/lib/types";

const CAMPAIGN_TONE: Record<CampaignStatus, BadgeTone> = {
  idea: "faint",
  planned: "info",
  running: "green",
  done: "neutral",
};

const POST_STATES: { key: PostStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];

export function CampaignRow({ campaign }: { campaign: MarketingCampaign }) {
  const { pending, run } = useAction();
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {campaign.name}
            {campaign.url && (
              <a
                href={campaign.url}
                target="_blank"
                rel="noreferrer"
                title="Open link"
                className="text-faint hover:text-ink"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">Open link</span>
              </a>
            )}
          </p>
          <p className="mt-0.5 text-xs text-faint">
            {optionLabel(CHANNEL_OPTIONS, campaign.channel)}
            {campaign.starts_on &&
              ` · ${formatDate(campaign.starts_on)}${campaign.ends_on ? ` → ${formatDate(campaign.ends_on)}` : ""}`}
            {campaign.budget !== null &&
              ` · ${formatMoney(campaign.budget, campaign.currency)}`}
          </p>
        </div>
        <Badge tone={CAMPAIGN_TONE[status]}>{status}</Badge>
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
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Really delete?"
          onConfirm={() =>
            run(() => deleteCampaign(campaign.id), { success: "Campaign deleted." })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
        </ConfirmButton>
      </div>
      {campaign.notes && (
        <p className="mt-1.5 max-w-[70ch] text-[13px] text-muted">{campaign.notes}</p>
      )}
    </li>
  );
}

export function PostRow({
  post,
  members,
  campaignName,
}: {
  post: MarketingPost;
  members: MembersMap;
  campaignName: string | null;
}) {
  const { pending, run } = useAction();
  const [status, setStatus] = useState<PostStatus>(post.status);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {post.title}
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noreferrer"
                title="Open link"
                className="text-faint hover:text-ink"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">Open link</span>
              </a>
            )}
          </p>
          <p className="mt-0.5 text-xs text-faint">
            {optionLabel(CHANNEL_OPTIONS, post.channel)}
            {post.publish_on && ` · ${formatDate(post.publish_on)}`}
            {campaignName && ` · ${campaignName}`}
            {post.owner_id && members[post.owner_id] && (
              <>
                {" · "}
                <span style={{ color: members[post.owner_id].color }}>
                  {members[post.owner_id].name}
                </span>
              </>
            )}
          </p>
        </div>

        <div
          className="flex overflow-hidden rounded-md border border-line"
          role="group"
          aria-label="Post status"
        >
          {POST_STATES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={status === s.key}
              onClick={() => {
                const was = status;
                run(() => setPostStatus(post.id, s.key), {
                  optimistic: () => setStatus(s.key),
                  rollback: () => setStatus(was),
                });
              }}
              className={cn(
                "px-2 py-1 text-xs transition-colors duration-150",
                status === s.key
                  ? s.key === "published"
                    ? "bg-primary/15 text-primary-dim"
                    : s.key === "scheduled"
                      ? "bg-info/15 text-info"
                      : "bg-raised text-ink"
                  : "text-faint hover:bg-raised hover:text-muted"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="flex items-center gap-1.5">
          {pending && <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />}
          <ConfirmButton
            size="sm"
            disabled={pending}
            confirmLabel="Really delete?"
            onConfirm={() =>
              run(() => deletePost(post.id), { success: "Post deleted." })
            }
          >
            <Trash2 className="size-3.5" aria-hidden />
          </ConfirmButton>
        </span>
      </div>
    </li>
  );
}

export function LinkRow({
  item,
}: {
  item: { id: string; title: string; url: string | null; note: string | null };
}) {
  const { pending, run } = useAction();

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-ink underline-offset-2 hover:text-primary-dim hover:underline"
          >
            {item.title}
          </a>
        ) : (
          <p className="text-sm font-medium text-ink">{item.title}</p>
        )}
        {item.note && <p className="mt-0.5 text-[13px] text-muted">{item.note}</p>}
      </div>
      <ConfirmButton
        size="sm"
        disabled={pending}
        confirmLabel="Really delete?"
        onConfirm={() => run(() => deleteLink(item.id), { success: "Link deleted." })}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </ConfirmButton>
    </li>
  );
}

export function NewCampaignForm() {
  const router = useRouter();
  return (
    <CreateForm
      action={createCampaign}
      fieldLabels={{
        name: "Name",
        starts_on: "Start date",
        ends_on: "End date",
        budget: "Budget",
        url: "Link",
        notes: "Notes",
      }}
      submitLabel="Create campaign"
      onCancel={() => router.back()}
      onDone={() => router.push("/marketing")}
    >
      <Field label="Name" htmlFor="campaign-name">
        <Input id="campaign-name" name="name" maxLength={160} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel" htmlFor="campaign-channel">
          <Dropdown
            id="campaign-channel"
            name="channel"
            defaultValue="other"
            options={CHANNEL_OPTIONS}
          />
        </Field>
        <Field label="Status" htmlFor="campaign-status">
          <Dropdown
            id="campaign-status"
            name="status"
            defaultValue="idea"
            options={CAMPAIGN_STATUS_OPTIONS}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="campaign-starts">
          <DatePicker id="campaign-starts" name="starts_on" />
        </Field>
        <Field label="Ends" htmlFor="campaign-ends">
          <DatePicker id="campaign-ends" name="ends_on" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget" htmlFor="campaign-budget">
          <NumberInput id="campaign-budget" name="budget" />
        </Field>
        <Field label="Budget currency" htmlFor="campaign-currency">
          <Dropdown
            id="campaign-currency"
            name="currency"
            defaultValue="TRY"
            options={[
              { value: "TRY", label: "TRY — Turkish lira" },
              { value: "USD", label: "USD — US dollar" },
              { value: "EUR", label: "EUR — Euro" },
            ]}
          />
        </Field>
      </div>
      <Field label="Link" htmlFor="campaign-url" hint="Ad manager, doc, landing page…">
        <UrlInput id="campaign-url" name="url" />
      </Field>
      <Field label="Notes" htmlFor="campaign-notes">
        <Textarea id="campaign-notes" name="notes" rows={4} />
      </Field>
    </CreateForm>
  );
}

export function NewPostForm({
  campaigns,
  members,
}: {
  campaigns: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <CreateForm
      action={createPost}
      fieldLabels={{
        title: "Title",
        publish_on: "Publish date",
        url: "Link",
        notes: "Notes",
      }}
      submitLabel="Add to calendar"
      onCancel={() => router.back()}
      onDone={() => router.push("/marketing?tab=content")}
    >
      <Field label="Title" htmlFor="post-title">
        <Input id="post-title" name="title" maxLength={200} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel" htmlFor="post-channel">
          <Dropdown
            id="post-channel"
            name="channel"
            defaultValue="instagram"
            options={CHANNEL_OPTIONS}
          />
        </Field>
        <Field label="Publish on" htmlFor="post-publish">
          <DatePicker id="post-publish" name="publish_on" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campaign" htmlFor="post-campaign">
          <Dropdown
            id="post-campaign"
            name="campaign_id"
            defaultValue=""
            options={[
              { value: "", label: "No campaign" },
              ...campaigns.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Field>
        <Field label="Owner" htmlFor="post-owner" hint="Who's making it.">
          <Dropdown
            id="post-owner"
            name="owner_id"
            defaultValue=""
            options={[
              { value: "", label: "Unassigned" },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </Field>
      </div>
      <Field label="Link" htmlFor="post-url" hint="Draft doc or the published post.">
        <UrlInput id="post-url" name="url" />
      </Field>
      <Field label="Notes" htmlFor="post-notes">
        <Textarea id="post-notes" name="notes" rows={4} />
      </Field>
    </CreateForm>
  );
}

export function NewLinkForm() {
  const router = useRouter();
  return (
    <CreateForm
      action={createLink}
      fieldLabels={{ title: "Title", url: "Link", note: "Note" }}
      submitLabel="Save link"
      onCancel={() => router.back()}
      onDone={() => router.push("/marketing?tab=links")}
    >
      <Field label="Title" htmlFor="link-title">
        <Input id="link-title" name="title" maxLength={200} autoFocus />
      </Field>
      <Field label="Link" htmlFor="link-url">
        <UrlInput id="link-url" name="url" />
      </Field>
      <Field label="Note" htmlFor="link-note">
        <Textarea id="link-note" name="note" rows={3} />
      </Field>
    </CreateForm>
  );
}
