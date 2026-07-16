"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowBigUp, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  addComment,
  deleteComment,
  deleteIdea,
  promoteIdea,
  setIdeaStatus,
  toggleVote,
  updateIdea,
} from "@/lib/actions/work";
import { Button, ConfirmButton, SubmitButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
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
  const [, startTransition] = useTransition();
  const toast = useToast();
  // Optimistic: the vote lands instantly, the server reconciles after.
  const [local, setLocal] = useState({ votes, voted });

  useEffect(() => setLocal({ votes, voted }), [votes, voted]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const was = local;
        setLocal({
          votes: was.votes + (was.voted ? -1 : 1),
          voted: !was.voted,
        });
        startTransition(async () => {
          const result = await toggleVote(ideaId, was.voted);
          if (result && !result.ok) {
            setLocal(was);
            toast.error(result.message);
          }
        });
      }}
      aria-pressed={local.voted}
      aria-label={local.voted ? "Remove your vote" : "Vote for this idea"}
      className={cn(
        "flex min-w-12 flex-col items-center rounded-md border px-2 py-1 transition-colors duration-150",
        local.voted
          ? "border-primary/40 bg-primary/10 text-primary-dim"
          : "border-line text-muted hover:border-line-strong hover:text-ink"
      )}
    >
      <ArrowBigUp className="size-4" aria-hidden />
      <span className="font-mono text-xs">{local.votes}</span>
    </button>
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
  status: "open" | "promoted" | "archived";
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
