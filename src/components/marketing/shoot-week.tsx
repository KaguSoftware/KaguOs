import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CREATIVE_STATUS_LABELS, CREATIVE_STATUS_TONE } from "@/lib/creatives";
import { addDays, todayInIstanbul } from "@/lib/utils";
import type { Creative, MembersMap } from "@/lib/types";

/** How far ahead the shoot view looks. Two weeks is a planning horizon; a month
 *  is a list nobody scrolls and a week hides next Monday on a Friday. */
const HORIZON_DAYS = 14;

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  weekday: "long",
  day: "numeric",
  month: "short",
});

/**
 * SHOOT WEEK — derived, never stored (MARKETING.md D6).
 *
 * The tempting alternative is a `shoots` table: a shoot has a date, a location,
 * a call time, several videos. It is also a second object that has to be kept
 * in sync with the videos on it, and the interview was explicit that shoot data
 * is fields on the video. So this is a query over `shoot_date`, grouped by day.
 * Full calendar value, nothing to reconcile.
 *
 * A server component: it holds no state, and the grouping is cheap arithmetic
 * on rows the page already fetched.
 */
export function ShootWeek({
  creatives,
  members,
  clientNames,
}: {
  creatives: Creative[];
  members: MembersMap;
  /** Only supplied by the cross-client view — inside one client it'd be noise. */
  clientNames?: Record<string, string>;
}) {
  const today = todayInIstanbul();
  const horizon = addDays(today, HORIZON_DAYS);

  const upcoming = creatives
    .filter(
      (c) => c.shoot_date !== null && c.shoot_date >= today && c.shoot_date <= horizon
    )
    .sort((a, b) => (a.shoot_date! < b.shoot_date! ? -1 : 1));

  // Videos with a shoot date that has passed but no footage. These are the ones
  // that quietly rot: the day came, nobody filmed, and the row keeps a date
  // that makes it look handled. Surfaced above the calendar rather than left
  // for someone to notice.
  const missed = creatives.filter(
    (c) => c.shoot_date !== null && c.shoot_date < today && !c.footage_url
  );

  if (upcoming.length === 0 && missed.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={CalendarDays}
          title="Nothing booked in the next two weeks"
          hint="Give a video a shoot date and it appears here, grouped by day. There's no separate shoot to create — the date lives on the video."
        />
      </Panel>
    );
  }

  const byDay = new Map<string, Creative[]>();
  for (const creative of upcoming) {
    const list = byDay.get(creative.shoot_date!) ?? [];
    list.push(creative);
    byDay.set(creative.shoot_date!, list);
  }

  return (
    <div className="space-y-5">
      {missed.length > 0 && (
        <Panel className="border-danger/30">
          <PanelHeader title="Shoot date passed, no footage" />
          <ul className="divide-y divide-line">
            {missed.map((creative) => (
              <li key={creative.id} className="px-4 py-2.5">
                <ShootRow
                  creative={creative}
                  members={members}
                  clientNames={clientNames}
                  showDate
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
                <li key={creative.id} className="px-4 py-2.5">
                  <ShootRow
                    creative={creative}
                    members={members}
                    clientNames={clientNames}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}

function ShootRow({
  creative,
  members,
  clientNames,
  showDate = false,
}: {
  creative: Creative;
  members: MembersMap;
  clientNames?: Record<string, string>;
  showDate?: boolean;
}) {
  const owner = creative.owner_id ? members[creative.owner_id] : null;
  const client = clientNames?.[creative.client_id];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link
        href={`/marketing/creatives/${creative.id}`}
        className="min-w-0 flex-1 text-sm text-ink underline-offset-2 hover:text-primary-dim hover:underline"
      >
        {creative.title}
      </Link>
      {client && <span className="text-xs text-muted">{client}</span>}
      {owner && (
        <span className="text-xs" style={{ color: owner.color }}>
          {owner.name}
        </span>
      )}
      {showDate && creative.shoot_date && (
        <span className="font-mono text-xs text-faint tabular-nums">
          {creative.shoot_date}
        </span>
      )}
      <Badge tone={CREATIVE_STATUS_TONE[creative.status]}>
        {CREATIVE_STATUS_LABELS[creative.status]}
      </Badge>
    </div>
  );
}
