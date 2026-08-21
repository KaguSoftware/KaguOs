import { CalendarDays } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { CreativeCard } from "@/components/marketing/creative-card";
import { addDays, todayInIstanbul } from "@/lib/utils";
import type { Creative, MembersMap } from "@/lib/types";

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
 * ladder, never stored (same rule as shoot week, MARKETING.md D6). There is
 * deliberately NO separate task/checklist object for publishes: the creative's
 * own advance button is the check-off ("Mark live" is the tick), so the
 * calendar can never disagree with the pipeline.
 *
 * Three bands, in the order they need attention:
 * overdue (dated, not live, date passed) → the next four weeks grouped by day
 * → approved-but-undated, which is the silent leak a calendar view exists to
 * catch: a finished video nobody gave a date to isn't late yet, but it will be
 * nothing at all unless someone sees it here.
 */
export function Schedule({
  creatives,
  members,
  canWrite,
  house,
}: {
  creatives: Creative[];
  members: MembersMap;
  canWrite: boolean;
  house: boolean;
}) {
  const today = todayInIstanbul();
  const horizon = addDays(today, HORIZON_DAYS);

  const notLive = creatives.filter((c) => c.status !== "live");

  const overdue = notLive
    .filter((c) => c.publish_on !== null && c.publish_on < today)
    .sort((a, b) => (a.publish_on! < b.publish_on! ? -1 : 1));

  const upcoming = notLive
    .filter(
      (c) => c.publish_on !== null && c.publish_on >= today && c.publish_on <= horizon
    )
    .sort((a, b) => (a.publish_on! < b.publish_on! ? -1 : 1));

  const undated = notLive.filter(
    (c) => c.publish_on === null && (c.status === "approved" || c.status === "scheduled")
  );

  if (overdue.length === 0 && upcoming.length === 0 && undated.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={CalendarDays}
          title="Nothing on the calendar"
          hint="Give a video a publish date and it appears here, grouped by day. Marking it live is the check-off — there's no separate to-do to keep in sync."
        />
      </Panel>
    );
  }

  const byDay = new Map<string, Creative[]>();
  for (const creative of upcoming) {
    const list = byDay.get(creative.publish_on!) ?? [];
    list.push(creative);
    byDay.set(creative.publish_on!, list);
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
              <span className="text-xs text-faint">
                Publish them or move the date.
              </span>
            }
          />
          <ul className="divide-y divide-line">
            {overdue.map((creative) => (
              <li key={creative.id}>
                <CreativeCard
                  creative={creative}
                  members={members}
                  canWrite={canWrite}
                  house={house}
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
              {rows.map((creative) => (
                <li key={creative.id}>
                  <CreativeCard
                    creative={creative}
                    members={members}
                    canWrite={canWrite}
                    house={house}
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
                Finished videos with no publish date — the calendar can&apos;t see them.
              </span>
            }
          />
          <ul className="divide-y divide-line">
            {undated.map((creative) => (
              <li key={creative.id}>
                <CreativeCard
                  creative={creative}
                  members={members}
                  canWrite={canWrite}
                  house={house}
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
