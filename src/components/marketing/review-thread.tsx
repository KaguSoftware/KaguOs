"use client";

import { useState } from "react";
import { Check, MessageSquare, Undo2 } from "lucide-react";
import { reviewCreative } from "@/lib/actions/marketing";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { formatTimecode } from "@/lib/creatives";
import { cn, formatRelative } from "@/lib/utils";
import type { CreativeReview, MembersMap } from "@/lib/types";

/**
 * The review thread — the record of every decision made on one cut.
 *
 * Append-only in the database (0064) and append-only here: there is no edit
 * affordance and no delete, because the sequence is the documentation of why
 * the video changed. Rendered oldest-first, which is the order it reads as a
 * conversation rather than as a feed.
 *
 * ── The timecode field is the whole design ────────────────────────────────
 * "The hook at 0:14 is weak" is a note an editor can act on in one pass. "The
 * second bit is off" costs a phone call. So the timecode sits inline with the
 * comment box, not behind an option, and it accepts either "1:07" or plain
 * seconds because people type both.
 */
export function ReviewThread({
  creativeId,
  reviews,
  members,
  /** Names for people not in `members` — a client's reviewers. See below. */
  reviewerNames,
  canReview,
  /** Client-facing copy differs: they are deciding, we are annotating. */
  asClient = false,
}: {
  creativeId: string;
  reviews: CreativeReview[];
  members: MembersMap;
  reviewerNames?: Record<string, string>;
  canReview: boolean;
  asClient?: boolean;
}) {
  return (
    <div className="space-y-4">
      {reviews.length > 0 && (
        <ol className="space-y-3">
          {reviews.map((review) => (
            <ReviewEntry
              key={review.id}
              review={review}
              members={members}
              reviewerNames={reviewerNames}
            />
          ))}
        </ol>
      )}

      {canReview ? (
        <ReviewForm creativeId={creativeId} asClient={asClient} />
      ) : (
        reviews.length === 0 && (
          <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
            No notes on this cut yet.
          </p>
        )
      )}
    </div>
  );
}

function ReviewEntry({
  review,
  members,
  reviewerNames,
}: {
  review: CreativeReview;
  members: MembersMap;
  reviewerNames?: Record<string, string>;
}) {
  // Three cases, in order: a colleague we can name and colour; a reviewer we
  // were given a name for; and the two that read the same to a member — an
  // outside approver (never in `members`, by design) and an account since
  // revoked, whose row survives them (0064).
  const member = review.reviewer_id ? members[review.reviewer_id] : null;
  const name =
    member?.name ??
    (review.reviewer_id ? reviewerNames?.[review.reviewer_id] : null) ??
    (review.reviewer_id ? "The client" : "A former reviewer");
  const approved = review.decision === "approved";

  return (
    <li className="rounded-md border border-line bg-surface px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[calc(13px*var(--text-scale,1))] font-medium",
            approved ? "text-primary-dim" : "text-amber"
          )}
        >
          {approved ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Undo2 className="size-3.5" aria-hidden />
          )}
          {approved ? "Approved" : "Changes asked"}
        </span>
        <span
          className="text-[calc(13px*var(--text-scale,1))]"
          style={member ? { color: member.color } : undefined}
        >
          {name}
        </span>
        {review.timecode !== null && (
          // Mono and tabular so a column of timecodes lines up when several
          // notes land on one cut.
          <span className="rounded bg-raised px-1.5 py-px font-mono text-xs tabular-nums text-muted">
            {formatTimecode(review.timecode)}
          </span>
        )}
        <span className="ml-auto text-xs text-faint">
          {formatRelative(review.created_at)}
        </span>
      </div>
      {review.comment && (
        <p className="mt-1.5 max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] text-ink">
          {review.comment}
        </p>
      )}
    </li>
  );
}

function ReviewForm({
  creativeId,
  asClient,
}: {
  creativeId: string;
  asClient: boolean;
}) {
  const { pending, run } = useAction();
  const [comment, setComment] = useState("");
  const [timecode, setTimecode] = useState("");

  function submit(decision: "approved" | "changes") {
    run(
      () => reviewCreative(creativeId, decision, comment, timecode),
      {
        onSuccess: () => {
          setComment("");
          setTimecode("");
        },
      }
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-line bg-surface px-3.5 py-3.5">
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Field
          label={asClient ? "Your notes" : "Note"}
          htmlFor={`review-comment-${creativeId}`}
        >
          <Textarea
            id={`review-comment-${creativeId}`}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              asClient
                ? "What should change? Point at a moment if you can."
                : "What needs another pass before this goes out."
            }
          />
        </Field>
        <Field
          label="At"
          htmlFor={`review-timecode-${creativeId}`}
          hint="e.g. 0:14"
        >
          <Input
            id={`review-timecode-${creativeId}`}
            value={timecode}
            onChange={(e) => setTimecode(e.target.value)}
            placeholder="0:00"
            inputMode="numeric"
            className="font-mono tabular-nums"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => submit("approved")}
        >
          <Check className="size-3.5" aria-hidden />
          {asClient ? "Approve this cut" : "Sign off internally"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => submit("changes")}
        >
          <MessageSquare className="size-3.5" aria-hidden />
          Ask for changes
        </Button>
        {/* Said out loud, because it's the one thing about this control that
            can't be undone and isn't obvious from looking at it. */}
        <span className="text-xs text-faint">Decisions are kept, not edited.</span>
      </div>
    </div>
  );
}
