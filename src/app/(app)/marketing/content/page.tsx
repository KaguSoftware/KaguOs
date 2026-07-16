import type { Metadata } from "next";
import { CalendarDays, Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PostRow } from "@/components/marketing/bits";
import { MARKETING_TABS } from "@/components/marketing/tabs";
import type { MarketingPost } from "@/lib/types";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage() {
  const ctx = await requireSection("marketing");

  const [{ data: posts }, { data: campaigns }, members] = await Promise.all([
    ctx.supabase
      .from("marketing_posts")
      .select("*")
      .order("publish_on", { ascending: true, nullsFirst: false }),
    ctx.supabase.from("marketing_campaigns").select("id, name"),
    getMembersMap(ctx.supabase),
  ]);

  const campaignNames: Record<string, string> = {};
  for (const c of campaigns ?? []) campaignNames[c.id] = c.name;

  const rows = (posts ?? []) as MarketingPost[];

  return (
    <>
      <PageHeader
        title="Kagu Marketing"
        description="Digital marketing — campaigns, content, and shared links."
        action={
          <LinkButton href="/marketing/new-post">
            <Plus className="size-3.5" aria-hidden />
            New post
          </LinkButton>
        }
      />
      <SectionTabs active="content" tabs={MARKETING_TABS} />

      <div className="rounded-lg border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="The content calendar is empty"
            hint="Plan posts per channel with a publish date and an owner."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                members={members}
                campaignName={
                  post.campaign_id ? (campaignNames[post.campaign_id] ?? null) : null
                }
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
