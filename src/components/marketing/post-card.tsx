"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { advancePost } from "@/lib/actions/marketing";
import { useAction } from "@/lib/use-action";
import { Badge } from "@/components/ui/badge";
import {
  nextPostStatus,
  POST_ADVANCE_LABEL,
  POST_STATUS_LABELS,
  POST_STATUS_TONE,
} from "@/lib/posts";
import { CHANNEL_OPTIONS, optionLabel } from "@/lib/options";
import { cn, formatDate, todayInIstanbul } from "@/lib/utils";
import type { MarketingPost, MembersMap, PostStatus } from "@/lib/types";

/**
 * One post, as a row. Used by the client board, the schedule and the overview
 * strips — the same object should not look like different things per screen.
 *
 * The advance button is the section's one-click primitive: it says what will
 * happen ("Mark posted"), and it applies optimistically so the row moves under
 * the cursor. Rolling back on failure is what makes that safe.
 */
export function PostCard({
  post,
  members,
  clientName,
  canWrite,
  /** The board already groups by status, so repeating it on every card is noise. */
  showStatus = true,
}: {
  post: MarketingPost;
  members: MembersMap;
  /** Only supplied by cross-client views — inside one client it'd be noise. */
  clientName?: string;
  canWrite: boolean;
  showStatus?: boolean;
}) {
  const { pending, run } = useAction();
  const [status, setStatus] = useState<PostStatus>(post.status);
  const next = nextPostStatus(status);

  const owner = post.owner_id ? members[post.owner_id] : null;
  const today = todayInIstanbul();
  const overdue =
    post.publish_on !== null && post.publish_on < today && status !== "posted";

  return (
    <div className="group flex flex-col gap-2 px-4 py-3 transition-colors duration-150 hover:bg-raised/50">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/marketing/posts/${post.id}`}
            className="text-sm font-medium text-ink underline-offset-2 hover:text-primary-dim hover:underline"
          >
            {post.title}
          </Link>
        </div>
        {showStatus && (
          <Badge tone={POST_STATUS_TONE[status]}>{POST_STATUS_LABELS[status]}</Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        {clientName && <span className="text-muted">{clientName}</span>}
        <span>{optionLabel(CHANNEL_OPTIONS, post.channel)}</span>
        {owner && <span style={{ color: owner.color }}>{owner.name}</span>}
        {post.publish_on && (
          // Overdue is the one thing on this row that needs to be loud. Words
          // as well as colour — colour alone fails anyone who can't see it.
          <span className={cn("font-mono tabular-nums", overdue && "text-danger")}>
            {overdue ? "Overdue " : ""}
            {formatDate(post.publish_on)}
          </span>
        )}
        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted hover:text-ink"
          >
            View post
            <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>

      {canWrite && next && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const was = status;
              run(() => advancePost(post.id, was), {
                optimistic: () => setStatus(next),
                rollback: () => setStatus(was),
              });
            }}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-[calc(13px*var(--text-scale,1))] text-muted",
              "transition-[color,background-color,border-color,transform] duration-150 ease-mac",
              "hover:bg-raised hover:text-ink active:scale-[0.98]",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
            {POST_ADVANCE_LABEL[status]}
          </button>
        </div>
      )}
    </div>
  );
}
