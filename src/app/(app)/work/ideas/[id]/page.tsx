import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  CommentForm,
  DeleteCommentButton,
  EditableIdeaBody,
  IdeaActions,
  VoteButton,
} from "@/components/work/idea-bits";
import { formatDate } from "@/lib/utils";
import type { IdeaComment, IdeaStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Idea" };

const STATUS_TONE: Record<IdeaStatus, BadgeTone> = {
  open: "neutral",
  promoted: "green",
  archived: "faint",
};

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("work");

  const [{ data: idea }, { data: comments }, { data: votes }, members] =
    await Promise.all([
      ctx.supabase.from("ideas").select("*").eq("id", id).maybeSingle(),
      ctx.supabase
        .from("idea_comments")
        .select("*")
        .eq("idea_id", id)
        .order("created_at"),
      ctx.supabase.from("idea_votes").select("user_id").eq("idea_id", id),
      getMembersMap(ctx.supabase),
    ]);
  if (!idea) notFound();

  const voteList = votes ?? [];
  const commentList = (comments ?? []) as IdeaComment[];

  return (
    <>
      <Link
        href="/work?tab=ideas"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All ideas
      </Link>
      <PageHeader
        title={idea.title}
        description={formatDate(idea.created_at)}
        action={
          <VoteButton
            ideaId={idea.id}
            votes={voteList.length}
            voted={voteList.some((v) => v.user_id === ctx.userId)}
          />
        }
      />

      <div className="grid max-w-3xl gap-6">
        <div className="flex items-center gap-3">
          <Badge tone={STATUS_TONE[idea.status as IdeaStatus]}>{idea.status}</Badge>
          {idea.created_by && members[idea.created_by] && (
            <span className="text-[13px] text-faint">
              by{" "}
              <span style={{ color: members[idea.created_by].color }}>
                {members[idea.created_by].name}
              </span>
            </span>
          )}
          {idea.status === "promoted" && idea.promoted_project_id && (
            <Link
              href={`/work/projects/${idea.promoted_project_id}`}
              className="text-[13px] text-primary-dim underline-offset-2 hover:underline"
            >
              View the project it became
            </Link>
          )}
        </div>

        <EditableIdeaBody
          ideaId={idea.id}
          title={idea.title}
          body={idea.body}
          canEdit={
            idea.status !== "promoted" &&
            (ctx.isAdmin || idea.created_by === ctx.userId)
          }
        />

        <IdeaActions
          ideaId={idea.id}
          status={idea.status as IdeaStatus}
          canDelete={ctx.isAdmin || idea.created_by === ctx.userId}
        />

        <Panel>
          <PanelHeader title={`Discussion (${commentList.length})`} />
          <div className="space-y-4 p-4">
            {commentList.length === 0 && (
              <p className="text-[13px] text-faint">No comments yet — start the discussion.</p>
            )}
            {commentList.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-faint">
                    <span
                      style={{
                        color: comment.created_by
                          ? members[comment.created_by]?.color
                          : undefined,
                      }}
                      className="font-medium"
                    >
                      {comment.created_by && members[comment.created_by]
                        ? members[comment.created_by].name
                        : "Someone"}
                    </span>{" "}
                    · {formatDate(comment.created_at)}
                  </p>
                  <p className="mt-1 max-w-[70ch] whitespace-pre-wrap text-sm text-ink">
                    {comment.body}
                  </p>
                </div>
                {(ctx.isAdmin || comment.created_by === ctx.userId) && (
                  <DeleteCommentButton commentId={comment.id} ideaId={idea.id} />
                )}
              </div>
            ))}
            <CommentForm ideaId={idea.id} />
          </div>
        </Panel>
      </div>
    </>
  );
}
