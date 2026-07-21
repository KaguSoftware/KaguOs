import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { LinkButton } from "@/components/ui/link-button";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { IdeasPanel, ProjectsPanel, type IdeaRow } from "@/components/work/panels";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "Work" };

export default async function WorkPage() {
  const ctx = await requireSection("work");

  const [projects, ideas, members] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("projects")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("updated_at", { ascending: false }),
      "projects"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("ideas")
        .select(
          "id, title, status, sector, type, required_count, created_by, created_at, idea_votes(user_id, value), idea_comments(count)"
        )
        .eq("is_demo", ctx.showcase)
        // Company ideas only. A project-scoped idea is a suggestion about work
        // that already exists; showing it here would put it in the queue to
        // BECOME a project, which it can never do (see maybeAutoPromote).
        .is("project_id", null)
        .order("created_at", { ascending: false }),
      "ideas"
    ),
    getMembersMap(ctx.supabase),
  ]);

  const netScore = (row: IdeaRow) =>
    row.idea_votes.reduce((sum, v) => sum + v.value, 0);

  const projectRows = projects as Project[];
  const ideaRows = (ideas as IdeaRow[]).sort((a, b) => {
    const openFirst = Number(a.status !== "open") - Number(b.status !== "open");
    return openFirst || netScore(b) - netScore(a);
  });

  return (
    <Suspense>
      <LiveRefresh tables={["projects", "ideas"]} />
      <TabbedPanels
        title="Kagu Work"
        description="Projects and new ideas."
        ariaLabel="Work subsections"
        panels={[
          {
            key: "projects",
            label: "Projects",
            action: (
              <LinkButton href="/work/projects/new">
                <Plus className="size-3.5" aria-hidden />
                New project
              </LinkButton>
            ),
            content: (
              <ProjectsPanel projects={projectRows} currentUserId={ctx.userId} />
            ),
          },
          {
            key: "ideas",
            label: "Ideas",
            action: (
              <LinkButton href="/work/ideas/new">
                <Plus className="size-3.5" aria-hidden />
                New idea
              </LinkButton>
            ),
            content: (
              <IdeasPanel
                ideas={ideaRows}
                members={members}
                currentUserId={ctx.userId}
              />
            ),
          },
        ]}
      />
    </Suspense>
  );
}
