import type { Metadata } from "next";
import { requireSectionWrite } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewExpenseForm } from "@/components/marketing/forms";

export const metadata: Metadata = { title: "Log expense" };

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await requireSectionWrite("marketing");
  const { client } = await searchParams;

  const [clients, campaigns] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("clients")
        .select("id, name")
        .eq("is_demo", ctx.showcase)
        .neq("status", "ended")
        .order("name"),
      "new expense: clients"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("marketing_campaigns")
        .select("id, name, client_id")
        .eq("is_demo", ctx.showcase)
        .neq("status", "done")
        .order("name"),
      "new expense: campaigns"
    ),
  ]);

  return (
    <CreatePage
      title="Log a marketing expense"
      hint="Money spent from pocket — gear, boosts, freelancers. It lands in the company ledger with a marketing tag, so Finance and Budget always agree."
    >
      <NewExpenseForm
        clients={clients as { id: string; name: string }[]}
        campaigns={
          campaigns as { id: string; name: string; client_id: string | null }[]
        }
        defaultClientId={client}
      />
    </CreatePage>
  );
}
