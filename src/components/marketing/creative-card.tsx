"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clapperboard, Loader2, Scissors } from "lucide-react";
import { advanceCreative } from "@/lib/actions/marketing";
import { useAction } from "@/lib/use-action";
import { Badge } from "@/components/ui/badge";
import {
  ADVANCE_LABEL,
  CREATIVE_STATUS_LABELS,
  CREATIVE_STATUS_TONE,
  nextStatus,
} from "@/lib/creatives";
import { cn, formatDate, todayInIstanbul } from "@/lib/utils";
import type { Creative, CreativeStatus, MembersMap } from "@/lib/types";

/**
 * One video, as a row. Used by the queue and the pipeline board — the same
 * object should not look like two different things depending on which screen
 * you found it on.
 *
 * The advance button is the section's one-click primitive: it says what will
 * happen ("Send to client"), not what it is ("Advance"), and it applies
 * optimistically so the row moves under the cursor rather than after a round
 * trip. Rolling back on failure is what makes that safe.
 */
export function CreativeCard({
  creative,
  members,
  clientName,
  canWrite,
  /** The board already groups by status, so repeating it on every card is noise. */
  showStatus = true,
}: {
  creative: Creative;
  members: MembersMap;
  clientName?: string;
  canWrite: boolean;
  showStatus?: boolean;
}) {
  const { pending, run } = useAction();
  const [status, setStatus] = useState<CreativeStatus>(creative.status);
  const next = nextStatus(status);

  const owner = creative.owner_id ? members[creative.owner_id] : null;
  const editor = creative.editor_id ? members[creative.editor_id] : null;
  // Whoever the video is actually sitting with. During the edit that's the
  // editor; the rest of the time it's the producer.
  const holder = status === "editing" && editor ? editor : owner;

  const today = todayInIstanbul();
  const overdue =
    creative.publish_on !== null && creative.publish_on < today && status !== "live";

  return (
    <div className="group flex flex-col gap-2 px-4 py-3 transition-colors duration-150 hover:bg-raised/50">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/marketing/creatives/${creative.id}`}
            className="text-sm font-medium text-ink underline-offset-2 hover:text-primary-dim hover:underline"
          >
            {creative.title}
          </Link>
          {creative.hook && (
            <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{creative.hook}</p>
          )}
        </div>
        {showStatus && (
          <Badge tone={CREATIVE_STATUS_TONE[status]}>
            {CREATIVE_STATUS_LABELS[status]}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        {clientName && <span className="text-muted">{clientName}</span>}
        {holder && (
          <span className="inline-flex items-center gap-1">
            {status === "editing" ? (
              <Scissors className="size-3" aria-hidden />
            ) : (
              <Clapperboard className="size-3" aria-hidden />
            )}
            <span style={{ color: holder.color }}>{holder.name}</span>
          </span>
        )}
        {creative.shoot_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" aria-hidden />
            Shoot {formatDate(creative.shoot_date)}
          </span>
        )}
        {creative.publish_on && (
          // Overdue is the one thing on this row that needs to be loud. It's
          // said in words as well as colour — colour alone fails anyone who
          // can't distinguish it (PRODUCT.md's accessibility line).
          <span className={cn("font-mono tabular-nums", overdue && "text-danger")}>
            {overdue ? "Overdue " : "Publish "}
            {formatDate(creative.publish_on)}
          </span>
        )}
        {creative.parent_creative_id && <span>Variant</span>}
      </div>

      {canWrite && next && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const was = status;
              run(() => advanceCreative(creative.id, was), {
                optimistic: () => setStatus(next),
                rollback: () => setStatus(was),
              });
            }}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-[13px] text-muted",
              "transition-[color,background-color,border-color,transform] duration-150 ease-mac",
              "hover:bg-raised hover:text-ink active:scale-[0.98]",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
            {ADVANCE_LABEL[status]}
          </button>
        </div>
      )}
    </div>
  );
}
