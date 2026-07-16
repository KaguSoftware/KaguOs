import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewCampaignForm } from "@/components/marketing/bits";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  await requireSection("marketing");

  return (
    <CreatePage title="New campaign" hint="A marketing push on one channel — ads, a launch, an SEO sprint.">
      <NewCampaignForm />
    </CreatePage>
  );
}
