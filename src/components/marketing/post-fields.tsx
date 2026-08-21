"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { advancePost, deletePost, updatePost } from "@/lib/actions/marketing";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { UrlInput } from "@/components/ui/typed-inputs";
import { nextPostStatus, POST_ADVANCE_LABEL } from "@/lib/posts";
import { CHANNEL_OPTIONS } from "@/lib/options";
import type { MarketingPost, MembersMap } from "@/lib/types";

/**
 * The editable body of a post. Everything saves on commit rather than behind a
 * form — this panel is opened to change one thing (set the date, paste the
 * live link, hand it to someone), and a Save button under six fields makes
 * each of those a three-step job. Text commits on blur; pickers on change.
 */
export function PostFields({
  post,
  campaigns,
  members,
  canWrite,
}: {
  post: MarketingPost;
  campaigns: { id: string; name: string }[];
  members: MembersMap;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [notes, setNotes] = useState(post.notes ?? "");
  const [url, setUrl] = useState(post.url ?? "");

  const memberOptions = [
    { value: "", label: "Unassigned" },
    ...Object.entries(members).map(([id, m]) => ({ value: id, label: m.name })),
  ];

  const next = nextPostStatus(post.status);

  function save(patch: Parameters<typeof updatePost>[1], success?: string) {
    run(() => updatePost(post.id, patch), success ? { success } : {});
  }

  return (
    <div className="space-y-5">
      {canWrite && next && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              run(() => advancePost(post.id, post.status), {
                onSuccess: () => router.refresh(),
              })
            }
          >
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {POST_ADVANCE_LABEL[post.status]}
          </Button>
          {post.status === "scheduled" && !post.publish_on && (
            <span className="text-xs text-faint">
              It has no date yet — set one below or it won&apos;t appear on the
              calendar.
            </span>
          )}
        </div>
      )}

      <Panel>
        <PanelHeader title="The post" />
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel" htmlFor="post-channel">
              <Dropdown
                id="post-channel"
                value={post.channel}
                options={CHANNEL_OPTIONS}
                disabled={!canWrite || pending}
                onChange={(value) => save({ channel: value })}
              />
            </Field>
            <Field label="Owner" htmlFor="post-owner">
              <Dropdown
                id="post-owner"
                value={post.owner_id ?? ""}
                options={memberOptions}
                disabled={!canWrite || pending}
                onChange={(value) => save({ owner_id: value || null })}
              />
            </Field>
            <Field label="Publish date" htmlFor="post-publish">
              <DatePicker
                id="post-publish"
                name="publish_on"
                defaultValue={post.publish_on ?? ""}
                onChange={(iso) => canWrite && save({ publish_on: iso || null })}
              />
            </Field>
            <Field label="Campaign" htmlFor="post-campaign">
              <Dropdown
                id="post-campaign"
                value={post.campaign_id ?? ""}
                disabled={!canWrite || pending}
                onChange={(value) => save({ campaign_id: value || null })}
                options={[
                  { value: "", label: "No campaign" },
                  ...campaigns.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
          </div>

          <Field
            label="Live link"
            htmlFor="post-url"
            hint={post.url ? undefined : "Paste it once the post is out."}
          >
            <div className="flex items-center gap-2">
              <UrlInput
                id="post-url"
                className="flex-1"
                value={url}
                disabled={!canWrite}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => {
                  const cleaned = url.trim();
                  if (cleaned === (post.url ?? "")) return;
                  save({ url: cleaned || null });
                }}
              />
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-faint transition-colors duration-150 hover:text-ink"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  <span className="sr-only">Open the live post</span>
                </a>
              )}
            </div>
          </Field>

          <Field
            label="Notes"
            htmlFor="post-notes"
            hint="The idea, the caption draft, whatever the person making it needs."
          >
            <Textarea
              id="post-notes"
              rows={6}
              value={notes}
              disabled={!canWrite}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (post.notes ?? "")) save({ notes: notes || null });
              }}
            />
          </Field>
        </div>
      </Panel>

      {canWrite && (
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Really delete this post?"
          onConfirm={() =>
            run(() => deletePost(post.id), {
              success: "Post deleted.",
              onSuccess: () => router.push(`/marketing/clients/${post.client_id}`),
            })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete post
        </ConfirmButton>
      )}
    </div>
  );
}
