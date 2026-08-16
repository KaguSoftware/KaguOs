"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { reviewProof } from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SignedFileLink } from "@/components/ui/signed-file-link";
import { StatusBadge } from "@/components/learn/proof-block";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { SprintProofSubmission, SprintStage } from "@/lib/types";

/**
 * The admin side of a hand-in: every proof anyone has sent for this sprint,
 * newest waiting one first, each with the two things a reviewer can say.
 *
 * It's a queue, not a gate. The stages were cleared the moment the work was
 * handed in; nothing here takes that back (0061). Accepting says "this holds",
 * asking for changes says what's missing — and that note is required, because a
 * bare rejection tells the person to guess.
 */
export function ProofReview({
  sprintId,
  submissions,
  stages,
  people,
}: {
  sprintId: string;
  submissions: SprintProofSubmission[];
  stages: SprintStage[];
  people: { id: string; name: string }[];
}) {
  const stageTitle = new Map(stages.map((s) => [s.id, s.title]));
  const personName = new Map(people.map((p) => [p.id, p.name]));

  // Waiting first — the whole reason to open this panel — then most recent.
  const ordered = [...submissions].sort((a, b) => {
    const waiting = Number(b.status === "submitted") - Number(a.status === "submitted");
    return waiting !== 0 ? waiting : b.updated_at.localeCompare(a.updated_at);
  });

  if (ordered.length === 0) {
    return (
      <p className="p-4 text-[calc(13px*var(--text-scale,1))] text-faint">
        Nothing handed in yet. Proofs land here the moment someone sends one.
      </p>
    );
  }

  return (
    <ul className="grid divide-y divide-line">
      {ordered.map((submission) => (
        <ReviewRow
          key={submission.id}
          sprintId={sprintId}
          submission={submission}
          stage={stageTitle.get(submission.stage_id) ?? "Stage"}
          person={personName.get(submission.user_id) ?? "Someone"}
        />
      ))}
    </ul>
  );
}

function ReviewRow({
  sprintId,
  submission,
  stage,
  person,
}: {
  sprintId: string;
  submission: SprintProofSubmission;
  stage: string;
  person: string;
}) {
  const { pending, run } = useAction();
  // Waiting rows open on arrival: the queue's job is to be read, and a panel
  // of closed rows is a panel you have to click through to do the work.
  const [open, setOpen] = useState(submission.status === "submitted");
  const [note, setNote] = useState(submission.review_note ?? "");

  function decide(decision: "accepted" | "changes_requested") {
    run(() => reviewProof(submission.id, sprintId, decision, note), {
      success: decision === "accepted" ? "Accepted." : "Changes requested.",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-raised/40 sm:px-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[calc(13px*var(--text-scale,1))] text-ink">
            {person} · {stage}
          </span>
          <span className="mt-0.5 block font-mono text-xs text-faint">
            {formatRelative(submission.updated_at)}
          </span>
        </span>
        <StatusBadge status={submission.status} />
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-faint transition-transform duration-200 ease-mac motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="grid gap-3 border-t border-line px-3.5 py-3 sm:px-4">
          {submission.body && (
            <p className="max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-ink">
              {submission.body}
            </p>
          )}

          {submission.file_path && (
            <SignedFileLink
              bucket="learn"
              path={submission.file_path}
              className="flex w-fit items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
            >
              <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
              <span className="max-w-[16rem] truncate">
                {submission.file_name ?? "Attached file"}
              </span>
            </SignedFileLink>
          )}

          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={2000}
            aria-label={`Note back to ${person}`}
            placeholder="What's missing, or what made this good. Required to ask for changes."
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => decide("accepted")}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !note.trim()}
              title={note.trim() ? undefined : "Say what's missing first"}
              onClick={() => decide("changes_requested")}
            >
              Ask for changes
            </Button>
            <span className="text-xs text-faint">
              Either way the stage stays cleared — this is the note, not the gate.
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
