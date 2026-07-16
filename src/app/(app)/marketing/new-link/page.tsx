import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewLinkForm } from "@/components/marketing/bits";

export const metadata: Metadata = { title: "New link" };

export default async function NewLinkPage() {
  await requireSection("marketing");

  return (
    <CreatePage title="New shared link" hint="Assets, dashboards, ad accounts — anything the team needs at hand.">
      <NewLinkForm />
    </CreatePage>
  );
}
