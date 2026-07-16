import type { Metadata } from "next";
import { Link2, Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { LinkRow } from "@/components/marketing/bits";
import { MARKETING_TABS } from "@/components/marketing/tabs";
import type { MarketingItem } from "@/lib/types";

export const metadata: Metadata = { title: "Marketing links" };

export default async function MarketingLinksPage() {
  const ctx = await requireSection("marketing");

  const { data: items } = await ctx.supabase
    .from("marketing_items")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (items ?? []) as MarketingItem[];

  return (
    <>
      <PageHeader
        title="Kagu Marketing"
        description="Digital marketing — campaigns, content, and shared links."
        action={
          <LinkButton href="/marketing/new-link">
            <Plus className="size-3.5" aria-hidden />
            New link
          </LinkButton>
        }
      />
      <SectionTabs active="links" tabs={MARKETING_TABS} />

      <div className="rounded-lg border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No shared links yet"
            hint="Brand assets, analytics dashboards, ad accounts — keep them here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((item) => (
              <LinkRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
