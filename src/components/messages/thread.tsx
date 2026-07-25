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
import { ImagePlus, Loader2, SendHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  loadOlderMessages,
  sendMessage,
  type SendImageInput,
} from "@/lib/actions/messages";
import { READ_SLACK_PX, useReadMarker } from "@/lib/use-read-marker";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALLOWED_IMAGE_TYPES,
  CHAT_THUMB_TRANSFORM,
  chatImagePath,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LEN,
} from "@/lib/messages-shared";
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

type Attachment = {
  file: File;
  previewUrl: string;
  width: number | null;
  height: number | null;
};

/** Natural size of a picked file, so a thumbnail can reserve its box. */
function measure(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function firstName(members: MembersMap, id: string) {
  return (members[id]?.name ?? "Former member").split(" ")[0];
}

/**
 * One live chat thread — a 1:1 when `otherId` is set, the Work-team group
 * chat when it's null.
 *
 * Realtime patches state IN PLACE (the debug board pattern), never
 * router.refresh — a chat that repaints the whole route per line would drop
 * composer focus mid-word. The stream is already RLS-scoped to rows this user
 * may read; `accepts` narrows it to THIS thread, because the channel hears
 * every thread's traffic.
 *
 * Sends are optimistic (Parsa "fast" rule): the line lands in the list on
 * submit, reconciles with the server row, and rolls back + toasts on reject.
 */
export function MessageThread({
  initialMessages,
  initialHasOlder,
  readOnly = false,
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
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  /** path → signed THUMB url + when it was minted (for pre-expiry re-signing). */
  const [thumbs, setThumbs] = useState<
    Record<string, { url: string; at: number }>
  >({});
  const [lightbox, setLightbox] = useState<{ url: string; width: number | null; height: number | null } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const attachFileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
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
  const { mark, flush: flushRead } = useReadMarker(otherId, nearBottom);
  // Held in a ref so the realtime subscription below doesn't take it as a
  // dependency and re-subscribe.
  const markRef = useRef(mark);
  useEffect(() => {
    markRef.current = mark;
  }, [mark]);

  // Opening the thread consumes its unread. Skipped when there's nothing unread:
  // marking revalidates the layout (that's how the badge drops), and doing that
  // on every quiet open would flush the router cache for no reason.
  useEffect(() => {
    if (initialUnread) mark();
    // Mount-only by design — later unreads are handled by the INSERT stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening a chat should put the cursor where you are about to type. Guarded on
  // visibility so a tab restored in the background doesn't steal focus. Runs
  // once per mount, and the component remounts per thread, so this fires on
  // every open.
  useEffect(() => {
    if (!readOnly && document.visibilityState === "visible")
      composerRef.current?.focus();
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

  // Keep the newest line in view — instant on first paint, smooth after.
  // An INCOMING line only follows when the reader is already near the bottom;
  // yanking someone out of the history they scrolled up to read is worse than
  // letting the new line wait. My own sends always come into view.
  const firstScroll = useRef(true);
  useEffect(() => {
    if (firstScroll.current || forceScroll.current || nearBottom()) {
      // A JS scroll behavior is out of reach of the global reduced-motion CSS
      // kill switch, so it has to ask for itself.
      const calm =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      endRef.current?.scrollIntoView({
        behavior: firstScroll.current || calm ? "instant" : "smooth",
        block: "end",
      });
    }
    firstScroll.current = false;
    forceScroll.current = false;
  }, [messages, nearBottom]);

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

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES_PER_MESSAGE - attachments.length;
    if (room <= 0) {
      toastError(`A message can carry ${MAX_IMAGES_PER_MESSAGE} images.`);
      return;
    }
    const picked = Array.from(files);
    if (picked.length > room) {
      toastError(
        `Only ${room} more image${room === 1 ? "" : "s"} fit — the rest were skipped.`
      );
    }
    const added: Attachment[] = [];
    for (const file of picked.slice(0, room)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toastError(`${file.name} isn't a PNG, JPEG, WebP or GIF.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toastError(`${file.name} is over 5MB.`);
        continue;
      }
      const size = await measure(file);
      added.push({
        file,
        previewUrl: URL.createObjectURL(file),
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
    }
    if (added.length > 0) setAttachments((prev) => [...prev, ...added]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

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

  // No `sending` gate: sends PIPELINE. Each line gets its own temp row and its
  // own reconcile, so a quick second message never waits on the first one's
  // round-trip — the composer clears and you keep typing.
  async function send() {
    const clean = draft.trim();
    if (!clean && attachments.length === 0) return;
    const pending = attachments;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const temp: Message = {
      id: tempId,
      sender_id: meId,
      recipient_id: otherId,
      body: clean,
      read_at: null,
      created_at: new Date().toISOString(),
      images: pending.map((a, i) => ({
        id: `${tempId}-img-${i}`,
        message_id: tempId,
        file_path: a.previewUrl,
        width: a.width,
        height: a.height,
        created_at: new Date().toISOString(),
      })),
    };
    forceScroll.current = true;
    setMessages((prev) => [...prev, temp]);
    setDraft("");
    setAttachments([]);
    if (attachFileRef.current) attachFileRef.current.value = "";

    const fail = (message: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // Hand the words back — unless they've already typed something new,
      // which must never be overwritten.
      setDraft((d) => (d.trim() ? d : clean));
      setAttachments(pending);
      toastError(message);
    };

    try {
      const supabase = createClient();
      const uploaded: SendImageInput[] = [];
      // Four attachments used to upload one after another before the message was
      // sent at all, so a 4-image send waited on four serial round trips.
      const results = await Promise.all(
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
      uploaded.push(...results);
      const result = await sendMessage(otherId, clean, uploaded);
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
      fail(e instanceof Error ? e.message : "Something went wrong. Please try again.");
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
        onScroll={flushRead}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto py-4 pr-1"
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
        {messages.map((m, i) => {
          const mine = m.sender_id === meId;
          const prevMsg = messages[i - 1];
          const nextMsg = messages[i + 1];
          const newDay =
            !prevMsg ||
            DAY_KEY.format(new Date(prevMsg.created_at)) !==
              DAY_KEY.format(new Date(m.created_at));
          const nextIsNewDay =
            !nextMsg ||
            DAY_KEY.format(new Date(nextMsg.created_at)) !==
              DAY_KEY.format(new Date(m.created_at));
          // Name the sender on the first line of a run (group chat only —
          // a 1:1 has exactly one other voice).
          const newRun = newDay || !prevMsg || prevMsg.sender_id !== m.sender_id;
          // The LAST line of a run of my own group-chat sends is where "seen
          // by" renders — once per burst, not once per bubble.
          const lastInRun =
            nextIsNewDay || !nextMsg || nextMsg.sender_id !== m.sender_id;
          const sender = members[m.sender_id];

          let seenLabel: string | null = null;
          if (mine && otherId !== null) {
            seenLabel = m.read_at ? `Seen ${TIME.format(new Date(m.read_at))}` : "Sent";
          } else if (mine && otherId === null && lastInRun && audience && readMarkers) {
            const others = audience.filter((id) => id !== meId);
            const seenBy = others.filter(
              (id) => readMarkers[id] && readMarkers[id] > m.created_at
            );
            seenLabel =
              seenBy.length === 0
                ? others.length > 0
                  ? `Not seen by ${others.map((id) => firstName(members, id)).join(", ")}`
                  : null
                : seenBy.length === others.length
                  ? "Seen by everyone"
                  : `Seen by ${seenBy.map((id) => firstName(members, id)).join(", ")}`;
          }

          return (
            <div key={m.id}>
              {newDay && (
                <div className="flex items-center gap-3 py-3" aria-hidden>
                  <div className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[11px] text-faint">
                    {DAY.format(new Date(m.created_at))}
                  </span>
                  <div className="h-px flex-1 bg-line" />
                </div>
              )}
              <div
                className={cn(
                  "flex flex-col",
                  mine ? "items-end" : "items-start",
                  newRun && !newDay && "mt-2.5"
                )}
              >
                {newRun && otherId === null && !mine && (
                  <span
                    className="px-1 pb-0.5 text-[11px] font-medium"
                    style={{ color: sender?.color }}
                  >
                    {sender?.name ?? "Former member"}
                  </span>
                )}
                <div
                  className={cn(
                    "flex max-w-[min(75%,34rem)] flex-col gap-1.5 rounded-lg px-3 py-1.5",
                    mine
                      ? "bg-raised text-ink"
                      : "border border-line bg-surface text-ink"
                  )}
                >
                  {m.body && (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {m.body}
                    </p>
                  )}
                  {m.images && m.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.images.map((img, idx) => {
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
                            className="block overflow-hidden rounded-md border border-line"
                            // Every thumbnail in a bubble used to share one
                            // label, so a rotor listed N identical entries.
                            aria-label={
                              (m.images?.length ?? 1) > 1
                                ? `View image ${idx + 1} of ${m.images?.length} full size`
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
                <span className="px-1 pt-0.5 font-mono text-[10px] text-faint">
                  {TIME.format(new Date(m.created_at))}
                  {seenLabel ? ` · ${seenLabel}` : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {readOnly ? (
        <div className="border-t border-line pt-3">
          <p className="py-2 text-center text-[13px] text-faint">
            This conversation is closed — {members[otherId ?? ""]?.name ?? "they"}{" "}
            is no longer on the work team.
          </p>
        </div>
      ) : (
      <div className="border-t border-line pt-3">
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <li key={a.previewUrl} className="group relative">
                <Image
                  src={a.previewUrl}
                  alt=""
                  width={a.width ?? 160}
                  height={a.height ?? 100}
                  unoptimized
                  className="h-16 w-auto max-w-32 rounded-md border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label="Remove image"
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-faint transition-colors duration-150 hover:text-danger"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div
          className="flex items-end gap-2"
          // Ctrl+V a screenshot straight into the composer — scoped to this
          // container so it never hijacks a paste meant for the textarea's
          // text (a paste carrying no files falls through untouched).
          onPaste={(e) => {
            const files = e.clipboardData?.files;
            if (!files || files.length === 0) return;
            e.preventDefault();
            addFiles(files);
          }}
        >
          <input
            ref={attachFileRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => attachFileRef.current?.click()}
            disabled={attachments.length >= MAX_IMAGES_PER_MESSAGE}
            aria-label="Attach image"
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line text-faint transition-colors duration-150 hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            <ImagePlus className="size-4" aria-hidden />
          </button>
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — scoped to this
              // textarea only, nothing global.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={MAX_MESSAGE_LEN}
            placeholder="Write a message…"
            aria-label="Write a message"
            className="max-h-40 min-h-9 flex-1 resize-none rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-faint transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim() && attachments.length === 0}
            aria-label="Send"
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
          >
            <SendHorizontal className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 grid animate-overlay-in place-items-center bg-black/80 p-6"
        >
          <Image
            src={lightbox.url}
            alt=""
            width={lightbox.width ?? 1200}
            height={lightbox.height ?? 800}
            unoptimized
            className="max-h-full w-auto max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
