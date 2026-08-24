import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import {
  getProjectInvoices,
  getProjectMilestones,
  invoiceTotals,
  milestoneProgress,
} from "@/lib/data/portal";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Money, Stat } from "@/components/portal/bits";
import {
  InvoicesPanel,
  MilestonesPanel,
} from "@/components/work/client-portal-editor";
import { todayInIstanbul } from "@/lib/utils";

export const metadata: Metadata = { title: "Client view" };

/**
 * The other side of the client portal: what this project's client is being
 * told, and the one place to change it.
 *
 * ── Why it is a page and not a panel on the project ────────────────────────
 *
 * Because everything on it is addressed to somebody outside the company, and
 * that deserves its own frame. A milestone written next to the repo url gets
 * written in the register you use with colleagues; a page whose heading says
 * "this is what the client reads" gets written in the register you use with a
 * customer. The distance is the point.
 *
 * ── Access ─────────────────────────────────────────────────────────────────
 *
 * Reading needs Work membership (this route lives inside it). WRITING needs
 * edit rights on Work OR on Management, which is the same pair of arms the RLS
 * policy carries (0074 §3) — the finance person who chases payments is not
 * necessarily on the Work team. A member with neither sees the page read-only,
 * so nothing is hidden from them; the actions refuse the write and say why.
 */
export default async function ProjectClientViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("work");

  const [{ data: project }, holders, milestones, invoices] = await Promise.all([
    selectOrThrow(
      ctx.supabase
        .from("projects")
        .select("id, name, client")
        .eq("id", id)
        .eq("is_demo", ctx.showcase)
        .maybeSingle(),
      "project"
    ),
    // ⚠️ The relationship is NAMED, not inferred. `client_projects` has two
    // foreign keys into `profiles` — `user_id` and `created_by` — so a bare
    // embed is ambiguous and PostgREST refuses the whole request with PGRST201
    // at runtime only. Same shape as the intake page's query, for the same
    // reason.
    rowsOrThrow(
      ctx.supabase
        .from("client_projects")
        .select(
          "user_id, profiles!client_projects_user_id_fkey!inner(full_name, email, kind)"
        )
        .eq("project_id", id)
        .eq("profiles.kind", "client"),
      "client_projects"
    ),
    getProjectMilestones(ctx, [id]),
    getProjectInvoices(ctx, [id]),
  ]);
  if (!project) notFound();

  const today = todayInIstanbul();
  const build = milestoneProgress(milestones.filter((m) => m.visible_to_client));
  const totals = invoiceTotals(invoices, today);
  const canEdit = canWrite(ctx, "work") || canWrite(ctx, "management");

  const people = holders.map((row) => {
    const profile = row.profiles as unknown as {
      full_name: string | null;
      email: string;
    };
    return profile.full_name || profile.email;
  });

  return (
    <>
      <LiveRefresh tables={["project_milestones", "project_invoices"]} />

      <Link
        href={`/work/projects/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {project.name}
      </Link>

      <PageHeader
        title="Client view"
        description="What this project's client sees in their portal — the plan and the statement. Everything here is written for them, not for us."
      />

      <p className="mb-6 flex flex-wrap items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-faint">
        <UserRound className="size-3.5" aria-hidden />
        {people.length === 0 ? (
          <>
            Nobody has a login for this yet — create a client account in{" "}
            <Link
              href="/admin"
              className="text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Admin
            </Link>{" "}
            and share this project with it. Until then everything below is
            written for an audience of nobody.
          </>
        ) : (
          <>Seen by {people.join(", ")}</>
        )}
      </p>

      {/* The two numbers the client is looking at, so a producer can see what
          the portal is currently telling them without opening it. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Build progress"
          note={
            build.total === 0
              ? "No published milestones"
              : build.next
                ? `Next: ${build.next.title}`
                : "Everything published is done"
          }
        >
          <span className="font-mono text-[calc(22px*var(--text-scale,1))] font-medium tabular-nums text-ink">
            {build.pct}%
          </span>
        </Stat>
        <Stat
          label="Outstanding"
          note={totals.overdueCount > 0 ? `${totals.overdueCount} past due` : undefined}
          tone={totals.overdueCount > 0 ? "danger" : undefined}
        >
          <Money bucket={totals.outstanding} size="lg" />
        </Stat>
        <Stat label="Paid to date">
          <Money bucket={totals.paid} size="lg" tone="muted" />
        </Stat>
      </div>

      {!canEdit && (
        <p className="mb-6 rounded-md border border-line bg-surface px-4 py-3 text-[calc(13px*var(--text-scale,1))] text-muted">
          You have view-only access here. Publishing to a client needs edit
          rights on Work or Management.
        </p>
      )}

      <div className="grid gap-6">
        <MilestonesPanel projectId={id} milestones={milestones} />
        <InvoicesPanel projectId={id} invoices={invoices} />
      </div>
    </>
  );
}
