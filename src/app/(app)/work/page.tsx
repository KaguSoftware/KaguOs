import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { LinkButton } from "@/components/ui/link-button";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { IdeasPanel, ProjectsPanel, type IdeaRow } from "@/components/work/panels";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "Work" };

export default async function WorkPage() {
  const ctx = await requireSection("work");

  const [{ data: projects }, { data: ideas }, members] = await Promise.all([
    ctx.supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    ctx.supabase
      .from("ideas")
      .select(
        "id, title, status, created_by, created_at, idea_votes(user_id), idea_comments(count)"
      )
      .order("created_at", { ascending: false }),
    getMembersMap(ctx.supabase),
  ]);

  const projectRows = (projects ?? []) as Project[];
  const ideaRows = ((ideas ?? []) as IdeaRow[]).sort((a, b) => {
    const openFirst = Number(a.status !== "open") - Number(b.status !== "open");
    return openFirst || b.idea_votes.length - a.idea_votes.length;
  });

  return (
    <Suspense>
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
            content: <ProjectsPanel projects={projectRows} />,
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
