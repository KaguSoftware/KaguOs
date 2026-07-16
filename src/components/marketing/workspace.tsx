"use client";

import { useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Link2, Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";
import { CampaignRow, LinkRow, PostRow } from "@/components/marketing/bits";
import type {
  MarketingCampaign,
  MarketingItem,
  MarketingPost,
  MembersMap,
} from "@/lib/types";

type TabKey = "campaigns" | "content" | "links";

const TABS: { key: TabKey; label: string }[] = [
  { key: "campaigns", label: "Campaigns" },
  { key: "content", label: "Content" },
  { key: "links", label: "Links" },
];

const ACTIONS: Record<TabKey, { href: string; label: string }> = {
  campaigns: { href: "/marketing/new-campaign", label: "New campaign" },
  content: { href: "/marketing/new-post", label: "New post" },
  links: { href: "/marketing/new-link", label: "New link" },
};

export function MarketingWorkspace({
  campaigns,
  posts,
  links,
  members,
  campaignNames,
}: {
  campaigns: MarketingCampaign[];
  posts: MarketingPost[];
  links: MarketingItem[];
  members: MembersMap;
  campaignNames: Record<string, string>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get("tab");
  const initial: TabKey =
    raw === "content" || raw === "links" ? raw : "campaigns";
  const [active, setActive] = useState<TabKey>(initial);

  const select = useCallback(
    (key: TabKey) => {
      setActive(key);
      // Reflect the tab in the URL for refresh / deep-links, but never
      // navigate — the switch is pure client state, so it's instant.
      const query = key === "campaigns" ? "" : `?tab=${key}`;
      window.history.replaceState(null, "", `${pathname}${query}`);
    },
    [pathname]
  );

  const action = ACTIONS[active];

  return (
    <>
      <PageHeader
        title="Kagu Marketing"
        description="Digital marketing — campaigns, content, and shared links."
        action={
          <LinkButton href={action.href}>
            <Plus className="size-3.5" aria-hidden />
            {action.label}
          </LinkButton>
        }
      />

      <div
        role="tablist"
        aria-label="Marketing subsections"
        className="mb-5 flex gap-1 border-b border-line"
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(tab.key)}
              className={cn(
                "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors duration-150",
                selected
                  ? "border-primary-dim font-medium text-ink"
                  : "border-transparent text-muted hover:border-line-strong hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-line bg-surface">
        {active === "campaigns" &&
          (campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              hint="Track every marketing push here — channel, dates, budget, status."
            />
          ) : (
            <ul className="divide-y divide-line">
              {campaigns.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} />
              ))}
            </ul>
          ))}

        {active === "content" &&
          (posts.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="The content calendar is empty"
              hint="Plan posts per channel with a publish date and an owner."
            />
          ) : (
            <ul className="divide-y divide-line">
              {posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  members={members}
                  campaignName={
                    post.campaign_id
                      ? (campaignNames[post.campaign_id] ?? null)
                      : null
                  }
                />
              ))}
            </ul>
          ))}

        {active === "links" &&
          (links.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No shared links yet"
              hint="Brand assets, analytics dashboards, ad accounts — keep them here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {links.map((item) => (
                <LinkRow key={item.id} item={item} />
              ))}
            </ul>
          ))}
      </div>
    </>
  );
}
