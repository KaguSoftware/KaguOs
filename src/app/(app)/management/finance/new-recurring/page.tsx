import type { Metadata } from "next";
import { requireSectionWrite } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewRecurringForm } from "@/components/management/finance-forms";

export const metadata: Metadata = { title: "New recurring item" };

export default async function NewRecurringPage() {
  await requireSectionWrite("management");

  return (
    <CreatePage
      title="New recurring item"
      hint="A subscription you pay or a retainer that comes in — monthly or yearly."
    >
      <NewRecurringForm />
    </CreatePage>
  );
}
