import type { Metadata } from "next";
import { requireSectionWrite } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewExpenseForm } from "@/components/marketing/forms";

export const metadata: Metadata = { title: "Log expense" };

export default async function NewExpensePage() {
  const ctx = await requireSectionWrite("marketing");

  const campaigns = await rowsOrThrow(
    ctx.supabase
      .from("marketing_campaigns")
      .select("id, name")
      .eq("is_demo", ctx.showcase)
      .neq("status", "done")
      .order("name"),
    "new expense: campaigns"
  );

  return (
    <CreatePage
      title="Log a marketing expense"
      hint="Money spent from pocket — gear, boosts, freelancers. It lands in the company ledger with a marketing tag, so Finance and Budget always agree."
    >
      <NewExpenseForm campaigns={campaigns as { id: string; name: string }[]} />
    </CreatePage>
  );
}
