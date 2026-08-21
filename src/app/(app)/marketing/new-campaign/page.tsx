import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSectionWrite } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewCampaignForm } from "@/components/marketing/forms";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await requireSectionWrite("marketing");
  const { client } = await searchParams;

  const clients = await rowsOrThrow(
    ctx.supabase
      .from("clients")
      .select("id, name, is_house")
      .eq("is_demo", ctx.showcase)
      .neq("status", "ended")
      .order("name"),
    "new campaign: clients"
  );

  if (clients.length === 0) redirect("/marketing/clients/new");

  return (
    <CreatePage
      title="New campaign"
      hint="A campaign groups the videos that ran together and carries the budget and the goal they ran against."
      wide
    >
      <NewCampaignForm
        clients={clients as { id: string; name: string; is_house: boolean }[]}
        defaultClientId={client}
      />
    </CreatePage>
  );
}
