import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb, MessageSquare, Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { VoteButton } from "@/components/work/idea-bits";
import { formatDate } from "@/lib/utils";
import type { IdeaStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Ideas" };

const STATUS_TONE: Record<IdeaStatus, BadgeTone> = {
  open: "neutral",
  promoted: "green",
  archived: "faint",
};

type IdeaRow = {
  id: string;
  title: string;
  status: IdeaStatus;
  created_by: string | null;
  created_at: string;
  idea_votes: { user_id: string }[];
  idea_comments: { count: number }[];
};

export default async function IdeasPage() {
  const ctx = await requireSection("work");

  const [{ data: ideas }, members] = await Promise.all([
    ctx.supabase
      .from("ideas")
      .select("id, title, status, created_by, created_at, idea_votes(user_id), idea_comments(count)")
      .order("created_at", { ascending: false }),
    getMembersMap(ctx.supabase),
  ]);

  const rows = ((ideas ?? []) as IdeaRow[]).sort((a, b) => {
    const openFirst = Number(a.status !== "open") - Number(b.status !== "open");
    return openFirst || b.idea_votes.length - a.idea_votes.length;
  });

  return (
    <>
      <PageHeader
        title="Kagu Work"
        description="Projects and new ideas."
        action={
          <LinkButton href="/work/ideas/new">
            <Plus className="size-3.5" aria-hidden />
            New idea
          </LinkButton>
        }
      />
      <SectionTabs
        active="ideas"
        tabs={[
          { key: "projects", href: "/work", label: "Projects" },
          { key: "ideas", href: "/work/ideas", label: "Ideas" },
        ]}
      />

      <div className="rounded-lg border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas yet"
            hint="Post the first one — teammates vote, discuss, and the good ones become projects."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((idea) => (
              <li key={idea.id} className="flex items-center gap-4 px-4 py-3">
                <VoteButton
                  ideaId={idea.id}
                  votes={idea.idea_votes.length}
                  voted={idea.idea_votes.some((v) => v.user_id === ctx.userId)}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/work/ideas/${idea.id}`}
                    className="text-sm font-medium text-ink hover:text-primary-dim"
                  >
                    {idea.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-faint">
                    {formatDate(idea.created_at)}
                    {idea.created_by && members[idea.created_by] && (
                      <>
                        {" · by "}
                        <span style={{ color: members[idea.created_by].color }}>
                          {members[idea.created_by].name}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-faint">
                  <MessageSquare className="size-3.5" aria-hidden />
                  {idea.idea_comments[0]?.count ?? 0}
                </span>
                <Badge tone={STATUS_TONE[idea.status]}>{idea.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
