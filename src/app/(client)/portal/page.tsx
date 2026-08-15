import type { Metadata } from "next";
import { ExternalLink, PartyPopper } from "lucide-react";
import { requireClient } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ReviewThread } from "@/components/marketing/review-thread";
import { CLIENT_VISIBLE_STATUSES } from "@/lib/creatives";
import { formatDate } from "@/lib/utils";
import type { ClientUser, Creative, CreativeReview } from "@/lib/types";

export const metadata: Metadata = { title: "Your videos" };

/**
 * THE CLIENT PORTAL — two questions, and deliberately no third.
 *
 *   1. What's waiting on you?
 *   2. What's live?
 *
 * The obvious temptation is to build the reporting portal at the same time:
 * spend, reach, cost per lead, a chart. That doubles the surface area of the
 * thing a non-Kagu person can reach, doubles what has to be right about the
 * tenant filter, and has zero effect on the actual bottleneck, which is getting
 * videos approved and out the door. Reporting is a later phase and possibly a
 * later panel. (MARKETING.md D5.)
 *
 * Everything a client can see here is enforced twice: the RLS policy on
 * `creatives` (0063) restricts them to their own tenant AND to the five
 * statuses from `client_review` onwards, and the queries below filter again.
 * The database is the guarantee; the filter is so the page does not ask for
 * rows it will not get.
 */
export default async function PortalPage() {
  const ctx = await requireClient();

  const [{ data: membership }, creatives, reviews] = await Promise.all([
    selectOrThrow(
      ctx.supabase
        .from("client_users")
        .select("role")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      "portal: role"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("creatives")
        .select("*")
        .eq("client_id", ctx.clientId)
        // Redundant against the RLS policy, and deliberately so: the policy is
        // the guarantee, this is the same rule stated where a reader of this
        // page can see it. If the two ever disagree the database wins, which is
        // the safe direction.
        .in("status", CLIENT_VISIBLE_STATUSES)
        .order("updated_at", { ascending: false }),
      "portal: creatives"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("creative_reviews")
        .select("*")
        .eq("client_id", ctx.clientId)
        .order("created_at", { ascending: true }),
      "portal: reviews"
    ),
  ]);

  // A viewer sees everything an approver sees and decides nothing. The database
  // enforces it (0064 §3 requires role = 'approver' to insert); this is what
  // keeps the buttons off a screen that could not use them.
  const canReview = (membership as Pick<ClientUser, "role"> | null)?.role === "approver";

  const rows = creatives as Creative[];
  const waiting = rows.filter((c) => c.status === "client_review");
  const live = rows.filter((c) => c.status === "live");
  const coming = rows.filter(
    (c) => c.status === "approved" || c.status === "scheduled"
  );
  const withUs = rows.filter((c) => c.status === "changes_requested");

  const reviewsByCreative = new Map<string, CreativeReview[]>();
  for (const review of reviews as CreativeReview[]) {
    const list = reviewsByCreative.get(review.creative_id) ?? [];
    list.push(review);
    reviewsByCreative.set(review.creative_id, list);
  }

  return (
    <>
      <LiveRefresh tables={["creatives", "creative_reviews"]} />

      <div className="mb-8">
        <h1 className="text-[22px] font-semibold tracking-tight">
          {waiting.length > 0
            ? waiting.length === 1
              ? "One video is waiting for you"
              : `${waiting.length} videos are waiting for you`
            : "Nothing needs you right now"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {waiting.length > 0
            ? "Watch the cut, then approve it or say what should change."
            : "We'll email you when the next cut is ready."}
        </p>
      </div>

      {waiting.length > 0 && (
        <div className="mb-8 space-y-5">
          {waiting.map((creative) => (
            <Panel key={creative.id} className="border-info/30">
              <PanelHeader
                title={creative.title}
                action={
                  creative.cut_url && (
                    <a
                      href={creative.cut_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[13px] font-medium text-primary-ink transition-transform duration-150 ease-mac hover:bg-primary-dim active:scale-[0.98]"
                    >
                      Watch the cut
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )
                }
              />
              <div className="space-y-4 px-4 py-4">
                {creative.hook && (
                  <p className="max-w-[70ch] text-[13px] text-muted">
                    <span className="text-faint">Opens with: </span>
                    {creative.hook}
                  </p>
                )}
                <ReviewThread
                  creativeId={creative.id}
                  reviews={reviewsByCreative.get(creative.id) ?? []}
                  members={{}}
                  canReview={canReview}
                  asClient
                />
                {!canReview && (
                  <p className="text-xs text-faint">
                    Your account can follow along but not sign off. Ask us to
                    change that if you need to.
                  </p>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {withUs.length > 0 && (
        <PortalList
          title="Back with us"
          hint="You asked for changes. We're on it."
          rows={withUs}
        />
      )}

      {coming.length > 0 && (
        <PortalList
          title="Approved, going out"
          hint="Signed off and queued to post."
          rows={coming}
          showDate
        />
      )}

      {live.length > 0 ? (
        <PortalList title="Live" hint="Published." rows={live} showLink />
      ) : (
        waiting.length === 0 &&
        coming.length === 0 &&
        withUs.length === 0 && (
          <Panel>
            <EmptyState
              icon={PartyPopper}
              title="Nothing here yet"
              hint="When we have a cut ready for you, it'll appear here to approve. Videos you've signed off stay on this page once they're live."
            />
          </Panel>
        )
      )}
    </>
  );
}

function PortalList({
  title,
  hint,
  rows,
  showDate = false,
  showLink = false,
}: {
  title: string;
  hint: string;
  rows: Creative[];
  showDate?: boolean;
  showLink?: boolean;
}) {
  return (
    <Panel className="mb-5">
      <PanelHeader
        title={title}
        action={<span className="text-xs text-faint">{hint}</span>}
      />
      <ul className="divide-y divide-line">
        {rows.map((creative) => (
          <li
            key={creative.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
          >
            <span className="min-w-0 flex-1 text-sm text-ink">{creative.title}</span>
            {showDate && creative.publish_on && (
              <span className="font-mono text-xs tabular-nums text-faint">
                {formatDate(creative.publish_on)}
              </span>
            )}
            {showLink && creative.published_url ? (
              <a
                href={creative.published_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[13px] text-primary-dim underline-offset-2 hover:underline"
              >
                See the post
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : (
              showLink && <Badge tone="green">live</Badge>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
