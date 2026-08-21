import type { Metadata } from "next";
import { requireSectionWrite } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewClientForm } from "@/components/marketing/forms";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireSectionWrite("marketing");

  return (
    <CreatePage
      title="New client"
      hint="Everything in this section hangs off a client — their posts, their campaigns, their budget."
    >
      <NewClientForm />
    </CreatePage>
  );
}
