"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigDown, ArrowBigUp, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  addComment,
  deleteComment,
  deleteIdea,
  promoteIdea,
  setIdeaStatus,
  setVote,
  updateIdea,
} from "@/lib/actions/work";
import { Button, ConfirmButton, SubmitButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type VoteState = {
  /** This user's current vote: 1 up, -1 down, 0 none. */
  mine: -1 | 0 | 1;
  up: number;
  down: number;
};

/**
 * Up/down vote control. A compact three-cell segment (▲ · net · ▼): clicking a
 * cell casts that vote, clicking it again clears it. Net score in mono. The
 * whole thing is optimistic — the vote lands instantly and the server reconciles
 * on the next render. When a fresh upvote makes the idea unanimous the server
 * returns the new project id and we route straight to it.
 */
export function VoteControl({
  ideaId,
  state,
  size = "md",
}: {
  ideaId: string;
  state: VoteState;
  size?: "sm" | "md";
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const [local, setLocal] = useState(state);

  // Adopt server truth during render (not in an effect) so a just-cast vote
  // never bounces to the stale count for a frame. See the perf note in HANDOFF.
  const [seen, setSeen] = useState(state);
  if (seen.mine !== state.mine || seen.up !== state.up || seen.down !== state.down) {
    setSeen(state);
    setLocal(state);
  }

  const net = local.up - local.down;

  function cast(next: -1 | 1) {
    const was = local;
    // Toggle off if you click your current vote; otherwise switch/set.
    const value: -1 | 0 | 1 = was.mine === next ? 0 : next;

    // Recompute the two tallies from the transition (was.mine → value).
    const up = local.up - (was.mine === 1 ? 1 : 0) + (value === 1 ? 1 : 0);
    const down = local.down - (was.mine === -1 ? 1 : 0) + (value === -1 ? 1 : 0);
    setLocal({ mine: value, up, down });

    startTransition(async () => {
      const result = await setVote(ideaId, value);
      if (result && !result.ok) {
        setLocal(was);
        toast.error(result.message);
        return;
      }
      if (result?.promotedProjectId) {
        toast.success("Voted in — opening the new project.");
        router.push(`/work/projects/${result.promotedProjectId}`);
      }
    });
  }

  const cell =
    size === "sm" ? "size-7" : "size-8";
  const icon = size === "sm" ? "size-4" : "size-[18px]";

  return (
    <div
      className="inline-flex flex-col items-center overflow-hidden rounded-md border border-line"
      role="group"
      aria-label="Vote on this idea"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cast(1);
        }}
        aria-pressed={local.mine === 1}
        aria-label={local.mine === 1 ? "Remove your upvote" : "Upvote"}
        className={cn(
          "flex items-center justify-center transition-colors duration-150",
          cell,
          local.mine === 1
            ? "bg-primary/12 text-primary-dim"
            : "text-faint hover:bg-raised hover:text-ink"
        )}
      >
        <ArrowBigUp className={icon} aria-hidden />
      </button>
      <span
        className={cn(
          "flex w-full items-center justify-center border-y border-line font-mono tabular-nums",
          size === "sm" ? "py-0.5 text-[11px]" : "py-1 text-xs",
          net > 0 ? "text-primary-dim" : net < 0 ? "text-danger" : "text-muted"
        )}
        aria-label={`Net score ${net}`}
      >
        {net > 0 ? `+${net}` : net}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cast(-1);
        }}
        aria-pressed={local.mine === -1}
        aria-label={local.mine === -1 ? "Remove your downvote" : "Downvote"}
        className={cn(
          "flex items-center justify-center transition-colors duration-150",
          cell,
          local.mine === -1
            ? "bg-danger/12 text-danger"
            : "text-faint hover:bg-raised hover:text-ink"
        )}
      >
        <ArrowBigDown className={icon} aria-hidden />
      </button>
    </div>
  );
}

/**
 * "6 / 8 to promote" — a thin progress hairline showing how close an open idea
 * is to the unanimous bar. A single veto (any downvote) blocks promotion, so
 * when one exists we say so plainly in danger tone rather than pretending the
 * bar is still reachable by counting up. Quiet by design — an instrument reading,
 * not a game meter.
 */
export function PromoteProgress({
  up,
  down,
  required,
}: {
  up: number;
  down: number;
  required: number | null;
}) {
  // No meaningful bar for a one-person board or a missing snapshot.
  if (!required || required < 2) return null;

  const blocked = down > 0;
  const pct = Math.min(100, Math.round((up / required) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        {blocked ? (
          <span className="font-medium text-danger">
            Blocked — {down} {down === 1 ? "veto" : "vetoes"}
          </span>
        ) : up >= required ? (
          <span className="font-medium text-primary-dim">Unanimous — promoting…</span>
        ) : (
          <span className="text-faint">
            <span className="font-mono tabular-nums text-muted">
              {up} / {required}
            </span>{" "}
            to promote
          </span>
        )}
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-valuenow={up}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-label="Progress toward unanimous promotion"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-300 ease-out",
            blocked ? "bg-danger/50" : "bg-primary/70"
          )}
          style={{ width: `${blocked ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}

export function EditableIdeaBody({
  ideaId,
  title,
  body,
  canEdit,
}: {
  ideaId: string;
  title: string;
  body: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title, body: body ?? "" });

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {body ? (
            <p className="max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {body}
            </p>
          ) : (
            <p className="text-sm text-faint">No details.</p>
          )}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft({ title, body: body ?? "" });
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Input
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        maxLength={200}
        aria-label="Idea title"
      />
      <Textarea
        value={draft.body}
        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
        rows={5}
        placeholder="Describe the idea…"
        aria-label="Idea details"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => updateIdea(ideaId, draft), {
              success: "Idea updated.",
              onSuccess: () => {
                setEditing(false);
                router.refresh();
              },
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function IdeaActions({
  ideaId,
  status,
  canDelete,
}: {
  ideaId: string;
  status: "open" | "promoted" | "archived" | "rejected";
  canDelete: boolean;
}) {
  const { pending, run } = useAction();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />}
      {status === "open" && (
        <>
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => run(() => promoteIdea(ideaId))}
          >
            Promote to project
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => setIdeaStatus(ideaId, "archived"), { success: "Idea archived." })
            }
          >
            Archive
          </Button>
        </>
      )}
      {status === "archived" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => setIdeaStatus(ideaId, "open"), { success: "Idea reopened." })
          }
        >
          Reopen
        </Button>
      )}
      {canDelete && (
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Really delete?"
          onConfirm={() => run(() => deleteIdea(ideaId), { success: "Idea deleted." })}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete
        </ConfirmButton>
      )}
    </div>
  );
}

export function CommentForm({ ideaId }: { ideaId: string }) {
  const [result, action] = useActionState(addComment, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <form ref={formRef} action={action} className="flex items-start gap-2">
      <input type="hidden" name="idea_id" value={ideaId} />
      <Textarea
        name="body"
        rows={2}
        placeholder="Add a comment…"
        className="min-h-9 flex-1"
      />
      <SubmitButton size="sm">Comment</SubmitButton>
      {result && !result.ok && (
        <p role="status" className="text-[13px] text-danger">
          {result.message}
        </p>
      )}
    </form>
  );
}

export function DeleteCommentButton({
  commentId,
  ideaId,
}: {
  commentId: string;
  ideaId: string;
}) {
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => deleteComment(commentId, ideaId))}
      title="Delete comment"
      aria-label="Delete comment"
      className="text-faint transition-colors duration-150 hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  );
}
