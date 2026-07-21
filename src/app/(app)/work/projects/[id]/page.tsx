import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { requireSection, canAccess } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { LinkButton } from "@/components/ui/link-button";
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

  // Credentials are visible to Work members (builders own their projects).
  const canSeeSecrets = canAccess(ctx, "work");

  // All three ride ONE wave. The secrets query looks like it belongs after the
  // project lookup, but it filters on `id` from the URL and its gate is a plain
  // synchronous check on ctx — so it never needed the project row, and awaiting
  // it separately cost a full round-trip on every project page. Firing it up
  // front is free even when the project turns out not to exist: an extra query
  // inside a wave that's already in flight costs ~3ms, while a second wave
  // costs ~305ms.
  const [{ data: project }, { data: sourceIdea }, secretRows, ideaCountRes] =
    await Promise.all([
      // Gate the project itself on the demo/real split: in showcase mode a real
      // project id resolves to nothing (→ notFound below), so no real project —
      // and none of its real secrets — can ever render in a client demo.
      selectOrThrow(
        ctx.supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .eq("is_demo", ctx.showcase)
          .maybeSingle(),
        "project"
      ),
      selectOrThrow(
        ctx.supabase
          .from("ideas")
          .select("id, title")
          .eq("promoted_project_id", id)
          .eq("is_demo", ctx.showcase)
          .maybeSingle(),
        "source idea"
      ),
      canSeeSecrets
        ? rowsOrThrow(
            ctx.supabase
              .from("project_secrets")
              .select("*")
              .eq("project_id", id)
              .eq("is_demo", ctx.showcase)
              .order("created_at", { ascending: true }),
            "project_secrets"
          )
        : null,
      // Head-only count for the Ideas button — the rows themselves live on
      // /ideas, so this page only needs the number.
      selectOrThrow(
        ctx.supabase
          .from("ideas")
          .select("id", { count: "exact", head: true })
          .eq("project_id", id)
          .eq("is_demo", ctx.showcase),
        "project idea count"
      ),
    ]);
  if (!project) notFound();

  const secrets = (secretRows ?? []) as ProjectSecret[];
  const ideaCount = ideaCountRes.count ?? 0;

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
        action={
          <LinkButton href={`/work/projects/${id}/ideas`} variant="outline">
            <Lightbulb className="size-3.5" aria-hidden />
            Ideas
            {/* The count only appears once there's something to see — a "0"
                next to every project's button is noise, not information. */}
            {ideaCount > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-faint">
                {ideaCount}
              </span>
            )}
          </LinkButton>
        }
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
