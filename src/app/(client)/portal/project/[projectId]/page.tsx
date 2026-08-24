import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClientProject } from "@/lib/data/session";
import { getIntakePack, getMyClientProjects } from "@/lib/data/intake";
import { PageHeader } from "@/components/shell/page-header";
import { IntakeForm } from "@/components/portal/intake-form";

export const metadata: Metadata = { title: "Your input pack" };

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  // The tenant check, once, above everything. The database refuses the rows
  // independently (0072 §4) — this is what turns "no rows" into "that isn't
  // yours" instead of an input pack that mysteriously has no answers in it.
  const ctx = await requireClientProject(projectId);

  // The pack key comes from `my_client_projects()` — a client cannot read
  // `projects`, which is where the column lives (0072 §2 / 0073). So the project
  // lookup has to land BEFORE the pack fetch rather than beside it: one extra
  // round-trip, and the alternative is rendering the wrong questionnaire.
  const projects = await getMyClientProjects(ctx);

  // Guarded above, so this only fires if the project was deleted between the
  // session context being built and this query running.
  const project = projects.find((p) => p.id === projectId);
  if (!project) notFound();

  const pack = await getIntakePack(ctx, projectId, project.intake_pack);

  return (
    <>
      {projects.length > 1 && (
        <Link
          href="/portal"
          className="mb-4 inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Your projects
        </Link>
      )}

      <PageHeader
        title={project.name}
        description="Everything Kagu needs from you to build this, in one place. It saves as you type — you can leave and come back."
      />

      <IntakeForm
        projectId={projectId}
        projectName={project.name}
        pack={pack.pack}
        initialAnswers={pack.answers}
        initialRows={pack.rows}
        initialSubmittedAt={pack.header?.submitted_at ?? null}
      />
    </>
  );
}
