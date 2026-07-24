"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, SendHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markThreadRead, sendMessage, type SendImageInput } from "@/lib/actions/messages";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALLOWED_IMAGE_TYPES,
  CHAT_THUMB_TRANSFORM,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LEN,
} from "@/lib/messages-shared";
import { cn } from "@/lib/utils";
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
  meId,
  otherId,
  members,
  initialUnread,
  audience,
  readMarkers,
}: {
  initialMessages: Message[];
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
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, { url: string; thumbUrl: string }>>({});
  const [lightbox, setLightbox] = useState<{ url: string; width: number | null; height: number | null } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const attachFileRef = useRef<HTMLInputElement>(null);
  // Scroll to the newest line even if the reader is scrolled up — set by MY
  // sends, which must always come into view.
  const forceScroll = useRef(false);
  const { error: toastError } = useToast();

  // Server refreshes re-send props — adopt during render (no stale flash).
  const [seen, setSeen] = useState(initialMessages);
  if (seen !== initialMessages) {
    setSeen(initialMessages);
    // Keep optimistic rows the server snapshot hasn't caught up to yet.
    setMessages((prev) => {
      const ids = new Set(initialMessages.map((m) => m.id));
      return [...initialMessages, ...prev.filter((m) => !ids.has(m.id))];
    });
  }

  const accepts = useMemo(() => {
    return (m: Message) =>
      otherId === null
        ? m.recipient_id === null
        : (m.sender_id === otherId && m.recipient_id === meId) ||
          (m.sender_id === meId && m.recipient_id === otherId);
  }, [otherId, meId]);

  // Opening the thread consumes its unread — and an incoming line while the
  // thread is on screen is read the moment it paints, so mark again then.
  // Skipped when there's nothing unread: markThreadRead revalidates the layout
  // (that's how the badge drops), and doing that on every quiet open would
  // flush the router cache for no reason.
  useEffect(() => {
    if (initialUnread) void markThreadRead(otherId);
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
            if (row.sender_id !== meId) void markThreadRead(otherId);
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
                  ? { ...m, images: [...(m.images ?? []).filter((i) => i.id !== img.id), img] }
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

  // Keep the newest line in view — instant on first paint, smooth after.
  // An INCOMING line only follows when the reader is already near the bottom;
  // yanking someone out of the history they scrolled up to read is worse than
  // letting the new line wait. My own sends always come into view.
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    const nearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight < 200
      : true;
    if (firstScroll.current || forceScroll.current || nearBottom) {
      endRef.current?.scrollIntoView({
        behavior: firstScroll.current ? "instant" : "smooth",
        block: "end",
      });
    }
    firstScroll.current = false;
    forceScroll.current = false;
  }, [messages]);

  // Sign every image path currently rendered, once per batch — merged into
  // the running map rather than replaced, since a chat's image set only
  // grows. Blob-preview paths (unsent attachments) are skipped: they render
  // straight from the local object URL, no signing needed.
  const imagePaths = useMemo(() => {
    const paths = new Set<string>();
    for (const m of messages) {
      for (const img of m.images ?? []) {
        if (!img.file_path.startsWith("blob:")) paths.add(img.file_path);
      }
    }
    return [...paths].filter((p) => !(p in signedUrls));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (imagePaths.length === 0) return;
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.storage.from("chat-images").createSignedUrls(imagePaths, 60 * 60),
      Promise.all(
        imagePaths.map((p) =>
          supabase.storage
            .from("chat-images")
            .createSignedUrl(p, 60 * 60, { transform: CHAT_THUMB_TRANSFORM })
        )
      ),
    ]).then(([full, thumbs]) => {
      if (cancelled || !full.data) return;
      const next: Record<string, { url: string; thumbUrl: string }> = {};
      imagePaths.forEach((p, idx) => {
        const url = full.data?.[idx]?.signedUrl ?? "";
        if (!url) return;
        next[p] = { url, thumbUrl: thumbs[idx]?.data?.signedUrl ?? url };
      });
      setSignedUrls((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [imagePaths]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  function imageView(img: MessageImage): { url: string; thumbUrl: string } {
    if (img.file_path.startsWith("blob:"))
      return { url: img.file_path, thumbUrl: img.file_path };
    return signedUrls[img.file_path] ?? { url: "", thumbUrl: "" };
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
      for (const a of pending) {
        const ext = (a.file.name.split(".").pop() ?? "png")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const path = `${meId}/${crypto.randomUUID()}.${ext || "png"}`;
        const { error } = await supabase.storage.from("chat-images").upload(path, a.file);
        if (error) throw new Error(error.message);
        uploaded.push({ path, width: a.width, height: a.height });
      }
      const result = await sendMessage(otherId, clean, uploaded);
      if (!result.ok) return fail(result.message);
      const row = result.row;
      if (!row) return;
      // Reconcile: the realtime INSERT may have landed (and swapped) first.
      setMessages((prev) =>
        prev.some((m) => m.id === row.id)
          ? prev.filter((m) => m.id !== tempId)
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
        className="min-h-0 flex-1 space-y-1 overflow-y-auto py-4 pr-1"
      >
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
                      {m.images.map((img) => {
                        const view = imageView(img);
                        if (!view.thumbUrl)
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
                            onClick={() => setLightbox({ ...view, width: img.width, height: img.height })}
                            className="block overflow-hidden rounded-md border border-line"
                            aria-label="View image full size"
                          >
                            <Image
                              src={view.thumbUrl}
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
