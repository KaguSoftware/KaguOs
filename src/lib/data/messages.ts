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

/** How much history a thread view loads. Plenty for an 8-person team. */
const THREAD_LIMIT = 500;
/** Inbox scan depth — enough to cover every partner's recent traffic. */
const INBOX_LIMIT = 200;

function countGroupUnread(
  rows: { sender_id: string; created_at: string }[],
  meId: string,
  readAt: string | null
) {
  return rows.filter(
    (m) => m.sender_id !== meId && (!readAt || m.created_at > readAt)
  ).length;
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
  const [directRows, groupRows, marker] = await Promise.all([
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
    if (m.recipient_id === me && !m.read_at) direct[partner].unread += 1;
  }

  return {
    direct,
    group: {
      last: groupRows[0] ?? null,
      unread: countGroupUnread(groupRows, me, marker.data?.read_at ?? null),
    },
  };
});

/** One 1:1 thread — both directions between me and `otherId`, oldest first. */
export async function getThread(
  ctx: SessionContext,
  otherId: string
): Promise<Message[]> {
  const me = ctx.userId;
  const rows = await rowsOrThrow<Message>(
    ctx.supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${me},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me})`
      )
      .order("created_at", { ascending: true })
      .limit(THREAD_LIMIT),
    "messages: thread"
  );
  return attachImages(ctx, rows);
}

/** The Work-team group chat, oldest first. */
export async function getGroupThread(ctx: SessionContext): Promise<Message[]> {
  const rows = await rowsOrThrow<Message>(
    ctx.supabase
      .from("messages")
      .select("*")
      .is("recipient_id", null)
      .order("created_at", { ascending: true })
      .limit(THREAD_LIMIT),
    "messages: group thread"
  );
  return attachImages(ctx, rows);
}
