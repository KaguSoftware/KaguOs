import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClientProject } from "@/lib/data/session";
import { getIntakePack, getMyClientProjects } from "@/lib/data/intake";
import { IntakeForm } from "@/components/portal/intake-form";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

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
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dict(locale);

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
          className="mb-4 inline-flex items-center gap-1.5 text-[calc(14px*var(--text-scale,1))] text-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {t.yourProjects}
        </Link>
      )}

      {/* The page header the other portal pages use is deliberately absent: the
          form owns its own sticky header, which has to carry the project name,
          the meter and the save state together. Two stacked headers competing
          for the top of a long form was part of what made this hard to read. */}
      <IntakeForm
        projectId={projectId}
        projectName={project.name}
        pack={pack.pack}
        initialAnswers={pack.answers}
        initialRows={pack.rows}
        initialSubmittedAt={pack.header?.submitted_at ?? null}
        locale={locale}
        intro={t.packBlurb}
      />
    </>
  );
}
