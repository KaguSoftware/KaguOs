import { CalendarDays } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/marketing/post-card";
import { addDays, todayInIstanbul } from "@/lib/utils";
import type { MarketingPost, MembersMap } from "@/lib/types";

/** Four weeks: far enough to plan a content calendar, short enough to scroll. */
const HORIZON_DAYS = 28;

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  weekday: "long",
  day: "numeric",
  month: "short",
});

/**
 * SCHEDULE — the publishing calendar, derived from `publish_on` + the status
 * ladder, never stored. There is deliberately NO separate task/checklist
 * object: the post's own advance button is the check-off ("Mark posted" is the
 * tick), so the calendar can never disagree with the boards.
 *
 * Three bands, in the order they need attention: past-their-date, the next
 * four weeks grouped by day, and ready-but-undated — the silent leak a
 * calendar view exists to catch: a finished post nobody dated isn't late yet,
 * but it will be nothing at all unless someone sees it here.
 */
export function Schedule({
  posts,
  members,
  canWrite,
  /** Supplied on the cross-client view; omitted inside one client. */
  clientNames,
}: {
  posts: MarketingPost[];
  members: MembersMap;
  canWrite: boolean;
  clientNames?: Record<string, string>;
}) {
  const today = todayInIstanbul();
  const horizon = addDays(today, HORIZON_DAYS);

  const open = posts.filter((p) => p.status !== "posted");

  const overdue = open
    .filter((p) => p.publish_on !== null && p.publish_on < today)
    .sort((a, b) => (a.publish_on! < b.publish_on! ? -1 : 1));

  const upcoming = open
    .filter(
      (p) => p.publish_on !== null && p.publish_on >= today && p.publish_on <= horizon
    )
    .sort((a, b) => (a.publish_on! < b.publish_on! ? -1 : 1));

  const undated = open.filter(
    (p) => p.publish_on === null && p.status === "scheduled"
  );

  if (overdue.length === 0 && upcoming.length === 0 && undated.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={CalendarDays}
          title="Nothing on the calendar"
          hint="Give a post a publish date and it appears here, grouped by day. Marking it posted is the check-off — there's no separate to-do to keep in sync."
        />
      </Panel>
    );
  }

  const byDay = new Map<string, MarketingPost[]>();
  for (const post of upcoming) {
    const list = byDay.get(post.publish_on!) ?? [];
    list.push(post);
    byDay.set(post.publish_on!, list);
  }

  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <Panel className="border-danger/30">
          <PanelHeader
            title={
              <span className="flex items-baseline gap-2">
                Past their date
                <span className="font-mono text-xs font-normal text-faint tabular-nums">
                  {overdue.length}
                </span>
              </span>
            }
            action={
              <span className="text-xs text-faint">Post them or move the date.</span>
            }
          />
          <ul className="divide-y divide-line">
            {overdue.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  members={members}
                  clientName={clientNames?.[post.client_id]}
                  canWrite={canWrite}
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {[...byDay.entries()].map(([date, rows]) => {
        const isToday = date === today;
        return (
          <Panel key={date}>
            <PanelHeader
              title={
                <span className="flex items-baseline gap-2">
                  {/* Parsed at noon so a UTC-negative render can't roll the
                      label back a day — the string itself is the truth. */}
                  {dayFmt.format(new Date(`${date}T12:00:00Z`))}
                  {isToday && (
                    <span className="text-xs font-normal text-primary-dim">Today</span>
                  )}
                </span>
              }
              action={
                <span className="font-mono text-xs text-faint tabular-nums">
                  {rows.length}
                </span>
              }
            />
            <ul className="divide-y divide-line">
              {rows.map((post) => (
                <li key={post.id}>
                  <PostCard
                    post={post}
                    members={members}
                    clientName={clientNames?.[post.client_id]}
                    canWrite={canWrite}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}

      {undated.length > 0 && (
        <Panel>
          <PanelHeader
            title="Ready but not dated"
            action={
              <span className="text-xs text-faint">
                Marked scheduled with no date — the calendar can&apos;t see them.
              </span>
            }
          />
          <ul className="divide-y divide-line">
            {undated.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  members={members}
                  clientName={clientNames?.[post.client_id]}
                  canWrite={canWrite}
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
