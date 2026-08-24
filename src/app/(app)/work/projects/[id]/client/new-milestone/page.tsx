import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSessionContext, homeFor } from "@/lib/data/session";
import { selectOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewMilestoneForm } from "@/components/work/client-portal-forms";

export const metadata: Metadata = { title: "New milestone" };

/**
 * A step of the build, written for the client.
 *
 * Guarded on `can_write('work') OR can_write('management')` — the same pair of
 * arms the RLS policy carries (0074 §3) and the same pair the action checks. A
 * view-only member shouldn't be handed a form that can't submit, which is what
 * `requireSectionWrite` exists for elsewhere; it takes one section, and this
 * page belongs to two.
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

  const { data: project } = await selectOrThrow(
    ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .eq("is_demo", ctx.showcase)
      .maybeSingle(),
    "project"
  );
  if (!project) notFound();

  return (
    <CreatePage
      title="New milestone"
      hint={`A step of ${project.name} as its client will read it — their words, not the board's.`}
    >
      <NewMilestoneForm projectId={id} />
    </CreatePage>
  );
}
