import type { Metadata } from "next";
import { Megaphone, Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { CampaignRow } from "@/components/marketing/bits";
import { MARKETING_TABS } from "@/components/marketing/tabs";
import type { MarketingCampaign } from "@/lib/types";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const ctx = await requireSection("marketing");

  const { data: campaigns } = await ctx.supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (campaigns ?? []) as MarketingCampaign[];
  const statusOrder = { running: 0, planned: 1, idea: 2, done: 3 } as const;
  rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return (
    <>
      <PageHeader
        title="Kagu Marketing"
        description="Digital marketing — campaigns, content, and shared links."
        action={
          <LinkButton href="/marketing/new-campaign">
            <Plus className="size-3.5" aria-hidden />
            New campaign
          </LinkButton>
        }
      />
      <SectionTabs active="campaigns" tabs={MARKETING_TABS} />

      <div className="rounded-lg border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            hint="Track every marketing push here — channel, dates, budget, status."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
