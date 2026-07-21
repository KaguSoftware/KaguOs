import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewTransactionForm } from "@/components/management/finance-forms";

export const metadata: Metadata = { title: "New transaction" };

export default async function NewTransactionPage() {
  const ctx = await requireSection("management");
  const projects = await rowsOrThrow(
    ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("is_demo", ctx.showcase)
      .order("name"),
    "projects"
  );

  return (
    <CreatePage title="New transaction" hint="A one-time payment, in or out.">
      <NewTransactionForm projects={projects} />
    </CreatePage>
  );
}
