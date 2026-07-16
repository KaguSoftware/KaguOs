"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowBigUp, Loader2, Trash2 } from "lucide-react";
import {
  addComment,
  deleteComment,
  deleteIdea,
  promoteIdea,
  setIdeaStatus,
  toggleVote,
} from "@/lib/actions/work";
import type { ActionResult } from "@/lib/actions/account";
import { Button, ConfirmButton, SubmitButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function VoteButton({
  ideaId,
  votes,
  voted,
}: {
  ideaId: string;
  votes: number;
  voted: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startTransition(async () => {
          await toggleVote(ideaId, voted);
        });
      }}
      aria-pressed={voted}
      aria-label={voted ? "Remove your vote" : "Vote for this idea"}
      className={cn(
        "flex min-w-12 flex-col items-center rounded-md border px-2 py-1 transition-colors duration-150",
        voted
          ? "border-primary/40 bg-primary/10 text-primary-dim"
          : "border-line text-muted hover:border-line-strong hover:text-ink",
        pending && "opacity-60"
      )}
    >
      <ArrowBigUp className="size-4" aria-hidden />
      <span className="font-mono text-xs">{votes}</span>
    </button>
  );
}

export function IdeaActions({
  ideaId,
  status,
  canDelete,
}: {
  ideaId: string;
  status: "open" | "promoted" | "archived";
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) setError(result.message);
    });
  }

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
            onClick={() => run(() => setIdeaStatus(ideaId, "archived"))}
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
          onClick={() => run(() => setIdeaStatus(ideaId, "open"))}
        >
          Reopen
        </Button>
      )}
      {canDelete && (
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Really delete?"
          onConfirm={() => run(() => deleteIdea(ideaId))}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete
        </ConfirmButton>
      )}
      {error && (
        <p role="status" className="text-[13px] text-danger">
          {error}
        </p>
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
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteComment(commentId, ideaId);
        })
      }
      title="Delete comment"
      aria-label="Delete comment"
      className="text-faint transition-colors duration-150 hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  );
}
