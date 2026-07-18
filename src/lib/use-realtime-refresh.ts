"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Live updates for a server-rendered list. Subscribes to Postgres changes on
 * one or more tables and calls router.refresh() when anything changes, so the
 * server re-renders the view with fresh data — already RLS- and showcase-
 * filtered, since it's the same server render as the first paint. No row data
 * from the realtime stream ever reaches the client directly.
 *
 * This is the counterpart to the debug board's in-place setRows subscription:
 * use that when the list lives in client state and you want zero-latency patches;
 * use THIS when the list is server-rendered (most sections) and a refresh is the
 * simplest correct way to reflect someone else's change.
 *
 *   useRealtimeRefresh("contacts");
 *   useRealtimeRefresh(["marketing_posts", "marketing_campaigns"]);
 *
 * Refreshes are coalesced: a burst of changes (e.g. a batch insert) triggers a
 * single refresh on the next tick, not one per row.
 */
export function useRealtimeRefresh(tables: string | string[]) {
  const router = useRouter();
  // Stringify so the effect re-subscribes only when the actual table set
  // changes, not on every render (a fresh array literal each time otherwise).
  const key = Array.isArray(tables) ? tables.join(",") : tables;

  // Keep the newest router in a ref so the subscription callback always calls
  // the current one without being a dependency that re-subscribes. Synced in an
  // effect (not during render) — writing a ref while rendering is impure.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    if (list.length === 0) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Coalesce a burst of events into one refresh on the next tick.
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        routerRef.current.refresh();
      }, 150);
    };

    (async () => {
      // These tables have RLS, so postgres_changes only delivers events when the
      // realtime socket carries the user's JWT — otherwise it's authorized as
      // anon and streams nothing (the channel still reports SUBSCRIBED). Set the
      // token explicitly before subscribing. See the debug board for the same fix.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      let ch = supabase.channel(`realtime-refresh:${key}`);
      for (const table of list) {
        ch = ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          scheduleRefresh
        );
      }
      ch.subscribe();
      channel = ch;
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [key]);
}
