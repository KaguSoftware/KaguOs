import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewRecurringForm } from "@/components/management/finance-forms";
import type { RecurringItem } from "@/lib/types";

export const metadata: Metadata = { title: "Edit recurring item" };

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("management");

  const { data: item } = await ctx.supabase
    .from("recurring_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();

  return (
    <CreatePage title="Edit recurring item">
      <NewRecurringForm item={item as RecurringItem} />
    </CreatePage>
  );
}
