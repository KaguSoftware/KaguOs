import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireClientProject } from "@/lib/data/session";
import { getIntakePack } from "@/lib/data/intake";
import { loadPortal } from "@/lib/data/portal";
import { PageHeader } from "@/components/shell/page-header";
import { BusinessTabs } from "@/components/portal/bits";
import { IntakeForm } from "@/components/portal/intake-form";

export const metadata: Metadata = { title: "Your input pack" };

/**
 * One business's input pack.
 *
 * The FORM below is untouched by the portal's restructuring — it is the thing
 * the client actually has to fill in, it saves on blur, and its questions come
 * from whichever pack the project is on (0073). Everything this page adds is
 * around it: the heading, and a way to get to the other business's pack without
 * going back to a list.
 */
export default async function PortalInputsPage({
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
  //
  // It costs nothing here — the layout above has already loaded it, and
  // loadPortal() is cache()d per request.
  const portal = await loadPortal();

  // Guarded above, so this only fires if the project was deleted between the
  // session context being built and this query running.
  const project = portal.projects.find((p) => p.id === projectId);
  if (!project) notFound();

  const pack = await getIntakePack(ctx, projectId, project.intake_pack);

  return (
    <>
      <BusinessTabs
        businesses={portal.projects}
        activeId={projectId}
        hrefFor={(id) => `/portal/inputs/${id}`}
      />

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
