"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { Loader2, Reply } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  loadOlderMessages,
  sendMessage,
  type SendImageInput,
} from "@/lib/actions/messages";
import { READ_SLACK_PX, useReadMarker } from "@/lib/use-read-marker";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbox } from "@/components/ui/lightbox";
import {
  Composer,
  type Attachment,
  type ComposerHandle,
} from "@/components/messages/composer";
import { RichText } from "@/components/messages/rich-text";
import { CHAT_THUMB_TRANSFORM, chatImagePath } from "@/lib/messages-shared";
import { buttonClasses, cn } from "@/lib/utils";
import type { MembersMap, Message, MessageImage } from "@/lib/types";

/** Chat timestamps pin to Istanbul like every other domain date — the whole
 *  team is there, and two people must agree on when a thing was said. */
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});
const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Istanbul",
});
const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
});

/** Thumb token lifetime. Retired well before this — see RESIGN_AFTER_MS. */
const SIGN_TTL_S = 60 * 60;
/** Retire a thumb URL at 50 minutes so it is never served dead. */
const RESIGN_AFTER_MS = 50 * 60 * 1000;
/** How often to sweep for thumb URLs nearing expiry. */
const RESIGN_CHECK_MS = 5 * 60 * 1000;
/** Full-size URLs are minted in the click handler, so they need seconds only. */
const FULL_TTL_S = 60;

function firstName(members: MembersMap, id: string) {
  return (members[id]?.name ?? "Former member").split(" ")[0];
}

/** Everything about one bubble that doesn't change unless `messages` does. */
type Row = {
  m: Message;
  mine: boolean;
  newDay: boolean;
  dayLabel: string;
  newRun: boolean;
  lastInRun: boolean;
  timeLabel: string;
  seenLabel: string | null;
  senderName: string;
  senderColor: string | undefined;
};

/**
 * One live chat thread — a 1:1 when `otherId` is set, the Work-team group
 * chat when it's null.
 *
 * Realtime patches state IN PLACE (the debug board pattern), never
 * router.refresh — a chat that repaints the whole route per line would drop
 * composer focus mid-word. (The app shell used to defeat that from outside this
 * file; see chat-live-refresh.tsx.) The stream is already RLS-scoped to rows
 * this user may read; `accepts` narrows it to THIS thread, because the channel
 * hears every thread's traffic.
 *
 * Sends are optimistic (Parsa "fast" rule): the line lands in the list on
 * submit, reconciles with the server row, and rolls back + toasts on reject.
 */
export function MessageThread({
  initialMessages,
  initialHasOlder,
  readOnly = false,
  firstUnreadId = null,
  unreadCount = 0,
  meId,
  otherId,
  members,
  initialUnread,
  audience,
  readMarkers,
}: {
  initialMessages: Message[];
  /** Older history exists behind the first page — shows the "Show older" cue. */
  initialHasOlder: boolean;
  /** Readable but not writable — the partner has left the work team. */
  readOnly?: boolean;
  /** First line I hadn't read at open — where the "N new" divider sits. */
  firstUnreadId?: string | null;
  /** How many were unread at open, for the divider's label. */
  unreadCount?: number;
  meId: string;
  /** null = the group chat. */
  otherId: string | null;
  members: MembersMap;
  /** Whether this thread holds unread lines for me — decides the mount mark. */
  initialUnread: boolean;
  /** Group-chat audience (null for DMs) — who "seen by" is computed over. */
  audience: string[] | null;
  /** Group-chat last-read marker per user id (null for DMs). */
  readMarkers: Record<string, string> | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** path → signed THUMB url + when it was minted (for pre-expiry re-signing). */
  const [thumbs, setThumbs] = useState<
    Record<string, { url: string; at: number }>
  >({});
  const [lightbox, setLightbox] = useState<{
    url: string;
    width: number | null;
    height: number | null;
  } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  // Scroll to the newest line even if the reader is scrolled up — set by MY
  // sends, which must always come into view.
  const forceScroll = useRef(false);
  // Distance from the bottom to re-establish after a page of older history is
  // prepended. Prepending grows scrollHeight, so holding scrollTop would slide
  // the reader's place; holding the distance from the BOTTOM keeps it still.
  const restoreFromBottom = useRef<number | null>(null);
  const { error: toastError } = useToast();

  // Server refreshes re-send props — adopt during render (no stale flash).
  const [seen, setSeen] = useState(initialMessages);
  if (seen !== initialMessages) {
    setSeen(initialMessages);
    // A refresh re-sends only the NEWEST page, so this is a merge, not a
    // replacement: older pages the reader loaded and optimistic rows the
    // snapshot hasn't caught up to must both survive. Then sort — concatenating
    // would file older history AFTER newer lines. The fresh row wins (it
    // carries read_at flips) but keeps locally-held images if it has none,
    // exactly like the realtime UPDATE handler below.
    setMessages((prev) => {
      const fresh = new Map(initialMessages.map((m) => [m.id, m]));
      const merged = prev.map((m) => {
        const next = fresh.get(m.id);
        return next ? { ...next, images: next.images ?? m.images } : m;
      });
      const held = new Set(prev.map((m) => m.id));
      for (const m of initialMessages) if (!held.has(m.id)) merged.push(m);
      return merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }

  const accepts = useMemo(() => {
    return (m: Message) =>
      otherId === null
        ? m.recipient_id === null
        : (m.sender_id === otherId && m.recipient_id === meId) ||
          (m.sender_id === meId && m.recipient_id === otherId);
  }, [otherId, meId]);

  /**
   * Is the newest line actually on screen? The read marker and the auto-scroll
   * policy now share ONE rule. They used to disagree: the scroll policy
   * deliberately left an incoming line alone when the reader was scrolled up,
   * while the marker told the sender it had been seen.
   */
  const nearBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < READ_SLACK_PX;
  }, []);

  // A mark needs real attention (tab visible + focused + newest line on screen)
  // and coalesces a burst into one round trip. See use-read-marker.ts.
  const { mark, markNow, flush: flushRead } = useReadMarker(otherId, nearBottom);
  // Held in a ref so the realtime subscription below doesn't take it as a
  // dependency and re-subscribe.
  const markRef = useRef(mark);
  useEffect(() => {
    markRef.current = mark;
  }, [mark]);

  // Opening the thread consumes its unread. Skipped when there's nothing unread:
  // marking refreshes the tree (that's how the badge drops), and doing that on
  // every quiet open would be a server round trip for nothing.
  useEffect(() => {
    // markNow, not mark: opening a thread IS reading it, and the "N new" divider
    // means we deliberately don't land at the bottom, so the near-bottom gate
    // would hold the mark exactly when there is something to clear.
    if (initialUnread) markNow();
    // Mount-only by design — later unreads are handled by the INSERT stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      // Authorize the socket as this user, or the RLS stream delivers nothing.
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`messages-${otherId ?? "team"}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as Message;
            if (!accepts(row)) return;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              // My own line can stream in BEFORE sendMessage resolves — swap
              // it into the matching optimistic temp instead of appending, or
              // the message doubles for a beat until the action reconciles.
              if (row.sender_id === meId) {
                const temp = prev.find(
                  (m) => m.id.startsWith("temp-") && m.body === row.body
                );
                if (temp)
                  return prev.map((m) =>
                    m.id === temp.id ? { ...row, images: m.images } : m
                  );
              }
              return [...prev, row];
            });
            // Requests a mark; the helper decides whether the reader is actually
            // present, and coalesces a burst of lines into one round trip.
            if (row.sender_id !== meId) markRef.current();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as Message;
            if (!accepts(row)) return;
            setMessages((prev) =>
              prev.map((m) => (m.id === row.id ? { ...row, images: m.images } : m))
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message_images" },
          (payload) => {
            // A message's images can land a beat after the message row
            // itself — patch them into whichever bubble is already showing.
            const img = payload.new as MessageImage;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === img.message_id
                  ? {
                      ...m,
                      images: [
                        // A real row SUPERSEDES this send's local blob previews.
                        // Appending alongside them showed your own image twice —
                        // and the blob copy was revoked a moment later, so one of
                        // the two turned into a broken thumbnail.
                        ...(m.images ?? []).filter(
                          (i) =>
                            i.id !== img.id && !i.file_path.startsWith("blob:")
                        ),
                        img,
                      ],
                    }
                  : m
              )
            );
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [otherId, meId, accepts]);

  // Put the reader back where they were after older history is prepended.
  // Runs BEFORE the scroll effect below (layout effects go first), so that one
  // then measures the restored position and correctly decides not to scroll.
  useLayoutEffect(() => {
    const el = listRef.current;
    const fromBottom = restoreFromBottom.current;
    if (!el || fromBottom === null) return;
    restoreFromBottom.current = null;
    el.scrollTop = el.scrollHeight - fromBottom;
  }, [messages]);

  // Frozen at mount — state, not a ref, because the render reads it. The divider
  // has to survive the mark-as-read that follows immediately after open, and
  // every server refresh after that; otherwise the one thing telling you where
  // you left off vanishes as you look at it. Never updated after mount, so the
  // initialiser is the whole story.
  const [unreadAnchorId, setUnreadAnchorId] = useState(firstUnreadId);
  const [unreadAtOpen] = useState(unreadCount);
  const unreadRef = useRef<HTMLDivElement>(null);

  /**
   * Retire the divider once the reader has actually caught up.
   *
   * It is frozen against server refreshes on purpose, but it must not become a
   * lie: a line reading "1 new message" above a message you have just read and
   * scrolled past is stale furniture. With a single unread the open scroll
   * already lands at the bottom, so it clears immediately — which is right,
   * because a divider earns its place at fourteen unread, not at one.
   */
  const retireDivider = useCallback(() => {
    if (unreadAnchorId && nearBottom()) setUnreadAnchorId(null);
  }, [unreadAnchorId, nearBottom]);

  // Keep the right thing in view. On first paint that's the "N new" divider if
  // there is one, and the newest line otherwise. After that: an INCOMING line
  // only follows when the reader is already near the bottom — yanking someone out
  // of the history they scrolled up to read is worse than letting the new line
  // wait. My own sends always come into view.
  const firstScroll = useRef(true);
  useEffect(() => {
    // A JS scroll behavior is out of reach of the global reduced-motion CSS kill
    // switch, so it has to ask for itself.
    const calm =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (firstScroll.current) {
      firstScroll.current = false;
      forceScroll.current = false;
      if (unreadRef.current) {
        unreadRef.current.scrollIntoView({ behavior: "instant", block: "center" });
        // Checked here as well as on scroll: a thread short enough not to
        // overflow fires no scroll event at all, and its divider would stick.
        retireDivider();
        return;
      }
      endRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
      return;
    }

    if (forceScroll.current || nearBottom()) {
      endRef.current?.scrollIntoView({
        behavior: calm ? "instant" : "smooth",
        block: "end",
      });
    }
    forceScroll.current = false;
  }, [messages, nearBottom, retireDivider]);

  /**
   * Thumbnails only. The full-size URL is signed AT CLICK in `openLightbox`,
   * which is the house rule (`ui/signed-file-link.tsx`) and also deletes one
   * request per image from thread open — a full-size URL is useless unless
   * someone actually opens the lightbox.
   *
   * Two things this has to get right, both of which it used to get wrong:
   *
   *  - **Key on CONTENT, not identity.** `imagePaths` is a fresh array on every
   *    `messages` change, and the effect used to depend on the array itself, so
   *    every arriving message cancelled the in-flight wave and started over.
   *    A wave costs ~850ms, so a thread receiving lines faster than that never
   *    resolved a single thumbnail — permanent grey Skeletons. Same fix as
   *    `debug/task-images.tsx`: depend on the joined string.
   *  - **Don't cancel a wave just because a new path appeared.** In-flight paths
   *    are tracked in a ref and excluded from the next batch, so a new image
   *    EXTENDS the work instead of restarting it. Only unmount abandons results.
   */
  const inFlight = useRef<Set<string>>(new Set());
  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const imagePaths = useMemo(() => {
    const paths = new Set<string>();
    for (const m of messages) {
      for (const img of m.images ?? []) {
        // Unsent attachments render straight from their local object URL.
        if (!img.file_path.startsWith("blob:")) paths.add(img.file_path);
      }
    }
    return [...paths].filter((p) => !(p in thumbs));
  }, [messages, thumbs]);
  const pathKey = imagePaths.join("|");

  useEffect(() => {
    if (!pathKey) return;
    // The in-flight set is read HERE, not in the memo above — a ref may not be
    // read during render. Filtering here is what makes a newly arrived image
    // extend the work instead of re-requesting whatever is already on the wire.
    const paths = pathKey.split("|").filter((p) => !inFlight.current.has(p));
    if (paths.length === 0) return;
    for (const p of paths) inFlight.current.add(p);
    const supabase = createClient();
    void (async () => {
      const signed = await Promise.all(
        paths.map((p) =>
          supabase.storage
            .from("chat-images")
            .createSignedUrl(p, SIGN_TTL_S, { transform: CHAT_THUMB_TRANSFORM })
            .then((r) => [p, r.data?.signedUrl ?? ""] as const)
        )
      );
      for (const p of paths) inFlight.current.delete(p);
      if (!mounted.current) return;
      const at = Date.now();
      setThumbs((prev) => {
        const next = { ...prev };
        for (const [p, url] of signed) if (url) next[p] = { url, at };
        return next;
      });
    })();
  }, [pathKey]);

  // A signing token dies an hour after it is minted, and these live in client
  // state. A tab left open past that rendered broken images with no recovery
  // path, so entries are retired before they can expire — dropping one makes it
  // eligible for `imagePaths` again and the effect above re-signs it.
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - RESIGN_AFTER_MS;
      setThumbs((prev) => {
        const live = Object.entries(prev).filter(([, v]) => v.at >= cutoff);
        return live.length === Object.keys(prev).length
          ? prev
          : Object.fromEntries(live);
      });
    }, RESIGN_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  /** The thumbnail to render — empty string until its token has been minted. */
  function thumbUrl(img: MessageImage) {
    if (img.file_path.startsWith("blob:")) return img.file_path;
    return thumbs[img.file_path]?.url ?? "";
  }

  /**
   * Full-size URLs are signed HERE, in the click — the house rule from
   * `ui/signed-file-link.tsx`. A URL minted during render outlives its own token
   * in a tab left open, and the click then lands on an expired JWT, which reads
   * to the user as "the image is broken".
   */
  async function openLightbox(img: MessageImage) {
    if (img.file_path.startsWith("blob:")) {
      setLightbox({ url: img.file_path, width: img.width, height: img.height });
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("chat-images")
      .createSignedUrl(img.file_path, FULL_TTL_S);
    if (error || !data?.signedUrl) {
      toastError("Couldn't open that image. Please try again.");
      return;
    }
    setLightbox({ url: data.signedUrl, width: img.width, height: img.height });
  }

  /**
   * Per-bubble derived values, computed ONCE per message-list change.
   *
   * This all used to happen inline in the render body: several `new Date()` and
   * `Intl` format calls per row, redone from scratch on every render — including
   * renders that had nothing to do with the messages (opening the lightbox, a
   * thumbnail URL arriving).
   */
  const rows = useMemo<Row[]>(() => {
    const dayKeys = messages.map((m) =>
      DAY_KEY.format(new Date(m.created_at))
    );
    return messages.map((m, i) => {
      const prevMsg = messages[i - 1];
      const nextMsg = messages[i + 1];
      const mine = m.sender_id === meId;
      const newDay = !prevMsg || dayKeys[i - 1] !== dayKeys[i];
      const nextIsNewDay = !nextMsg || dayKeys[i + 1] !== dayKeys[i];
      // First line of a run of one person's messages.
      const newRun = newDay || !prevMsg || prevMsg.sender_id !== m.sender_id;
      // The LAST line of a run is where a read receipt renders — once per
      // burst, not once per bubble.
      const lastInRun =
        nextIsNewDay || !nextMsg || nextMsg.sender_id !== m.sender_id;

      let seenLabel: string | null = null;
      if (mine && otherId !== null) {
        // Only on the last line of a run, and never "Sent" — every bubble
        // carrying a permanent status suffix was noise, and "Sent" restated
        // what the bubble's existence already says.
        if (lastInRun && m.read_at)
          seenLabel = `Seen ${TIME.format(new Date(m.read_at))}`;
      } else if (mine && otherId === null && lastInRun && audience && readMarkers) {
        const others = audience.filter((id) => id !== meId);
        const seenBy = others.filter(
          (id) => readMarkers[id] && readMarkers[id] > m.created_at
        );
        seenLabel =
          seenBy.length === 0
            ? null
            : seenBy.length === others.length
              ? "Seen by everyone"
              : `Seen by ${seenBy.map((id) => firstName(members, id)).join(", ")}`;
      }

      return {
        m,
        mine,
        newDay,
        dayLabel: DAY.format(new Date(m.created_at)),
        newRun,
        lastInRun,
        timeLabel: TIME.format(new Date(m.created_at)),
        seenLabel,
        senderName: members[m.sender_id]?.name ?? "Former member",
        senderColor: members[m.sender_id]?.color,
      };
    });
  }, [messages, meId, otherId, members, audience, readMarkers]);

  // Which `@word` tokens are real people, for highlighting. Built from the whole
  // members map rather than the audience, so a name still reads as a mention
  // after someone leaves the team.
  const mentionNames = useMemo(
    () =>
      new Set(
        Object.values(members).map((m) => m.name.split(" ")[0]!.toLowerCase())
      ),
    [members]
  );
  const myFirstName = useMemo(
    () => members[meId]?.name.split(" ")[0]?.toLowerCase(),
    [members, meId]
  );

  /**
   * Who the @ menu can offer. The group chat's audience minus me; undefined in a
   * DM, which turns the `@` key back into ordinary text.
   */
  const mentionable = useMemo(() => {
    if (otherId !== null || !audience) return undefined;
    return audience
      .filter((id) => id !== meId && members[id])
      .map((id) => ({ id, name: members[id]!.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [otherId, audience, members, meId]);

  // Walk backwards through history one page at a time. The cursor is the oldest
  // REAL row we hold — a temp row carries a client clock and would be a false
  // floor.
  async function loadOlder() {
    if (loadingOlder || !hasOlder) return;
    const oldest = messages.find((m) => !m.id.startsWith("temp-"));
    if (!oldest) return;
    const el = listRef.current;
    if (el) restoreFromBottom.current = el.scrollHeight - el.scrollTop;
    setLoadingOlder(true);
    try {
      const result = await loadOlderMessages(otherId, oldest.created_at);
      if (!result.ok || !result.messages) {
        restoreFromBottom.current = null;
        toastError(result.message);
        return;
      }
      const older = result.messages;
      setHasOlder(result.hasOlder ?? false);
      // Decided out here, not in the updater: if nothing new arrived the list
      // identity won't change, the layout effect won't run, and a pending
      // restore would fire on some LATER change and jerk the reader.
      const held = new Set(messages.map((m) => m.id));
      if (older.every((m) => held.has(m.id))) {
        restoreFromBottom.current = null;
        return;
      }
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !ids.has(m.id)), ...prev];
      });
    } catch (e) {
      restoreFromBottom.current = null;
      toastError(
        e instanceof Error ? e.message : "Could not load older messages."
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  /**
   * One click on a bubble's reply control: quote the line into the composer
   * and put the cursor after it, ready for the answer. A visible `> Name: …`
   * line rather than a thread model — the messages table is flat, and a quote
   * that travels in the body works everywhere the body does (exports, search,
   * the other person's phone). RichText renders `> ` lines as a quote.
   */
  function startReply(r: Row) {
    const firstLine = r.m.body.split("\n").find((l) => l.trim()) ?? "";
    const snippet =
      firstLine.length > 90
        ? `${firstLine.slice(0, 90).trimEnd()}…`
        : firstLine || "(image)";
    composerRef.current?.quote(
      `> ${firstName(members, r.m.sender_id)}: ${snippet}`
    );
  }

  // No `sending` gate: sends PIPELINE. Each line gets its own temp row and its
  // own reconcile, so a quick second message never waits on the first one's
  // round-trip — the composer clears and you keep typing.
  async function handleSend(
    clean: string,
    pending: Attachment[],
    mentions: string[] = []
  ) {
    if (!clean && pending.length === 0) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const temp: Message = {
      id: tempId,
      sender_id: meId,
      recipient_id: otherId,
      body: clean,
      read_at: null,
      created_at: now,
      images: pending.map((a, i) => ({
        id: `${tempId}-img-${i}`,
        message_id: tempId,
        file_path: a.previewUrl,
        width: a.width,
        height: a.height,
        created_at: now,
      })),
    };
    forceScroll.current = true;
    setMessages((prev) => [...prev, temp]);

    const fail = (message: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // Hand the words back — the composer refuses to overwrite new typing.
      composerRef.current?.restore(clean, pending);
      toastError(message);
    };

    try {
      const supabase = createClient();
      // Four attachments used to upload one after another before the message was
      // sent at all, so a 4-image send waited on four serial round trips.
      const uploaded: SendImageInput[] = await Promise.all(
        pending.map(async (a) => {
          // Key from the MIME TYPE, not the filename — see chatImagePath.
          const path = chatImagePath(meId, crypto.randomUUID(), a.file.type);
          const { error } = await supabase.storage
            .from("chat-images")
            .upload(path, a.file, {
              // Explicit rather than inferred from the multipart Blob.
              contentType: a.file.type,
              upsert: false,
            });
          if (error) throw new Error(error.message);
          return { path, width: a.width, height: a.height };
        })
      );
      const result = await sendMessage(otherId, clean, uploaded, mentions);
      if (!result.ok) return fail(result.message);
      if (result.warning) toastError(result.warning);
      const row = result.row;
      // No row on an ok result shouldn't happen, but leaving the temp on screen
      // forever if it did would be a silent stuck bubble — drop it and let the
      // realtime INSERT or the next refresh supply the real one.
      if (!row) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      // Reconcile: the realtime INSERT may have landed (and swapped) first.
      setMessages((prev) =>
        prev.some((m) => m.id === row.id)
          ? prev
              .filter((m) => m.id !== tempId)
              // The swapped-in row is still holding this send's blob previews
              // (they were kept to avoid a flash); the returned row carries the
              // real image rows, and those blob URLs are about to be revoked.
              .map((m) =>
                m.id === row.id && row.images?.length
                  ? { ...m, images: row.images }
                  : m
              )
          : prev.map((m) => (m.id === tempId ? row : m))
      );
    } catch (e) {
      fail(
        e instanceof Error ? e.message : "Something went wrong. Please try again."
      );
    } finally {
      for (const a of pending) URL.revokeObjectURL(a.previewUrl);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        // Scrolling back down to the newest line is what makes a held read mark
        // true, so every scroll gives the marker a chance to flush. `flushRead`
        // is a no-op when nothing is pending.
        onScroll={() => {
          flushRead();
          retireDivider();
        }}
        // role="log" makes arriving lines announce themselves — the transcript
        // used to be an inert stack of divs, so a screen-reader user was never
        // told a message had come in. `additions` keeps it to new bubbles rather
        // than re-reading the history on every patch.
        role="log"
        aria-relevant="additions"
        aria-label="Conversation"
        // Overflow containers aren't focusable in Safari, so the history was
        // unreachable by keyboard entirely.
        tabIndex={0}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto py-4 pr-1 focus-visible:outline-none"
      >
        {hasOlder && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className={buttonClasses("ghost", "sm")}
            >
              {loadingOlder ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Loading older
                </>
              ) : (
                "Show older messages"
              )}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-faint">
            {otherId === null
              ? "Nothing yet. Say something to the team."
              : "Nothing yet. Say hi."}
          </p>
        )}
        {rows.map((r) => (
          <div key={r.m.id}>
            {r.m.id === unreadAnchorId && (
              <div
                ref={unreadRef}
                className="flex items-center gap-3 py-3"
                // Announced, because for a screen-reader user this is the only
                // thing that says where the new material starts.
                role="separator"
              >
                <div className="h-px flex-1 bg-primary-dim/40" aria-hidden />
                <span className="whitespace-nowrap text-xs font-medium text-primary-dim">
                  {unreadAtOpen === 1
                    ? "1 new message"
                    : `${unreadAtOpen} new messages`}
                </span>
                <div className="h-px flex-1 bg-primary-dim/40" aria-hidden />
              </div>
            )}
            {r.newDay && (
              <div className="flex items-center gap-3 py-3">
                <div className="h-px flex-1 bg-line" aria-hidden />
                {/* Not aria-hidden: hiding it removed every date boundary from
                    the transcript, so a whole history read as one flat run. */}
                <span className="font-mono text-xs text-faint">
                  {r.dayLabel}
                </span>
                <div className="h-px flex-1 bg-line" aria-hidden />
              </div>
            )}
            <div
              className={cn(
                "flex flex-col",
                r.mine ? "items-end" : "items-start",
                r.newRun && !r.newDay && "mt-2.5"
              )}
            >
              {r.newRun && otherId === null && !r.mine && (
                <span
                  className="px-1 pb-0.5 text-xs font-medium"
                  style={{ color: r.senderColor }}
                >
                  {r.senderName}
                </span>
              )}
              {/* The bubble plus its reply control share a hover group, so the
                  control lives beside the bubble (on its open side) and only
                  surfaces when the pointer is already there — the same
                  reveal-on-hover the reminders panel uses for its remove
                  button. `w-full` keeps the bubble's 88% measured against the
                  pane, exactly as it was before the wrapper existed. */}
              <div
                className={cn(
                  "group flex w-full items-center gap-1",
                  r.mine && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    // 34rem caps the measure at roughly the 70ch prose limit
                    // on a wide screen. The percentage is what matters on a
                    // phone: at 75% a 375px viewport gave a ~36ch line and
                    // stranded an 85px gutter, so it reads wider there while
                    // the rem cap still governs the desktop.
                    "flex max-w-[min(88%,34rem)] flex-col gap-1.5 rounded-lg px-3 py-1.5",
                    // Shape, not just fill, carries mine-vs-theirs: the two
                    // fills are 1.14:1 and 1.05:1 against the page, which is
                    // no contrast at all. An asymmetric corner reads at any
                    // luminance, and side-stripe borders are banned.
                    r.mine
                      ? "rounded-br-sm bg-raised text-ink"
                      : "rounded-bl-sm border border-line-strong bg-surface text-ink"
                  )}
                >
                  {/* In a DM the sender is conveyed by ALIGNMENT only, which
                      does not exist for a screen reader. Named here,
                      invisibly. */}
                  {otherId !== null && r.newRun && (
                    <span className="sr-only">
                      {r.mine ? "You" : r.senderName}:
                    </span>
                  )}
                  {r.m.body && (
                    <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                      <RichText
                        body={r.m.body}
                        mentionNames={mentionNames}
                        myName={myFirstName}
                      />
                    </p>
                  )}
                  {r.m.images && r.m.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.m.images.map((img, idx) => {
                        const src = thumbUrl(img);
                        if (!src)
                          return (
                            <Skeleton
                              key={img.id}
                              className="h-28 w-36 border border-line"
                            />
                          );
                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => void openLightbox(img)}
                            className="block overflow-hidden rounded-md border border-line transition-colors duration-150 hover:border-line-strong"
                            // Every thumbnail in a bubble used to share one
                            // label, so a rotor listed N identical entries.
                            aria-label={
                              (r.m.images?.length ?? 1) > 1
                                ? `View image ${idx + 1} of ${r.m.images?.length} full size`
                                : "View image full size"
                            }
                          >
                            <Image
                              src={src}
                              alt=""
                              width={img.width ?? 240}
                              height={img.height ?? 160}
                              unoptimized
                              className="h-28 w-auto max-w-56 object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Hidden in a read-only thread — a reply cue above a closed
                    composer would be an invitation to nowhere. */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => startReply(r)}
                    aria-label={`Reply to ${r.mine ? "your message" : r.senderName}`}
                    title="Reply"
                    className="shrink-0 rounded-md p-1 text-faint opacity-0 transition-opacity duration-150 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Reply className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <span className="px-1 pt-0.5 font-mono text-xs text-faint">
                {r.timeLabel}
                {r.seenLabel ? ` · ${r.seenLabel}` : ""}
              </span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {readOnly ? (
        <div className="border-t border-line pt-3">
          <p className="py-2 text-center text-[13px] text-faint">
            This conversation is closed —{" "}
            {members[otherId ?? ""]?.name ?? "they"} is no longer on the work
            team.
          </p>
        </div>
      ) : (
        <Composer
          ref={composerRef}
          onSend={handleSend}
          autoFocus
          draftKey={`kagu:draft:${otherId ?? "team"}`}
          // Group chat only: a DM's recipient is notified anyway, so @ there
          // would just be a second bell for the same message.
          mentionable={mentionable}
        />
      )}

      {lightbox && (
        <Lightbox
          url={lightbox.url}
          width={lightbox.width}
          height={lightbox.height}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
