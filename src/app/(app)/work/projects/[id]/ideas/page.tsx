import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { PageHeader } from "@/components/shell/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { ProjectIdeas } from "@/components/work/project-ideas";
import type { ProjectIdeaRow } from "@/lib/types";

export const metadata: Metadata = { title: "Project ideas" };

export default async function ProjectIdeasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("work");

  // One wave. The ideas query filters on the URL id and doesn't need the
  // project row first, so awaiting it separately would cost a round-trip for
  // nothing — same reasoning as the project detail page.
  const [{ data: project }, { data: ideas }, members] = await Promise.all([
    ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .eq("is_demo", ctx.showcase)
      .maybeSingle(),
    ctx.supabase
      .from("ideas")
      .select(
        "id, title, created_by, created_at, idea_votes(user_id, value), idea_comments(count)"
      )
      .eq("project_id", id)
      .eq("is_demo", ctx.showcase)
      .order("created_at", { ascending: false }),
    getMembersMap(ctx.supabase),
  ]);
  if (!project) notFound();

  return (
    <>
      <LiveRefresh tables={["ideas", "idea_votes"]} />
      <Link
        href={`/work/projects/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {project.name}
      </Link>
      <PageHeader
        title="Ideas"
        description={`Suggestions for ${project.name} — features, names, anything worth changing.`}
        action={
          <LinkButton href={`/work/projects/${id}/ideas/new`}>
            <Plus className="size-3.5" aria-hidden />
            New idea
          </LinkButton>
        }
      />

      <div className="max-w-3xl">
        <ProjectIdeas
          projectId={id}
          ideas={(ideas ?? []) as ProjectIdeaRow[]}
          members={members}
          currentUserId={ctx.userId}
        />
      </div>
    </>
  );
}
