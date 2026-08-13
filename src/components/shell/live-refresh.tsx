"use client";

import {
  useRealtimeRefresh,
  type ChangePayload,
} from "@/lib/use-realtime-refresh";

/**
 * Drop-in live updates for a server-rendered page: mount this and the page
 * re-pulls whenever the given tables change (see useRealtimeRefresh). Renders
 * nothing — it's just the client hook boundary a server component can't hold
 * itself. One per page, listing exactly the tables that page shows.
 *
 *   <LiveRefresh tables={["contacts", "contact_interactions"]} />
 */
export function LiveRefresh({
  tables,
  shouldRefresh,
  onChange,
}: {
  tables: string | string[];
  /** Optional per-event filter — see useRealtimeRefresh. Must be stable. */
  shouldRefresh?: (payload: ChangePayload) => boolean;
  /** Optional per-event side effect — see useRealtimeRefresh. */
  onChange?: (payload: ChangePayload) => void;
}) {
  useRealtimeRefresh(tables, shouldRefresh, onChange);
  return null;
}
