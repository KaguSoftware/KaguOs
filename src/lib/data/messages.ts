import { cache } from "react";
import { canAccess, type SessionContext } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getPresence } from "@/lib/data/presence";
import type { Message, MessageImage } from "@/lib/types";

/**
 * Chat data. Audience = the presence audience (Work members, admins included);
 * everything here returns null outside it or in showcase — "not applicable",
 * never an error. Group-chat unreads are "rows newer than my last-read marker,
 * not mine": a per-row flag can't represent several independent readers, so
 * the marker lives in message_reads.
 */

/**
 * How much history ONE PAGE of a thread loads.
 *
 * This used to be a flat `THREAD_LIMIT = 500` paired with `ascending: true` —
 * which asks Postgres for the OLDEST 500 rows, because the limit applies after
 * the sort. Past 500 messages a thread rendered history that stopped dead and
 * the newest lines were simply absent, while realtime kept appending live lines
 * on top of a months-old window. The badge disagreed too: getUnreadMessageCount
 * reads `ascending: false`, so the two read opposite ends of the same table.
 *
 * Threads now page backwards from the newest line. 50 is about two screens.
 */
export const THREAD_PAGE = 50;
/** Inbox scan depth — enough to cover every partner's recent traffic. */
const INBOX_LIMIT = 200;

/**
 * Group unread = rows newer than my marker that aren't mine.
 *
 * NO MARKER MEANS ZERO, not everything. A `message_reads` row only exists once
 * you have opened the group chat, and treating its absence as "all unread" meant
 * a new work member's very first badge was the entire room history — 100 on day
 * one, which teaches people the badge is noise. Conversation that happened
 * before you could see the room is archive, not mail.
 *
 * The marker gets seeded the first time they open the group thread (see the
 * thread page), so this branch is a one-time state, not a permanent blind spot.
 */
function countGroupUnread(
  rows: { sender_id: string; created_at: string }[],
  meId: string,
  readAt: string | null
) {
  if (!readAt) return 0;
  return rows.filter((m) => m.sender_id !== meId && m.created_at > readAt)
    .length;
}

/**
 * Total unread (direct + group) for the sidebar badge. One wave of three
 * cheap queries: a head-only count, the recent group tail, and my marker.
 */
export const getUnreadMessageCount = cache(async function getUnreadMessageCount(
  ctx: SessionContext
): Promise<number | null> {
  if (!canAccess(ctx, "work") || ctx.showcase) return null;

  const [direct, group, marker] = await Promise.all([
    selectOrThrow(
      ctx.supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", ctx.userId)
        .is("read_at", null),
      "messages: unread count"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("messages")
        .select("sender_id, created_at")
        .is("recipient_id", null)
        .order("created_at", { ascending: false })
        .limit(100),
      "messages: group tail"
    ),
    selectOrThrow(
      ctx.supabase
        .from("message_reads")
        .select("read_at")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      "message_reads"
    ),
  ]);

  return (
    (direct.count ?? 0) +
    countGroupUnread(group, ctx.userId, marker.data?.read_at ?? null)
  );
});

/** Every id in the group-chat audience (work members ∪ admins). */
export const getGroupAudience = cache(async function getGroupAudience(
  ctx: SessionContext
): Promise<string[]> {
  const presence = await getPresence(ctx);
  return (presence ?? []).map((p) => p.id);
});

/** Everyone's group-chat last-read marker, keyed by user id — the "seen by" data. */
export async function getGroupReadMarkers(
  ctx: SessionContext
): Promise<Record<string, string>> {
  if (!canAccess(ctx, "work") || ctx.showcase) return {};
  const rows = await rowsOrThrow<{ user_id: string; read_at: string }>(
    ctx.supabase.from("message_reads").select("user_id, read_at"),
    "message_reads: all"
  );
  return Object.fromEntries(rows.map((r) => [r.user_id, r.read_at]));
}

/** Attach each row's images (if any) — one extra query, not one per message. */
async function attachImages(
  ctx: SessionContext,
  rows: Message[]
): Promise<Message[]> {
  if (rows.length === 0) return rows;
  const images = await rowsOrThrow<MessageImage>(
    ctx.supabase
      .from("message_images")
      .select("*")
      .in(
        "message_id",
        rows.map((r) => r.id)
      ),
    "message_images"
  );
  const byMessage = new Map<string, MessageImage[]>();
  for (const img of images) {
    const list = byMessage.get(img.message_id) ?? [];
    list.push(img);
    byMessage.set(img.message_id, list);
  }
  return rows.map((r) => ({ ...r, images: byMessage.get(r.id) }));
}

export type InboxSummary = {
  /** Per-partner: their latest message either direction + my unread from them. */
  direct: Record<string, { last: Message; unread: number }>;
  group: { last: Message | null; unread: number };
};

/** The /messages inbox: last line + unread count per partner and for the group. */
export const getInboxSummary = cache(async function getInboxSummary(
  ctx: SessionContext
): Promise<InboxSummary | null> {
  if (!canAccess(ctx, "work") || ctx.showcase) return null;

  const me = ctx.userId;
  const [directRows, unreadRows, groupRows, marker] = await Promise.all([
    rowsOrThrow<Message>(
      ctx.supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
        .not("recipient_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(INBOX_LIMIT),
      "messages: inbox"
    ),
    /**
     * Unread gets its OWN query rather than being counted inside the preview
     * window above. That window is INBOX_LIMIT rows across ALL partners, so two
     * people trading 200 messages pushed everyone else out of it: their rows
     * read "No messages yet." with unread 0, while the sidebar badge — which
     * uses an unbounded head count — still showed those unread. The inbox and
     * the badge disagreed, and the inbox was the wrong one.
     *
     * Unbounded on purpose, and self-limiting: unread mail exists only until
     * someone reads it. `eq(recipient_id, me)` also excludes group rows, whose
     * recipient is null.
     */
    rowsOrThrow<Message>(
      ctx.supabase
        .from("messages")
        .select("*")
        .eq("recipient_id", me)
        .is("read_at", null)
        .order("created_at", { ascending: false }),
      "messages: inbox unread"
    ),
    rowsOrThrow<Message>(
      ctx.supabase
        .from("messages")
        .select("*")
        .is("recipient_id", null)
        .order("created_at", { ascending: false })
        .limit(100),
      "messages: group inbox"
    ),
    selectOrThrow(
      ctx.supabase
        .from("message_reads")
        .select("read_at")
        .eq("user_id", me)
        .maybeSingle(),
      "message_reads"
    ),
  ]);

  // Rows arrive newest-first, so the first one seen per partner IS the preview.
  const direct: InboxSummary["direct"] = {};
  for (const m of directRows) {
    const partner = m.sender_id === me ? m.recipient_id! : m.sender_id;
    direct[partner] ??= { last: m, unread: 0 };
  }
  // Then the exact unread counts. A partner who fell outside the preview window
  // still gets a row here, using their newest unread line as the preview — so an
  // unread conversation can never be missing from the inbox.
  for (const m of unreadRows) {
    const entry = direct[m.sender_id];
    if (entry) entry.unread += 1;
    else direct[m.sender_id] = { last: m, unread: 1 };
  }

  return {
    direct,
    group: {
      last: groupRows[0] ?? null,
      unread: countGroupUnread(groupRows, me, marker.data?.read_at ?? null),
    },
  };
});

export type ThreadPage = {
  /** Oldest-first, ready to render. */
  messages: Message[];
  /** Older history exists behind this page. */
  hasOlder: boolean;
};

/**
 * Trim a `PAGE + 1` read down to one page and flip it oldest-first.
 *
 * The extra row is how "is there more?" gets answered without a second count
 * query — if it came back, older history exists.
 */
async function toPage(
  ctx: SessionContext,
  rows: Message[]
): Promise<ThreadPage> {
  const hasOlder = rows.length > THREAD_PAGE;
  const page = hasOlder ? rows.slice(0, THREAD_PAGE) : rows;
  return {
    messages: await attachImages(ctx, [...page].reverse()),
    hasOlder,
  };
}

/**
 * One page of a 1:1 thread, newest first from the DB.
 *
 * `before` is an EXCLUSIVE `created_at` cursor: pass the oldest row you already
 * hold to walk backwards. `now()` is per-transaction, so two messages never
 * share a timestamp and the cursor can't skip a line.
 *
 * ⚠️ The filters must be applied BEFORE `.order()`/`.limit()` — the builder
 * returns a transform builder after those, which has no `.lt()`.
 */
export async function getThread(
  ctx: SessionContext,
  otherId: string,
  before?: string
): Promise<ThreadPage> {
  const me = ctx.userId;
  const base = ctx.supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${me},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me})`
    );
  const scoped = before ? base.lt("created_at", before) : base;
  const rows = await rowsOrThrow<Message>(
    scoped.order("created_at", { ascending: false }).limit(THREAD_PAGE + 1),
    "messages: thread"
  );
  return toPage(ctx, rows);
}

/** One page of the Work-team group chat, newest first from the DB. */
export async function getGroupThread(
  ctx: SessionContext,
  before?: string
): Promise<ThreadPage> {
  const base = ctx.supabase
    .from("messages")
    .select("*")
    .is("recipient_id", null);
  const scoped = before ? base.lt("created_at", before) : base;
  const rows = await rowsOrThrow<Message>(
    scoped.order("created_at", { ascending: false }).limit(THREAD_PAGE + 1),
    "messages: group thread"
  );
  return toPage(ctx, rows);
}
