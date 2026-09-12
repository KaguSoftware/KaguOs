"use client";

import {
  useRealtimeRefresh,
  type ChangePayload,
  type Watchable,
} from "@/lib/use-realtime-refresh";

/**
 * Drop-in live updates for a server-rendered page: mount this and the page
 * re-pulls whenever the given tables change (see useRealtimeRefresh). Renders
 * nothing — it's just the client hook boundary a server component can't hold
 * itself. One per page, listing exactly the tables that page shows.
 *
 *   <LiveRefresh tables={["contacts", "contact_interactions"]} />
 *
 * Pass a descriptor instead of a bare name to narrow the subscription on the
 * SERVER, so the event is never sent rather than being discarded on arrival:
 *
 *   <LiveRefresh tables={[{ table: "notifications", filter: `recipient_id=eq.${me}` }]} />
 */
export function LiveRefresh({
  tables,
  shouldRefresh,
  onChange,
}: {
  /** Table names, or {table, event, filter} descriptors — see useRealtimeRefresh. */
  tables: Watchable | Watchable[];
  /** Optional per-event filter — see useRealtimeRefresh. Must be stable. */
  shouldRefresh?: (payload: ChangePayload) => boolean;
  /** Optional per-event side effect — see useRealtimeRefresh. */
  onChange?: (payload: ChangePayload) => void;
}) {
  useRealtimeRefresh(tables, shouldRefresh, onChange);
  return null;
}
