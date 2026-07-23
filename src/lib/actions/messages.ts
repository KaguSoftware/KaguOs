"use server";

import { revalidatePath } from "next/cache";
import {
  blockIfShowcase,
  canAccess,
  getSessionContext,
} from "@/lib/data/session";
import { notifyUser } from "@/lib/actions/notify";
import { MAX_MESSAGE_LEN } from "@/lib/messages-shared";
import type { ActionResult } from "@/lib/actions/account";
import type { Message } from "@/lib/types";

export type SendResult = ActionResult & { row?: Message };

/**
 * Send a chat message. `recipientId` null = the Work-team group chat.
 *
 * Returns the inserted row so the thread view can reconcile its optimistic
 * append against the real id/timestamp.
 *
 * Notification contract (the anti-noise rule): a DIRECT message notifies the
 * recipient only when they have no unread from this sender yet — one bell per
 * unread thread, never one per line; it re-arms once they read. The group chat
 * never notifies — for 8 people a busy group day would bury every other
 * notification, and the sidebar badge already carries it.
 */
export async function sendMessage(
  recipientId: string | null,
  body: string
): Promise<SendResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await getSessionContext();
  if (!canAccess(ctx, "work"))
    return { ok: false, message: "Chat is for the work team." };

  const clean = body.trim().slice(0, MAX_MESSAGE_LEN);
  if (!clean) return { ok: false, message: "Write something first." };
  if (recipientId === ctx.userId)
    return { ok: false, message: "That's you." };

  let priorUnread = 0;
  if (recipientId) {
    // Recipient must be in the chat audience (admins ∪ work members) — RLS
    // can't cheaply ask that about the OTHER user, so the action does. The
    // unread head-count rides the same wave and decides whether to notify.
    const [profile, membership, unread] = await Promise.all([
      ctx.supabase
        .from("profiles")
        .select("id, is_admin")
        .eq("id", recipientId)
        .maybeSingle(),
      ctx.supabase
        .from("section_memberships")
        .select("user_id")
        .eq("section", "work")
        .eq("user_id", recipientId)
        .maybeSingle(),
      ctx.supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", ctx.userId)
        .eq("recipient_id", recipientId)
        .is("read_at", null),
    ]);
    if (!profile.data || !(profile.data.is_admin || membership.data))
      return { ok: false, message: "They're not in the chat audience." };
    priorUnread = unread.count ?? 0;
  }

  const { data: row, error } = await ctx.supabase
    .from("messages")
    .insert({
      sender_id: ctx.userId,
      recipient_id: recipientId,
      body: clean,
    })
    .select()
    .single();
  if (error) return { ok: false, message: error.message };

  if (recipientId && priorUnread === 0) {
    const myName = ctx.profile.full_name || ctx.profile.email;
    notifyUser(ctx, recipientId, {
      kind: "message",
      title: `${myName} sent you a message`,
      href: `/messages/${ctx.userId}`,
    });
  }

  revalidatePath("/messages");
  return { ok: true, message: "Sent.", row: row as Message };
}

/**
 * Mark a thread read. `otherId` null = the group chat (moves my last-read
 * marker); otherwise clears read_at on their unread messages to me.
 * Revalidates the layout so the sidebar badge drops without a full reload.
 */
export async function markThreadRead(
  otherId: string | null
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await getSessionContext();
  if (!canAccess(ctx, "work"))
    return { ok: false, message: "Chat is for the work team." };

  if (otherId) {
    const { data, error } = await ctx.supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", otherId)
      .eq("recipient_id", ctx.userId)
      .is("read_at", null)
      .select("id");
    if (error) return { ok: false, message: error.message };
    // Nothing was unread → the badge can't change → don't flush the router
    // cache for a no-op (this action revalidates the whole LAYOUT, which is
    // the expensive part — it must only run when it buys something).
    if (!data || data.length === 0) return { ok: true, message: "Read." };
  } else {
    const { error } = await ctx.supabase
      .from("message_reads")
      .upsert({ user_id: ctx.userId, read_at: new Date().toISOString() });
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Read." };
}
