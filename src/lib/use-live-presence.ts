"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/** Live presence state for one teammate, derived from the presence channel. */
export type LiveState = "online" | "away" | "offline";

/** Idle this long (tab hidden or no interaction) → "away" rather than "online". */
const AWAY_AFTER_MS = 3 * 60 * 1000;
/** Re-evaluate away/online on a coarse tick — presence timing needn't be exact. */
const TICK_MS = 30 * 1000;

type Tracked = { userId: string; away: boolean };
type Listener = (states: Record<string, LiveState>) => void;

/**
 * ONE shared subscription per page, not one per hook instance. supabase-js
 * dedupes channels by topic: every `supabase.channel("presence:team")` call
 * returns the SAME RealtimeChannel. When each hook instance believed it owned
 * that channel, three things broke (worst on mobile, where the menu sheet and
 * team sheet mount/unmount over the always-mounted sidebar panel):
 *
 *  - a second subscriber's `.subscribe()` was a silent no-op on the already
 *    joined channel, so its callback never fired and it never saw the current
 *    presence state → the team sheet opened to "0/4 online" incl. yourself;
 *  - any unmounting instance ran `untrack()` + `removeChannel()` on the shared
 *    channel, kicking every other subscriber offline until a full reload;
 *  - away/activity listeners were duplicated per instance.
 *
 * So the channel, the activity tracking, and the derived state map live in a
 * module-level store; hook instances just attach as listeners (getting an
 * immediate snapshot) and detach on unmount. The store deliberately outlives
 * its consumers: closing a sheet shouldn't untrack you (you're still in the
 * app — teammates would see you flicker offline), and tearing down on the
 * last unmount reopens the shared-channel race (a leaving channel stays in
 * the client's list until the server acks, so a quick remount would adopt the
 * dying instance). It restarts only if the user identity changes.
 */
type Store = {
  meId: string;
  states: Record<string, LiveState>;
  listeners: Set<Listener>;
  stop: () => void;
};

let store: Store | null = null;

function startStore(meId: string): Store {
  const supabase = createClient();
  const s: Store = {
    meId,
    states: {},
    listeners: new Set(),
    stop: () => {},
  };

  let channel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;
  let tick: ReturnType<typeof setInterval> | null = null;

  // Latest activity timestamp; seeded to "just now" so we start as online.
  let lastActive = Date.now();
  const markActive = () => {
    lastActive = Date.now();
  };
  const activityEvents = ["pointerdown", "keydown", "pointermove", "scroll"] as const;
  for (const ev of activityEvents) {
    window.addEventListener(ev, markActive, { passive: true });
  }
  document.addEventListener("visibilitychange", markActive);

  const isAway = () =>
    document.visibilityState === "hidden" ||
    Date.now() - lastActive > AWAY_AFTER_MS;

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
    s.states = next;
    for (const listener of s.listeners) listener(next);
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

    // The browser client is a singleton and supabase-js dedupes channels by
    // topic, so a leftover channel (dev HMR, a previous user's store) would be
    // handed back to us mid-teardown. Clear it out and start clean.
    for (const existing of supabase.getChannels()) {
      if (existing.topic === "realtime:presence:team") {
        await supabase.removeChannel(existing);
      }
    }
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

  s.stop = () => {
    cancelled = true;
    if (tick) clearInterval(tick);
    for (const ev of activityEvents) window.removeEventListener(ev, markActive);
    document.removeEventListener("visibilitychange", markActive);
    if (channel) {
      channel.untrack();
      supabase.removeChannel(channel);
      channel = null;
    }
  };
  return s;
}

/**
 * Real-time team presence over a shared Supabase presence channel — the honest
 * "who's actually here right now" signal, replacing the throttled last_seen
 * guess. Returns a map of userId → "online" | "away" | "offline"; someone not
 * in the map at all is offline.
 *
 * "away" is self-reported: this client flips its own tracked `away` when its
 * tab is hidden or it's seen no interaction for a few minutes, then re-tracks.
 * Everyone else sees that instantly.
 *
 * This is separate from useRealtimeRefresh (which mirrors DB rows): presence is
 * ephemeral connection state that never touches Postgres, so it updates the very
 * moment a tab opens or closes — no row write, no refresh round-trip.
 */
const NO_STATES: Record<string, LiveState> = {};

export function useLivePresence(meId: string): Record<string, LiveState> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // A store keyed to a different user is stale (sign-out/in without a full
      // reload) — replace it rather than mixing identities on one channel.
      if (store && store.meId !== meId) {
        store.stop();
        store = null;
      }
      if (!store) store = startStore(meId);
      const s = store;
      const listener: Listener = () => onStoreChange();
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
        // No teardown on last unmount — see the Store docblock.
      };
    },
    [meId]
  );

  // `states` is replaced wholesale on every presence sync, so it's a stable
  // snapshot reference between syncs — exactly what useSyncExternalStore
  // needs. A consumer mounting after the channel synced reads the live map
  // immediately (the case the old per-hook channels missed).
  const getSnapshot = useCallback(
    () => (store?.meId === meId ? store.states : NO_STATES),
    [meId]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => NO_STATES);
}
