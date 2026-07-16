import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { MarketingWorkspace } from "@/components/marketing/workspace";
import type {
  MarketingCampaign,
  MarketingItem,
  MarketingPost,
} from "@/lib/types";

export const metadata: Metadata = { title: "Marketing" };

const STATUS_ORDER = { running: 0, planned: 1, idea: 2, done: 3 } as const;

export default async function MarketingPage() {
  const ctx = await requireSection("marketing");

  const [{ data: campaigns }, { data: posts }, { data: links }, members] =
    await Promise.all([
      ctx.supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("created_at", { ascending: false }),
      ctx.supabase
        .from("marketing_posts")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("publish_on", { ascending: true, nullsFirst: false }),
      ctx.supabase
        .from("marketing_items")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("created_at", { ascending: false }),
      getMembersMap(ctx.supabase),
    ]);

  const campaignRows = (campaigns ?? []) as MarketingCampaign[];
  campaignRows.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  const campaignNames: Record<string, string> = {};
  for (const c of campaignRows) campaignNames[c.id] = c.name;

  return (
    <Suspense>
      <MarketingWorkspace
        campaigns={campaignRows}
        posts={(posts ?? []) as MarketingPost[]}
        links={(links ?? []) as MarketingItem[]}
        members={members}
        campaignNames={campaignNames}
      />
    </Suspense>
  );
}
