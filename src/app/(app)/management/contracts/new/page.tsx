import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewContractForm } from "@/components/management/contract-bits";

export const metadata: Metadata = { title: "New contract" };

export default async function NewContractPage() {
  await requireSection("management");

  return (
    <CreatePage
      title="New contract"
      hint="You'll attach the PDF on the contract page after creating it."
    >
      <NewContractForm />
    </CreatePage>
  );
}
