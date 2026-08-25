import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSessionContext, homeFor } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewMilestoneForm } from "@/components/work/client-portal-forms";

export const metadata: Metadata = { title: "New phase" };

/**
 * A phase of the build, written for the client.
 *
 * Guarded on `can_write('work') OR can_write('management')` — the same pair of
 * arms the RLS policy carries (0074 §3) and the same pair the action checks. A
 * view-only member shouldn't be handed a form that can't submit, which is what
 * `requireSectionWrite` exists for elsewhere; it takes one section, and this
 * page belongs to two.
 *
 * It reads the existing weights for one reason: to open the weight field on
 * whatever share of the project is still unallocated. That default is what
 * makes a plan add up to 100% by accident rather than by arithmetic.
 */
export default async function NewMilestonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!canWrite(ctx, "work") && !canWrite(ctx, "management")) {
    redirect(homeFor(ctx));
  }

  const [{ data: project }, siblings] = await Promise.all([
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
      ctx.supabase.from("project_milestones").select("weight").eq("project_id", id),
      "project_milestones"
    ),
  ]);
  if (!project) notFound();

  const allocated =
    Math.round(
      siblings.reduce((sum, row) => sum + (Number(row.weight) || 0), 0) * 100
    ) / 100;

  return (
    <CreatePage
      title="New phase"
      hint={`A phase of ${project.name} as its client will read it — their words, not the board's.`}
    >
      <NewMilestoneForm
        projectId={id}
        allocated={allocated}
        suggestedWeight={Math.max(0, Math.round((100 - allocated) * 100) / 100)}
      />
    </CreatePage>
  );
}
