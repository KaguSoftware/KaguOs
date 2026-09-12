"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { GROUP_THREAD } from "@/lib/messages-shared";

/**
 * "Sara is typing…", over Realtime BROADCAST.
 *
 * This is the counterpart to the two patterns already in the codebase, and the
 * reason it's a third one: useRealtimeRefresh mirrors rows by re-rendering the
 * server, thread.tsx mirrors rows by patching client state — both start from a
 * row that exists. A typing signal is not a row. It's true for a few seconds and
 * then it isn't, and nobody ever wants to read it back. Broadcast carries it on
 * the socket the client already holds without touching Postgres at all: no
 * insert, no WAL, no RLS pass per subscriber, and crucially no router.refresh()
 * per keystroke — which is the one thing that would make this expensive.
 *
 * Since no table is involved, none of the app's RLS applies. The channels are
 * therefore PRIVATE, authorized by policies on realtime.messages — see
 * 0083_realtime_typing.sql. Dropping `private: true` here would silently make
 * the topic readable by anyone holding the anon key.
 */

/** Re-announce at most this often while someone keeps typing. */
const THROTTLE_MS = 2000;
/**
 * Drop a typist this long after their last packet. Must comfortably exceed
 * THROTTLE_MS or a steady typist would flicker off between announcements.
 */
const TTL_MS = 4000;
/** How often to re-check for expiries. Runs only while someone is typing. */
const SWEEP_MS = 500;

/**
 * The topic both ends of a thread must agree on.
 *
 * A DM is identified from each side by the OTHER person, so `typing:${otherId}`
 * would put the two participants on two different topics and neither would ever
 * hear the other. Sorting the pair gives the thread one canonical name. The
 * same shape is parsed by private.can_use_typing_topic() in the migration —
 * change one and you must change the other.
 */
export function typingTopic(meId: string, otherId: string | null): string {
  if (!otherId || otherId === GROUP_THREAD) return "typing:team";
  return `typing:dm:${[meId, otherId].sort().join(":")}`;
}

type Payload = { userId: string };

export function useTyping({
  meId,
  otherId,
}: {
  meId: string;
  /** The other participant's id, or null / GROUP_THREAD for the team chat. */
  otherId: string | null;
}) {
  const topic = typingTopic(meId, otherId);

  // userId -> the timestamp of their most recent packet. Replaced wholesale on
  // every change so the object identity is a usable render signal.
  const [seen, setSeen] = useState<Record<string, number>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      // Authorize the socket as this user first. Every realtime consumer in the
      // app repeats this for the same reason: without it the channel still
      // reports SUBSCRIBED and then carries nothing. For a PRIVATE channel it
      // is doubly required — the realtime.messages policies are what decide
      // whether we may join this topic at all.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      // supabase-js dedupes channels by topic, and a leaving channel stays in
      // its list until the server acks the departure — so switching away from a
      // thread and straight back could hand us the dying instance. Clear any
      // leftover first. Same hazard, same fix as lib/use-live-presence.ts; note
      // the client prefixes topics with "realtime:".
      for (const existing of supabase.getChannels()) {
        if (existing.topic === `realtime:${topic}`) {
          await supabase.removeChannel(existing);
        }
      }
      if (cancelled) return;

      const ch = supabase.channel(topic, { config: { private: true } });
      ch.on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userId } = (payload ?? {}) as Partial<Payload>;
        // My own packet comes back to me; it isn't news.
        if (!userId || userId === meId) return;
        setSeen((prev) => ({ ...prev, [userId]: Date.now() }));
      });
      ch.subscribe();
      channel = ch;
      channelRef.current = ch;
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      lastSentRef.current = 0;
      // Unlike the presence store, this channel SHOULD die with the view: it is
      // scoped to one thread, and leaving the thread means we are no longer
      // typing in it.
      if (channel) supabase.removeChannel(channel);
      setSeen({});
    };
  }, [topic, meId]);

  // Expire stale typists. The interval exists only while someone is actually
  // typing — a permanently-running timer on every thread view would be exactly
  // the kind of idle cost broadcast is supposed to avoid.
  const active = Object.keys(seen).length > 0;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const cutoff = Date.now() - TTL_MS;
      setSeen((prev) => {
        const next: Record<string, number> = {};
        for (const [userId, at] of Object.entries(prev)) {
          if (at > cutoff) next[userId] = at;
        }
        // Keep the old identity when nothing expired, so this doesn't re-render
        // the thread twice a second for no reason.
        return Object.keys(next).length === Object.keys(prev).length
          ? prev
          : next;
      });
    }, SWEEP_MS);
    return () => clearInterval(id);
  }, [active]);

  /**
   * Call on every keystroke; the throttle is what keeps that cheap. Fire and
   * forget — a dropped typing packet is not worth handling, and the next
   * keystroke sends another one anyway.
   */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) return;
    const ch = channelRef.current;
    if (!ch) return;
    lastSentRef.current = now;
    void ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: meId } satisfies Payload,
    });
  }, [meId]);

  /**
   * Forget a typist immediately rather than waiting out the TTL. The thread
   * calls this when a line actually arrives from them: they've clearly stopped,
   * and leaving "Sara is typing…" under Sara's new message looks broken.
   */
  const clearTypist = useCallback((userId: string) => {
    setSeen((prev) => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  /** Stop announcing after a send, so the next keystroke re-announces at once. */
  const resetThrottle = useCallback(() => {
    lastSentRef.current = 0;
  }, []);

  return {
    /** User ids currently typing in this thread, never including me. */
    typists: Object.keys(seen),
    notifyTyping,
    clearTypist,
    resetThrottle,
  };
}
