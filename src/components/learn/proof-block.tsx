"use client";

import { useState } from "react";
import { Check, FileText, Loader2, Paperclip, X } from "lucide-react";
import { submitProof, withdrawProof } from "@/lib/actions/learn";
import { createClient } from "@/lib/supabase/client";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SignedFileLink } from "@/components/ui/signed-file-link";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  ProofStatus,
  SprintGoal,
  SprintProofCriterion,
  SprintProofSubmission,
  SprintStage,
} from "@/lib/types";

/**
 * A stage's gate, and the box you hand it in through.
 *
 * The proof used to be a line you ticked, which made a two-day stage cost one
 * click and left nothing behind — nobody could see what you routed or which
 * prompt you rebuilt. So it reads as a brief now: what to do, the conditions it
 * has to meet, and a box for the thing itself (text, a file, or both).
 *
 * Handing in IS the tick. There is no separate checkbox on this row, because
 * two controls for one claim is how a proof ends up ticked with nothing behind
 * it. A review afterwards says whether it holds; it never takes the stage back
 * (see 0061) — you did the work on Tuesday whatever the verdict says on Friday.
 */
export function ProofBlock({
  sprintId,
  meId,
  stage,
  goal,
  criteria,
  submission,
  done,
  readOnly,
  onSubmitted,
  onWithdrawn,
}: {
  sprintId: string;
  meId: string;
  stage: SprintStage | null;
  /** The stage's proof goal, when it has one. */
  goal: SprintGoal | null;
  criteria: SprintProofCriterion[];
  /** Mine, if I've handed in. Other people's never reach this component. */
  submission: SprintProofSubmission | null;
  done: boolean;
  /** Not a participant, or view-only: the brief reads, the box is absent. */
  readOnly: boolean;
  onSubmitted: () => void;
  onWithdrawn: () => void;
}) {
  const { run, toast } = useAction();
  const [body, setBody] = useState(submission?.body ?? "");
  const [file, setFile] = useState<File | null>(null);
  // A hand-in already sent shows as a record; the box comes back on "Edit".
  const [editing, setEditing] = useState(!submission);
  const [uploading, setUploading] = useState(false);

  // Adopted during render, not in an effect (same rule as the board): an effect
  // would commit the stale draft first and flash the old text back for a frame.
  const [seen, setSeen] = useState(submission);
  if (seen !== submission) {
    setSeen(submission);
    setBody(submission?.body ?? "");
    setFile(null);
    setEditing(!submission);
  }

  const title = goal?.title ?? stage?.proof ?? "Proof";
  const canSend = body.trim().length > 0 || file !== null;

  async function send() {
    if (!canSend || uploading) return;

    // The file goes browser → private bucket under this person's own proof
    // prefix (that prefix is what the storage policy gates on), and only then
    // does the row get written. A server round-trip carrying the bytes would
    // be the slow path for no gain.
    let filePath = submission?.file_path ?? null;
    let fileName = submission?.file_name ?? null;
    if (file) {
      setUploading(true);
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `proof/${meId}/${sprintId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("learn").upload(path, file);
      setUploading(false);
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }
      filePath = path;
      fileName = file.name;
    }

    // Rollback only undoes a tick this hand-in put there. Editing one that was
    // already in ticks nothing, so a failed edit must not untick the stage.
    const first = !submission;
    run(() => submitProof(sprintId, stage?.id ?? "", { body, filePath, fileName }), {
      success: "Handed in.",
      optimistic: onSubmitted,
      rollback: first ? onWithdrawn : undefined,
      onSuccess: () => {
        setFile(null);
        setEditing(false);
      },
    });
  }

  return (
    <div className="mt-3 border-t border-dashed border-line pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Proof
        </p>
        {submission && <StatusBadge status={submission.status} />}
      </div>

      {/* The claim itself. Not a button: the box below is how it gets made. */}
      <div className="flex items-start gap-2.5 px-0.5">
        <span
          aria-hidden
          className={cn(
            "mt-px flex size-[18px] shrink-0 rotate-45 items-center justify-center rounded-[4px] transition-colors duration-150 motion-reduce:transition-none",
            done ? "bg-primary text-primary-ink" : "border border-line-strong bg-surface"
          )}
        >
          {done && <Check className="size-2.5 -rotate-45" />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[13px] leading-relaxed",
              done ? "text-faint line-through decoration-line-strong" : "text-ink"
            )}
          >
            {title}
          </span>
          {stage?.proof && goal && (
            <span className="mt-0.5 block max-w-[70ch] text-xs leading-relaxed text-muted">
              {stage.proof}
            </span>
          )}
        </span>
      </div>

      {stage?.proof_brief && (
        <div className="mt-2.5 grid gap-2 pl-7">
          {stage.proof_brief.split("\n\n").map((para, i) => (
            <p key={i} className="max-w-[70ch] text-[13px] leading-relaxed text-muted">
              {para}
            </p>
          ))}
        </div>
      )}

      {criteria.length > 0 && (
        <div className="mt-3 pl-7">
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">
            Accepted when · all {criteria.length}
          </p>
          {/* An ordered list, not tickboxes. A checklist you tick to unlock a
              checklist is bureaucracy; the hand-in is the only thing recorded,
              and these are what it's read against. */}
          <ol className="grid gap-1.5">
            {criteria.map((criterion, index) => (
              <li key={criterion.id} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-px w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-faint"
                >
                  {index + 1}
                </span>
                <span className="max-w-[66ch] text-[13px] leading-relaxed text-muted">
                  {criterion.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {readOnly ? (
        <p className="mt-3 pl-7 text-xs text-faint">
          Join this sprint to hand your proof in.
        </p>
      ) : (
        <div className="mt-3 pl-7">
          {stage?.proof_submit && (
            <p className="mb-2 max-w-[70ch] text-[13px] leading-relaxed text-ink">
              {stage.proof_submit}
            </p>
          )}

          {editing ? (
            <div className="grid gap-2">
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                maxLength={8000}
                aria-label={`Your proof for ${title}`}
                placeholder={
                  "Paste what you did — the prompt, the answer, the routing decision and why.\nAttach a file below if the work is one."
                }
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void send();
                  }
                }}
              />

              <FilePick
                file={file}
                existingName={file ? null : (submission?.file_name ?? null)}
                onPick={setFile}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canSend || uploading}
                  aria-busy={uploading}
                  onClick={() => void send()}
                >
                  {uploading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                  {submission ? "Hand in again" : "Hand in proof"}
                </Button>
                {submission && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBody(submission.body ?? "");
                      setFile(null);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <span className="text-xs text-faint">
                  {submission
                    ? "Handing in again puts it back in review."
                    : "This clears the stage. ⌘↵ to send."}
                </span>
              </div>
            </div>
          ) : (
            submission && (
              <Handed
                submission={submission}
                onEdit={() => setEditing(true)}
                onWithdraw={() =>
                  run(() => withdrawProof(sprintId, stage?.id ?? ""), {
                    success: "Withdrawn.",
                    optimistic: onWithdrawn,
                    rollback: onSubmitted,
                  })
                }
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

/** What you handed in, and what came back. */
function Handed({
  submission,
  onEdit,
  onWithdraw,
}: {
  submission: SprintProofSubmission;
  onEdit: () => void;
  onWithdraw: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-line bg-raised/30 p-3">
      {submission.body && (
        <p className="max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
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

      {submission.review_note && (
        <p
          className={cn(
            "max-w-[70ch] border-l-2 pl-2.5 text-[13px] leading-relaxed",
            submission.status === "accepted"
              ? "border-primary/40 text-muted"
              : "border-amber/50 text-ink"
          )}
        >
          {submission.review_note}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-faint">
          handed in {formatRelative(submission.created_at)}
          {submission.reviewed_at && ` · reviewed ${formatRelative(submission.reviewed_at)}`}
        </span>
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onWithdraw}>
            Withdraw
          </Button>
        </span>
      </div>
    </div>
  );
}

/** One optional file. Attaching replaces whatever was attached before. */
function FilePick({
  file,
  existingName,
  onPick,
}: {
  file: File | null;
  /** The file already on the hand-in, when no new one is staged. */
  existingName: string | null;
  onPick: (file: File | null) => void;
}) {
  const name = file?.name ?? existingName;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink">
        <Paperclip className="size-3.5 shrink-0" aria-hidden />
        {name ? "Change file" : "Attach a file"}
        <input
          type="file"
          className="sr-only"
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        />
      </label>
      {name && (
        <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
          <span className="max-w-[14rem] truncate">{name}</span>
          {file && (
            <button
              type="button"
              onClick={() => onPick(null)}
              aria-label={`Remove ${file.name}`}
              className="shrink-0 text-faint transition-colors duration-150 hover:text-danger"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

const STATUS: Record<ProofStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: "in review", tone: "info" },
  accepted: { label: "accepted", tone: "green" },
  changes_requested: { label: "changes asked", tone: "amber" },
};

export function StatusBadge({ status }: { status: ProofStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
