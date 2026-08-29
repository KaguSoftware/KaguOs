import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSessionContext, homeFor } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewProjectLinkForm } from "@/components/work/client-portal-forms";
import { milestoneTree, type ProjectMilestone } from "@/lib/types";

export const metadata: Metadata = { title: "New link" };

/**
 * Something the client can go and open — a staging site, a TestFlight invite,
 * a design board (0082).
 *
 * Guarded on `can_write('work') OR can_write('management')`, the pair of arms
 * the RLS policy carries and the action re-checks. Same shape as the phase and
 * invoice pages beside it, for the reason given there: this page belongs to two
 * sections, and `requireSectionWrite` takes one.
 *
 * It reads the plan for one reason — the "belongs to" dropdown. A link filed
 * under the system it is a build OF is the difference between "here are six
 * URLs" and "here is your mobile app". Sub-phases are offered too, indented,
 * because a TestFlight build usually belongs to one feature rather than to the
 * whole app.
 */
export default async function NewProjectLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!canWrite(ctx, "work") && !canWrite(ctx, "management")) {
    redirect(homeFor(ctx));
  }

  const [{ data: project }, milestones] = await Promise.all([
    selectOrThrow(
      ctx.supabase
        .from("projects")
        .select("id, name")
        .eq("id", id)
        .eq("is_demo", ctx.showcase)
        .maybeSingle(),
      "project"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("project_milestones")
        .select("id, title, parent_id, sort, created_at")
        .eq("project_id", id)
        .order("sort")
        .order("created_at"),
      "project_milestones"
    ),
  ]);
  if (!project) notFound();

  // `milestoneTree` wants whole rows and only reads three fields off them; the
  // query above selects those three rather than `*`, so the cast is what tells
  // the compiler that. Nothing here touches a column it did not ask for.
  const tree = milestoneTree(milestones as unknown as ProjectMilestone[]);
  const phases = [
    { value: "", label: "The whole project" },
    ...tree.flatMap(({ phase, steps }) => [
      { value: phase.id, label: phase.title },
      ...steps.map((step) => ({ value: step.id, label: `— ${step.title}` })),
    ]),
  ];

  return (
    <CreatePage
      title="New link"
      hint={`Something ${project.name}'s client can open for themselves — the build as it stands, not a description of it.`}
    >
      <NewProjectLinkForm projectId={id} phases={phases} />
    </CreatePage>
  );
}
