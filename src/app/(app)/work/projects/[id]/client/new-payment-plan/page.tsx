import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSessionContext, homeFor } from "@/lib/data/session";
import { selectOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewPaymentPlanForm } from "@/components/work/client-portal-forms";
import { todayInIstanbul } from "@/lib/utils";

export const metadata: Metadata = { title: "New payment plan" };

/**
 * The agreement, before any of the invoices exist.
 *
 * Guarded on `can_write('work') OR can_write('management')` — the same pair of
 * arms the RLS policy carries (0075 §2c) and the same pair the action checks. A
 * view-only member shouldn't be handed a form that can't submit.
 *
 * `wide` because this surface is a builder: two ways of stating the amount, a
 * cadence, a count, and a live preview of the schedule it all adds up to. The
 * narrow column those fields would otherwise sit in makes the preview — the
 * whole reason the page exists — something you scroll to rather than watch.
 */
export default async function NewPaymentPlanPage({
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
      wide
      title="New payment plan"
      hint={`How ${project.name} pays — a fee in instalments, or a retainer. Saving lays the payments out, dated, so nobody works them out again each month.`}
    >
      <NewPaymentPlanForm projectId={id} today={todayInIstanbul()} />
    </CreatePage>
  );
}
