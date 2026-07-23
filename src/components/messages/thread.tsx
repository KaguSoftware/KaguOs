"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markThreadRead, sendMessage } from "@/lib/actions/messages";
import { useToast } from "@/components/ui/toast";
import { MAX_MESSAGE_LEN } from "@/lib/messages-shared";
import { cn } from "@/lib/utils";
import type { MembersMap, Message } from "@/lib/types";

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
}: {
  initialMessages: Message[];
  meId: string;
  /** null = the group chat. */
  otherId: string | null;
  members: MembersMap;
  /** Whether this thread holds unread lines for me — decides the mount mark. */
  initialUnread: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
                  return prev.map((m) => (m.id === temp.id ? row : m));
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
              prev.map((m) => (m.id === row.id ? row : m))
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

  // No `sending` gate: sends PIPELINE. Each line gets its own temp row and its
  // own reconcile, so a quick second message never waits on the first one's
  // round-trip — the composer clears and you keep typing.
  function send() {
    const clean = draft.trim();
    if (!clean) return;
    const temp: Message = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender_id: meId,
      recipient_id: otherId,
      body: clean,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    forceScroll.current = true;
    setMessages((prev) => [...prev, temp]);
    setDraft("");
    const fail = (message: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      // Hand the words back — unless they've already typed something new,
      // which must never be overwritten.
      setDraft((d) => (d.trim() ? d : clean));
      toastError(message);
    };
    sendMessage(otherId, clean)
      .then((result) => {
        if (!result.ok) return fail(result.message);
        const row = result.row;
        if (!row) return;
        // Reconcile: the realtime INSERT may have landed (and swapped) first.
        setMessages((prev) =>
          prev.some((m) => m.id === row.id)
            ? prev.filter((m) => m.id !== temp.id)
            : prev.map((m) => (m.id === temp.id ? row : m))
        );
      })
      .catch(() => fail("Something went wrong. Please try again."));
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
          const prev = messages[i - 1];
          const newDay =
            !prev ||
            DAY_KEY.format(new Date(prev.created_at)) !==
              DAY_KEY.format(new Date(m.created_at));
          // Name the sender on the first line of a run (group chat only —
          // a 1:1 has exactly one other voice).
          const newRun = newDay || !prev || prev.sender_id !== m.sender_id;
          const sender = members[m.sender_id];
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
                    "max-w-[min(75%,34rem)] rounded-lg px-3 py-1.5",
                    mine
                      ? "bg-raised text-ink"
                      : "border border-line bg-surface text-ink"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {m.body}
                  </p>
                </div>
                <span className="px-1 pt-0.5 font-mono text-[10px] text-faint">
                  {TIME.format(new Date(m.created_at))}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line pt-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — scoped to this
              // textarea only, nothing global.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
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
            onClick={send}
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
          >
            <SendHorizontal className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
