import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWrite, getSessionContext, homeFor } from "@/lib/data/session";
import { selectOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewInvoiceForm } from "@/components/work/client-portal-forms";

export const metadata: Metadata = { title: "New invoice" };

/**
 * One line of the client's statement.
 *
 * Same guard as the milestone page, and for the same reason: publishing to a
 * client needs edit rights on Work OR on Management, because the person who
 * chases a payment is not necessarily on the build team.
 *
 * This is NOT a ledger entry — Kagu's own books stay in `transactions` behind
 * the Management section. What goes here is what the customer is entitled to
 * see (0074 §2).
 */
export default async function NewInvoicePage({
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
      title="New invoice"
      hint={`What ${project.name} has been billed. It stays a draft — invisible to them — until you set it to Sent.`}
    >
      <NewInvoiceForm projectId={id} />
    </CreatePage>
  );
}
