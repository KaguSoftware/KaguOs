import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { requireClient } from "@/lib/data/session";
import { getIntakeSummaries, getMyClientProjects } from "@/lib/data/intake";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressMeter } from "@/components/portal/progress-meter";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Your projects" };

export default async function PortalIndexPage() {
  const ctx = await requireClient();

  const projects = await getMyClientProjects(ctx);

  // One project is the normal case, and an index page listing exactly one card
  // is a click that teaches nothing. Straight through to it.
  if (projects.length === 1) redirect(`/portal/project/${projects[0].id}`);

  const summaries = await getIntakeSummaries(
    ctx,
    projects.map((project) => project.id)
  );

  return (
    <>
      <PageHeader
        title="Your projects"
        description="Everything Kagu is building for you, and what we still need from you to build it."
      />

      {projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title="Nothing shared with you yet"
            hint="Your account is set up. As soon as Kagu shares a project with it, it appears here — no need to check back, you'll be told."
          />
        </div>
      ) : (
        <ul className="grid gap-3">
          {projects.map((project) => {
            const summary = summaries.get(project.id);
            const pct = summary?.progress.pct ?? 0;
            const sent = summary?.submittedAt ?? null;
            return (
              <li key={project.id}>
                <Link
                  href={`/portal/project/${project.id}`}
                  className="group block rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-raised/30"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 text-sm font-medium text-ink">{project.name}</p>
                    <p className="flex items-center gap-1.5 font-mono text-xs text-faint">
                      {sent ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-primary-dim" aria-hidden />
                          sent {formatRelative(sent)}
                        </>
                      ) : (
                        <>
                          {pct}% filled in
                          <ArrowRight
                            className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 ease-mac group-hover:translate-x-0 group-hover:opacity-100"
                            aria-hidden
                          />
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-3">
                    <ProgressMeter
                      pct={pct}
                      done={summary?.progress.done ?? 0}
                      total={summary?.progress.total ?? 0}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
