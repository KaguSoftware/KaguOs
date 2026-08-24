import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Lightbulb, MonitorSmartphone } from "lucide-react";
import { requireSection, canAccess } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getIntakeSummaries } from "@/lib/data/intake";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { LinkButton } from "@/components/ui/link-button";
import { ProgressMeter } from "@/components/portal/progress-meter";
import { EditProjectForm } from "@/components/work/project-form";
import { ProjectActions } from "@/components/work/project-actions";
import { ProjectSecrets } from "@/components/work/project-secrets";
import { formatRelative } from "@/lib/utils";
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
  const [
    { data: project },
    { data: sourceIdea },
    secretRows,
    ideaCountRes,
    clientCountRes,
  ] = await Promise.all([
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
      // The client's input pack, as a number. Rides the same wave as everything
      // else for the reason spelled out above: an extra query inside a wave
      // already in flight costs ~3ms, a second wave costs a round-trip. Skipped
      // entirely in showcase — a demo project has no client and no pack.
      selectOrThrow(
        ctx.supabase
          .from("client_projects")
          .select("user_id", { count: "exact", head: true })
          .eq("project_id", id),
        "client_projects count"
      ),
    ]);
  if (!project) notFound();

  const secrets = (secretRows ?? []) as ProjectSecret[];
  const ideaCount = ideaCountRes.count ?? 0;
  const clientCount = clientCountRes.count ?? 0;

  // A SECOND wave, against this file's own one-wave rule, and deliberately.
  // Which questions this project asks is `intake_pack` on the row above, and
  // the meter's denominator is a property of the pack — computed against the
  // wrong one, the panel would quietly disagree with the intake page it links
  // to. A number that is right one round-trip later beats a number that is
  // wrong immediately. Skipped in showcase and when nobody can fill it in, so
  // most project pages never pay for it at all.
  const intake =
    ctx.showcase || clientCount === 0
      ? null
      : (
          await getIntakeSummaries(ctx, [
            { id, packKey: (project as Project).intake_pack },
          ])
        ).get(id) ?? null;

  return (
    <>
      <Link
        href="/work"
        className="mb-4 inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-muted hover:text-ink"
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
              <span className="font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
                {ideaCount}
              </span>
            )}
          </LinkButton>
        }
      />

      {sourceIdea && (
        <p className="mb-4 flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-faint">
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
        {/* ---- The client's own answers about their business (0072). Sits with
            Details rather than behind a tab: "what did they tell us" is a
            question asked constantly during a build, and a panel that shows how
            much of it is still missing answers it without a click. */}
        {!ctx.showcase && (
          <Panel>
            <PanelHeader
              title="Client input pack"
              action={
                <LinkButton href={`/work/projects/${id}/intake`} variant="outline">
                  <ClipboardList className="size-3.5" aria-hidden />
                  Open
                </LinkButton>
              }
            />
            <div className="px-4 py-3.5">
              {clientCount === 0 ? (
                <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
                  No client account can see this project yet. Create one in Admin
                  and share the project with it — they fill the pack in
                  themselves, and it lands here as they type.
                </p>
              ) : (
                <>
                  <ProgressMeter
                    pct={intake?.progress.pct ?? 0}
                    done={intake?.progress.done ?? 0}
                    total={intake?.progress.total ?? 0}
                    label="Client input pack completion"
                  />
                  <p className="mt-2.5 text-[calc(13px*var(--text-scale,1))] text-muted">
                    {intake?.submittedAt ? (
                      <>
                        <span className="text-primary-dim">
                          Sent {formatRelative(intake.submittedAt)}
                        </span>{" "}
                        · shared with {clientCount}{" "}
                        {clientCount === 1 ? "client account" : "client accounts"}
                      </>
                    ) : (
                      <>
                        Still being filled in · shared with {clientCount}{" "}
                        {clientCount === 1 ? "client account" : "client accounts"}
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </Panel>
        )}
        {/* ---- The mirror of the pack: what WE tell THEM. Next to the input
            panel because the two together are the whole client relationship —
            what they owe us, and what we owe them — and keeping them apart is
            how a project ends up with a filled-in pack and a portal that has
            said nothing since the kickoff call. */}
        {!ctx.showcase && (
          <Panel>
            <PanelHeader
              title="Client view"
              action={
                <LinkButton href={`/work/projects/${id}/client`} variant="outline">
                  <MonitorSmartphone className="size-3.5" aria-hidden />
                  Open
                </LinkButton>
              }
            />
            <div className="px-4 py-3.5">
              <p className="text-[calc(13px*var(--text-scale,1))] text-muted">
                The plan and the invoices this project&apos;s client sees in
                their portal. Milestones stay hidden until you publish them and
                invoices stay hidden while they are drafts, so nothing reaches
                them by accident.
              </p>
            </div>
          </Panel>
        )}
        {canSeeSecrets && (
          <ProjectSecrets projectId={project.id} secrets={secrets} />
        )}
        <ProjectActions projectId={project.id} />
      </div>
    </>
  );
}
