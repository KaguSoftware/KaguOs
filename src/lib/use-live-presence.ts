"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Live presence state for one teammate, derived from the presence channel. */
export type LiveState = "online" | "away" | "offline";

/** Idle this long (tab hidden or no interaction) → "away" rather than "online". */
const AWAY_AFTER_MS = 3 * 60 * 1000;
/** Re-evaluate away/online on a coarse tick — presence timing needn't be exact. */
const TICK_MS = 30 * 1000;

type Tracked = { userId: string; away: boolean };

/**
 * Real-time team presence over a shared Supabase presence channel — the honest
 * "who's actually here right now" signal, replacing the throttled last_seen
 * guess. Each client `track()`s itself (and whether it's currently idle); the
 * hook returns a map of userId → "online" | "away" | "offline".
 *
 * "away" is self-reported: a client flips its own tracked `away` when its tab is
 * hidden or it's seen no interaction for a few minutes, then re-tracks. Everyone
 * else sees that instantly. Someone not in the presence state at all is offline.
 *
 * This is separate from useRealtimeRefresh (which mirrors DB rows): presence is
 * ephemeral connection state that never touches Postgres, so it updates the very
 * moment a tab opens or closes — no row write, no refresh round-trip.
 */
export function useLivePresence(meId: string): Record<string, LiveState> {
  const [states, setStates] = useState<Record<string, LiveState>>({});

  // Latest activity timestamp, kept in a ref so listeners don't re-subscribe.
  const lastActiveRef = useRef<number>(0);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let tick: ReturnType<typeof setInterval> | null = null;

    // We can't read Date.now() at module top (SSR), but in a browser effect it's
    // fine. Seed activity to "just now" so we start as online.
    lastActiveRef.current = Date.now();

    const markActive = () => {
      lastActiveRef.current = Date.now();
    };
    const activityEvents = ["pointerdown", "keydown", "pointermove", "scroll"] as const;
    for (const ev of activityEvents) {
      window.addEventListener(ev, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", markActive);

    const isAway = () =>
      document.visibilityState === "hidden" ||
      Date.now() - lastActiveRef.current > AWAY_AFTER_MS;

    // Fold the raw presence state (keyed by presence-ref, values are the tracked
    // payloads) into one LiveState per userId. If any of a user's connections is
    // online, they're online; else if any is away, away; else they're absent.
    const sync = () => {
      if (!channel) return;
      const raw = channel.presenceState<Tracked>();
      const next: Record<string, LiveState> = {};
      for (const entries of Object.values(raw)) {
        for (const p of entries) {
          const prev = next[p.userId];
          const here: LiveState = p.away ? "away" : "online";
          // online beats away beats absent.
          if (prev === "online") continue;
          if (here === "online" || prev === undefined) next[p.userId] = here;
        }
      }
      setStates(next);
    };

    (async () => {
      // Presence rides the same authed socket as postgres_changes; set the JWT
      // first so a private/RLS-guarded realtime setup still authorizes us. Safe
      // to set even when the channel is public.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      const ch = supabase.channel("presence:team", {
        config: { presence: { key: meId } },
      });
      ch.on("presence", { event: "sync" }, sync);
      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || cancelled) return;
        await ch.track({ userId: meId, away: isAway() } satisfies Tracked);
      });
      channel = ch;

      // Re-track on a coarse interval so our away/online flips propagate and the
      // derived map re-evaluates without needing a DB event.
      tick = setInterval(async () => {
        if (!channel) return;
        await channel.track({ userId: meId, away: isAway() } satisfies Tracked);
      }, TICK_MS);
    })();

    return () => {
      cancelled = true;
      if (tick) clearInterval(tick);
      for (const ev of activityEvents) window.removeEventListener(ev, markActive);
      document.removeEventListener("visibilitychange", markActive);
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
    };
  }, [meId]);

  return states;
}
