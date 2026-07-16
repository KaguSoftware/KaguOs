import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { requireSection, canAccess } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EditProjectForm } from "@/components/work/project-form";
import { ProjectActions } from "@/components/work/project-actions";
import { ProjectSecrets } from "@/components/work/project-secrets";
import type { Project, ProjectSecret } from "@/lib/types";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("work");

  const [{ data: project }, { data: sourceIdea }] = await Promise.all([
    ctx.supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    ctx.supabase
      .from("ideas")
      .select("id, title")
      .eq("promoted_project_id", id)
      .maybeSingle(),
  ]);
  if (!project) notFound();

  // Credentials are Management-only — fetch them just for those users.
  const canSeeSecrets = canAccess(ctx, "management");
  const secrets = canSeeSecrets
    ? (((
        await ctx.supabase
          .from("project_secrets")
          .select("*")
          .eq("project_id", id)
          .order("created_at", { ascending: true })
      ).data ?? []) as ProjectSecret[])
    : [];

  return (
    <>
      <Link
        href="/work"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All projects
      </Link>
      <PageHeader
        title={project.name}
        description={project.client ? `Client: ${project.client}` : "Internal project"}
      />

      {sourceIdea && (
        <p className="mb-4 flex items-center gap-1.5 text-[13px] text-faint">
          <Lightbulb className="size-3.5 text-amber" aria-hidden />
          Born from the idea{" "}
          <Link
            href={`/work/ideas/${sourceIdea.id}`}
            className="text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {sourceIdea.title}
          </Link>
        </p>
      )}

      <div className="grid max-w-3xl gap-6">
        <Panel>
          <PanelHeader title="Details" />
          <EditProjectForm project={project as Project} />
        </Panel>
        {canSeeSecrets && (
          <ProjectSecrets projectId={project.id} secrets={secrets} />
        )}
        <ProjectActions projectId={project.id} />
      </div>
    </>
  );
}
