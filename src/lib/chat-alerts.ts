"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GROUP_LABEL, GROUP_THREAD } from "@/lib/messages-shared";
import type { ChangePayload } from "@/lib/use-realtime-refresh";
import type { MembersMap, Message } from "@/lib/types";

/**
 * The two signals that reach a person who is NOT looking at KaguOs: a short
 * chime, and an OS notification.
 *
 * WHY THIS EXISTS. Everything chat already had — the sidebar badge, the DM
 * toast, the `(3)` in the tab title — is visible only to someone whose eyes are
 * on this window. `title-unread.tsx` says as much ("this app lives in a
 * background tab") and settles for the cheapest signal that needs no permission.
 * That is a real signal for a tab you glance at; it is nothing at all for a
 * window behind an editor. A message therefore sat unseen for as long as the
 * other window stayed on top, which for a chat is the one failure that matters.
 *
 * TWO SIGNALS, TWO DIFFERENT RULES, because they cost different amounts:
 *
 *  - The **chime** plays whenever a line arrives that you are not already
 *    looking at. Cheap, local, no permission.
 *  - The **notification** fires only when the app is genuinely not in front of
 *    you (hidden tab, or another window focused). In-app it would be the third
 *    announcement of one message, after the badge and the toast.
 *
 * Neither ever fires for your own sends, including the ones that arrive from
 * your phone through the same realtime stream.
 */

/* ------------------------------------------------------------- preferences */

/** `"0"` mutes the chime; absent means on, because that is the feature. */
const SOUND_KEY = "kagu:chat-sound";
/** `"1"` once the permission ask has been answered or waved away, per device. */
const ASKED_KEY = "kagu:chat-alerts-asked";

export type AlertPrefs = {
  sound: boolean;
  /** The browser's own answer, or "unsupported" where the API is absent. */
  permission: NotificationPermission | "unsupported";
  /** Has this device been asked once already? Gates the one-time prompt. */
  asked: boolean;
};

/**
 * What the server renders. `asked: true` is the important field: the prompt is
 * hidden in the HTML and appears only after hydration has read the real answer,
 * so a device that already granted permission never flashes an ask it doesn't
 * need. Must be a stable reference — useSyncExternalStore compares identity.
 */
const SERVER_PREFS: AlertPrefs = {
  sound: true,
  permission: "unsupported",
  asked: true,
};

const listeners = new Set<() => void>();
let cached: AlertPrefs | null = null;

function readPrefs(): AlertPrefs {
  let sound = true;
  let asked = false;
  try {
    sound = window.localStorage.getItem(SOUND_KEY) !== "0";
    asked = window.localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    // Storage can be denied outright (Safari lockdown, embedded webviews).
    // Alerts still work for the session; only the memory of the choice is lost.
  }
  return {
    sound,
    asked,
    permission: "Notification" in window ? Notification.permission : "unsupported",
  };
}

/**
 * Cached deliberately: useSyncExternalStore calls this on every render and
 * demands a stable reference between publishes, so a fresh object each time
 * would loop forever. Invalidated only by `publish`.
 */
function getPrefs(): AlertPrefs {
  cached ??= readPrefs();
  return cached;
}

/** Re-read and repaint every subscriber — the toggle in Account and the ask on
 *  the Messages page are in different subtrees and must agree. */
function publish() {
  cached = readPrefs();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // See readPrefs — a denied store is not worth failing a click over.
  }
}

/**
 * Read + change the alert preferences. Every mutation goes through here rather
 * than through localStorage directly, so the other copies of this UI update in
 * the same tick.
 */
export function useAlertPrefs() {
  const prefs = useSyncExternalStore(subscribe, getPrefs, () => SERVER_PREFS);

  const setSound = useCallback((on: boolean) => {
    remember(SOUND_KEY, on ? "1" : "0");
    // A click is exactly the gesture the audio context needs — take it while
    // we have one, rather than discovering at 2am that the first chime is mute.
    if (on) primeChime();
    publish();
  }, []);

  /** The permission ask. MUST be called from a click: Safari rejects a request
   *  that isn't tied to a gesture, and the gesture unlocks audio too. */
  const ask = useCallback(async () => {
    remember(ASKED_KEY, "1");
    primeChime();
    if ("Notification" in window) {
      try {
        await Notification.requestPermission();
      } catch {
        // An older browser hands back a callback API instead of a promise;
        // either way the answer lands in Notification.permission below.
      }
    }
    publish();
  }, []);

  /** "Not now" — stop asking on this device without touching the browser. */
  const dismissAsk = useCallback(() => {
    remember(ASKED_KEY, "1");
    publish();
  }, []);

  return { ...prefs, setSound, ask, dismissAsk };
}

/* ------------------------------------------------------------------ chime */

/** A rising fifth: two sine notes, the second a beat behind the first. */
const NOTES = [880, 1318.51];
/** Gap between the two notes. */
const NOTE_GAP_S = 0.13;
/** How long one note takes to fall silent. */
const NOTE_DECAY_S = 0.26;
/** Peak gain. This is a desk tool that runs all day — it announces, it doesn't
 *  demand. Loud enough over a quiet office, quiet enough not to startle. */
const PEAK = 0.075;
/** Six lines arriving together are one event, not six chimes. */
const CHIME_GAP_MS = 1500;

let ctx: AudioContext | null = null;
let lastChime = 0;

/**
 * The shared audio context, opened on demand.
 *
 * Browsers start a context SUSPENDED until the page has seen a user gesture, so
 * this is also called from the clicks that turn alerts on — by the time a
 * message actually arrives there is nothing left to unlock.
 */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Open (and resume) the context from inside a user gesture. */
export function primeChime() {
  audio();
}

/**
 * Synthesised rather than shipped as an .mp3: it is two oscillators and an
 * envelope, so it costs no asset, no request and no decode, and it can't be the
 * one file that 404s in production.
 */
export function playChime() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;

  for (const [i, freq] of NOTES.entries()) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;

    const start = t0 + i * NOTE_GAP_S;
    const end = start + NOTE_DECAY_S;
    // Ramped, never switched: a sine that starts or stops at full amplitude
    // has a square edge in it, and that edge is an audible click.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(PEAK, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    // Stopped, not just faded — an oscillator left running is a live node.
    osc.stop(end + 0.02);
  }
}

/** The chime as the alerts use it: muted by preference, and rate-limited. */
function chimeIfWanted() {
  if (!getPrefs().sound) return;
  const now = Date.now();
  if (now - lastChime < CHIME_GAP_MS) return;
  lastChime = now;
  playChime();
}

/* ----------------------------------------------------------- notification */

/** A banner is a glance, not a read. Past this the thread is the right place. */
const MAX_PREVIEW = 120;

/**
 * One line, deliberately: `Parsa` over `hey are you around`. The sender's first
 * name is the whole headline — an OS banner already says which app it came from,
 * so "New message in KaguOs from Parsa Ahmadi in the Work team" is three
 * restatements of things the notification itself is telling you.
 */
function showNotification(input: {
  title: string;
  body: string;
  tag: string;
  onOpen: () => void;
}) {
  try {
    const n = new Notification(input.title, {
      body: input.body,
      // Replaces the previous banner from the same thread instead of stacking a
      // tower of them — a burst reads as one conversation, showing its newest
      // line.
      tag: input.tag,
      icon: "/kagu-mark.png",
      // We play our own chime; letting the OS add its default sound on top
      // means every message arrives twice.
      silent: true,
    });
    n.onclick = () => {
      n.close();
      window.focus();
      input.onOpen();
    };
  } catch {
    // Android Chrome grants the permission but throws on the constructor —
    // there, notifications may only come from a service worker, which this app
    // doesn't have. The chime has already played; that's the whole alert.
  }
}

/* ------------------------------------------------------------ the trigger */

/** What a body-less message says. Images aren't on the realtime row (they land
 *  in `message_images` a beat later), so an empty body with no task is one. */
function preview(row: Partial<Message>) {
  const body =
    (row.body ?? "").trim() || (row.task_id ? "Shared a task" : "Sent an image");
  return body.length > MAX_PREVIEW
    ? `${body.slice(0, MAX_PREVIEW - 1).trimEnd()}…`
    : body;
}

/**
 * Turns the shell's chat stream into alerts. Returns the handler that
 * `ChatLiveRefresh` hands to its subscription — this rides the channel that is
 * already open rather than joining a second one for the same two tables.
 *
 * @param openThread the thread on screen (`""` when none) — a member id, or
 *   GROUP_THREAD. Computed by the caller, which already derives it.
 */
export function useChatAlerts({
  meId,
  members,
  openThread,
}: {
  meId: string;
  members: MembersMap;
  openThread: string;
}) {
  const router = useRouter();
  // Realtime replays rows across a resubscribe, and an alert that fires twice
  // reads as two messages. Bounded, because this outlives the tab's day.
  const seen = useRef<string[]>([]);

  return useCallback(
    (payload: ChangePayload) => {
      if (payload.table !== "messages" || payload.eventType !== "INSERT") return;
      const row = payload.new as Partial<Message>;
      if (!row.id || !row.sender_id || row.sender_id === meId) return;
      if (seen.current.includes(row.id)) return;
      seen.current = [row.id, ...seen.current].slice(0, 50);

      // Group rows carry a null recipient; a DM's thread is its sender.
      const thread = row.recipient_id === null ? GROUP_THREAD : row.sender_id;
      const looking =
        document.visibilityState === "visible" && document.hasFocus();
      // The line landed in the thread they are reading. It is already on screen.
      if (looking && openThread === thread) return;

      chimeIfWanted();
      if (looking || getPrefs().permission !== "granted") return;

      const name = members[row.sender_id]?.name.split(" ")[0] ?? "Someone";
      const href = `/messages/${thread}`;
      showNotification({
        title: row.recipient_id === null ? `${name} · ${GROUP_LABEL}` : name,
        body: preview(row),
        tag: `kagu:chat:${thread}`,
        // router.push, not location — a click on a banner shouldn't cost a full
        // reload of an app that is already loaded behind it.
        onOpen: () => router.push(href),
      });
    },
    [meId, members, openThread, router]
  );
}
