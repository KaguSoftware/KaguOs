import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewTransactionForm } from "@/components/management/finance-forms";
import type { Transaction } from "@/lib/types";

export const metadata: Metadata = { title: "Edit transaction" };

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("management");

  const [{ data: transaction }, { data: projects }] = await Promise.all([
    ctx.supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
    ctx.supabase.from("projects").select("id, name").order("name"),
  ]);
  if (!transaction) notFound();

  return (
    <CreatePage title="Edit transaction">
      <NewTransactionForm
        projects={projects ?? []}
        transaction={transaction as Transaction}
      />
    </CreatePage>
  );
}
