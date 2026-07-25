"use client";

import { useCallback, useEffect, useRef } from "react";
import { markThreadRead } from "@/lib/actions/messages";

/**
 * Owns "when is a message actually READ".
 *
 * The thread used to call `markThreadRead` straight from the realtime INSERT
 * handler, for every arriving line, with no conditions. Three things were wrong
 * with that:
 *
 *  1. **It lied.** A thread parked in a background tab consumed every line the
 *     moment it arrived, so the sender was shown `Seen 14:32` for a message
 *     nobody had looked at. It also contradicted the thread's own scroll policy,
 *     which deliberately does NOT bring an incoming line into view when the
 *     reader is scrolled up — the code decided "don't show this to the reader"
 *     and "tell the sender they saw it" in the same breath.
 *  2. **It silenced notifications.** `sendMessage` only notifies when the
 *     recipient has no unread from that sender, so a background tab holding
 *     `priorUnread` at 0 forever meant no bell, no toast and no badge from that
 *     person again — the section's whole promise, failing invisibly.
 *  3. **It stormed the server.** One round trip per inbound line, each ending in
 *     a layout revalidation.
 *
 * So a mark now requires real attention — the tab visible AND focused AND
 * (optionally) the newest line actually on screen — and a burst of lines
 * coalesces into one call. A mark requested while the reader is away is not
 * dropped; it is held and flushed when they come back.
 *
 * The liveness idea is the one already used by `use-live-presence.ts`; messages
 * was the only realtime surface that skipped it.
 */

/** Trailing window — a burst of six lines costs ONE round trip. */
const COALESCE_MS = 1000;

/** How close to the bottom still counts as "looking at the newest line". */
export const READ_SLACK_PX = 200;

export function useReadMarker(
  /** null = the group chat, matching markThreadRead. */
  otherId: string | null,
  /** Extra condition beyond tab liveness — e.g. the newest line is on screen. */
  ready?: () => boolean
) {
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synced in an effect, not during render — writing a ref while rendering is
  // impure, and this predicate closes over scroll state that changes constantly.
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  /** Is the reader actually at the keyboard, looking at this tab? */
  const present = () =>
    document.visibilityState === "visible" && document.hasFocus();

  /** Send a held mark if the reader is genuinely present; otherwise keep holding. */
  const flush = useCallback(() => {
    if (!pending.current) return;
    if (!present()) return;
    if (readyRef.current && !readyRef.current()) return;
    pending.current = false;
    void markThreadRead(otherId);
  }, [otherId]);

  /** Note that there is something to mark. Coalesced, and gated by `flush`. */
  const mark = useCallback(() => {
    pending.current = true;
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, COALESCE_MS);
  }, [flush]);

  /**
   * Mark because the reader DELIBERATELY opened this thread.
   *
   * Deliberately skips the `ready` predicate. `ready` exists to stop a line that
   * arrived off-screen from being reported as seen, which is about the stream —
   * but a thread now opens scrolled to the "N new" divider rather than to the
   * bottom, so on open `ready` is false precisely when there IS unread, and the
   * badge could never clear. Opening a thread is the act of reading it; tab
   * liveness is the only condition that still applies.
   */
  const markNow = useCallback(() => {
    if (!present()) {
      // Not looking yet — hold it and let the wake listener deal with it.
      pending.current = true;
      return;
    }
    pending.current = false;
    void markThreadRead(otherId);
  }, [otherId]);

  // Coming back to the tab is the moment a held mark becomes true.
  useEffect(() => {
    const onWake = () => flush();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      // Leaving a thread you were reading should still clear the badge. The
      // component is unmounting, so `ready` may close over dead refs — tab
      // visibility is the only condition checked here.
      if (pending.current && document.visibilityState === "visible") {
        pending.current = false;
        void markThreadRead(otherId);
      }
    };
  }, [otherId]);

  return { mark, markNow, flush };
}
