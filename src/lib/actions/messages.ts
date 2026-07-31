"use server";

import { refresh } from "next/cache";
import {
  blockIfShowcase,
  canAccess,
  getSessionContext,
} from "@/lib/data/session";
import { notifyUser } from "@/lib/actions/notify";
import {
  getGroupAudience,
  getGroupThread,
  getThread,
} from "@/lib/data/messages";
import {
  GROUP_LABEL,
  GROUP_THREAD,
  isChatImagePath,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGES_PER_MESSAGE,
  MAX_MESSAGE_LEN,
} from "@/lib/messages-shared";
import type { ActionResult } from "@/lib/actions/account";
import type {
  Message,
  MessageImage,
  MessageReplyRef,
  MessageTaskRef,
} from "@/lib/types";

export type SendResult = ActionResult & {
  row?: Message;
  /** Sent, but something secondary didn't land — surfaced as a toast, not a fail. */
  warning?: string;
};

export type OlderResult = ActionResult & {
  messages?: Message[];
  hasOlder?: boolean;
};

/**
 * How long a conversation must be quiet before a direct message rings the bell
 * again. See the anti-noise contract in `sendMessage`.
 */
const QUIET_WINDOW_MS = 5 * 60 * 1000;

/** A client-reported pixel dimension, bounded — or null if it isn't usable. */
function clampDimension(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  return Math.min(Math.round(value), MAX_IMAGE_DIMENSION);
}

export type SendImageInput = {
  path: string;
  width: number | null;
  height: number | null;
};

/** References a message can carry: the line it replies to, the task it shares. */
export type SendRefsInput = {
  replyToId?: string | null;
  taskId?: string | null;
};

/**
 * Send a chat message. `recipientId` null = the Work-team group chat.
 * `images` are already-uploaded bytes (browser → `chat-images` bucket
 * directly) — this only writes the index rows, same split as debug's
 * `addTaskImage`.
 *
 * Returns the inserted row (images included) so the thread view can
 * reconcile its optimistic append against the real id/timestamp.
 *
 * Notification contract (the anti-noise rule): a DIRECT message notifies the
 * recipient only when they have no unread from this sender yet — one bell per
 * unread thread, never one per line; it re-arms once they read. The group chat
 * never notifies — for 8 people a busy group day would bury every other
 * notification, and the sidebar badge already carries it.
 */
export async function sendMessage(
  recipientId: string | null,
  body: string,
  images: SendImageInput[] = [],
  /** User ids named with @ in this message. Group chat only — see notifyMentions. */
  mentions: string[] = [],
  refs: SendRefsInput = {}
): Promise<SendResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await getSessionContext();
  if (!canAccess(ctx, "work"))
    return { ok: false, message: "Chat is for the work team." };

  const clean = body.trim().slice(0, MAX_MESSAGE_LEN);
  // A task card can travel alone, like an image can — a reply cannot, because
  // a bare quote with no answer says nothing.
  if (!clean && images.length === 0 && !refs.taskId)
    return { ok: false, message: "Write something or attach an image." };
  if (recipientId === ctx.userId)
    return { ok: false, message: "That's you." };

  // The client caps attachments too, but the client is not the authority. And a
  // path arriving from the browser must live under this sender's own prefix and
  // look like a key this app minted — otherwise a row could point anywhere in
  // the bucket. Dimensions are claims, so they get bounded rather than trusted.
  if (images.length > MAX_IMAGES_PER_MESSAGE)
    return {
      ok: false,
      message: `A message can carry ${MAX_IMAGES_PER_MESSAGE} images.`,
    };
  if (images.some((img) => !isChatImagePath(img.path, ctx.userId)))
    return { ok: false, message: "That image couldn't be attached." };
  const bounded = images.map((img) => ({
    path: img.path,
    width: clampDimension(img.width),
    height: clampDimension(img.height),
  }));

  let shouldNotify = false;
  if (recipientId) {
    // Recipient must be in the chat audience (admins ∪ work members) — RLS
    // can't cheaply ask that about the OTHER user, so the action does. The two
    // notification inputs ride the same wave, so none of this costs a trip.
    const [profile, membership, unread, lastMine] = await Promise.all([
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
      // When did I last write to them? The other half of the quiet window.
      ctx.supabase
        .from("messages")
        .select("created_at")
        .eq("sender_id", ctx.userId)
        .eq("recipient_id", recipientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    // A failed lookup is not a permissions answer. Reporting one as "they're
    // not in the chat audience" told the user their teammate had been removed
    // from Work when the truth was a dropped request.
    if (profile.error || membership.error)
      return {
        ok: false,
        message: "Couldn't reach the server. Please try again.",
      };
    if (!profile.data || !(profile.data.is_admin || membership.data))
      return { ok: false, message: "They're not on the work team." };

    /**
     * THE ANTI-NOISE CONTRACT, and why it needs two conditions.
     *
     * The rule is one bell per conversation, never one per line. It used to be
     * implemented as `priorUnread === 0` alone — notify when they have nothing
     * unread from me. That inverted in practice: the recipient's open thread
     * marked each line read the instant it arrived, so by my next line the
     * count was 0 again and it notified. The guard meant to suppress repeat
     * bells was being reset by the reader, once per line.
     *
     * So the count is now paired with a QUIET WINDOW, which no reader can
     * reset. Notify only when they have nothing unread from me AND I haven't
     * written to them recently. A conversation that has gone quiet re-arms; an
     * active back-and-forth stays silent.
     *
     * (The window can't be measured on the `notifications` table — RLS scopes
     * those rows to their recipient, so the sender can't see whether a bell
     * already exists. My own sent messages are readable, and answer the same
     * question.)
     */
    const quietSince = Date.now() - QUIET_WINDOW_MS;
    const lastAt = lastMine.data?.created_at;
    const quiet = !lastAt || new Date(lastAt).getTime() < quietSince;
    // Fail SAFE: an errored count used to fall through `?? 0` to "nothing
    // unread", so the guard's failure mode was always to send the bell.
    const noUnread = !unread.error && (unread.count ?? 0) === 0;
    shouldNotify = noUnread && quiet;
  }

  /**
   * Validate the refs BEFORE the insert, under this sender's own RLS — a
   * reply must point into this very thread (0049 also enforces it in the
   * database), and both ids must still exist: `on delete set null` protects
   * rows already written, but INSERTING a dangling id is an FK violation.
   *
   * A ref that fails is DROPPED, not fatal — the words still matter, and the
   * likely cause is a race (the task was deleted while the card sat in the
   * composer). The sender is told via the same non-fatal `warning` channel the
   * image path uses. Exception: a task-only send whose task vanished has
   * nothing left to say, so that one fails outright.
   */
  let replyRef: MessageReplyRef | null = null;
  let taskRef: MessageTaskRef | null = null;
  let refWarning: string | undefined;
  if (refs.replyToId || refs.taskId) {
    const [original, originalImage, task] = await Promise.all([
      refs.replyToId
        ? ctx.supabase
            .from("messages")
            .select("id, sender_id, recipient_id, body")
            .eq("id", refs.replyToId)
            .maybeSingle()
        : Promise.resolve(null),
      refs.replyToId
        ? ctx.supabase
            .from("message_images")
            .select("id", { count: "exact", head: true })
            .eq("message_id", refs.replyToId)
        : Promise.resolve(null),
      refs.taskId
        ? ctx.supabase
            .from("debug_tasks")
            .select("id, title, state, priority, kind")
            .eq("id", refs.taskId)
            .maybeSingle()
        : Promise.resolve(null),
    ]);

    if (refs.replyToId) {
      const o = original?.data;
      const sameThread =
        o != null &&
        (recipientId === null
          ? o.recipient_id === null
          : (o.sender_id === ctx.userId && o.recipient_id === recipientId) ||
            (o.sender_id === recipientId && o.recipient_id === ctx.userId));
      if (sameThread)
        replyRef = {
          id: o.id,
          sender_id: o.sender_id,
          body: o.body,
          has_image: (originalImage?.count ?? 0) > 0,
        };
      else refWarning = "Sent, but the replied-to message is gone.";
    }
    if (refs.taskId) {
      if (task?.data) taskRef = task.data as MessageTaskRef;
      else if (!clean && images.length === 0)
        return { ok: false, message: "That task no longer exists." };
      else refWarning = "Sent, but that task no longer exists.";
    }
  }

  const { data: row, error } = await ctx.supabase
    .from("messages")
    .insert({
      sender_id: ctx.userId,
      recipient_id: recipientId,
      body: clean,
      reply_to_id: replyRef?.id ?? null,
      task_id: taskRef?.id ?? null,
    })
    .select()
    .single();
  if (error) return { ok: false, message: error.message };

  let imageRows: MessageImage[] = [];
  let warning: string | undefined = refWarning;
  if (bounded.length > 0) {
    const { data: inserted, error: imageError } = await ctx.supabase
      .from("message_images")
      .insert(
        bounded.map((img) => ({
          message_id: row.id,
          file_path: img.path,
          width: img.width,
          height: img.height,
        }))
      )
      .select();
    if (imageError) {
      /**
       * This used to try to undo both sides — remove the storage objects, then
       * delete the message row — and NEITHER could ever succeed: 0044 creates no
       * delete policy on `storage.objects` for this bucket, and 0042 none on
       * `messages` ("messages are a record"). RLS matched zero rows, PostgREST
       * reported success, both errors went unchecked, and the caller was told
       * the send had failed. The message was in fact committed and already
       * broadcast to everyone's realtime stream, so the user sent it again and
       * the thread showed it twice.
       *
       * So: be honest. The message stands, because it really is sent. Only the
       * pictures are missing, and that is what the sender is told.
       */
      warning = "Message sent, but the images couldn't be attached.";
    } else {
      imageRows = (inserted ?? []) as MessageImage[];
    }
  }

  const myName = ctx.profile.full_name || ctx.profile.email;

  if (recipientId && shouldNotify) {
    notifyUser(ctx, recipientId, {
      kind: "message",
      title: `${myName} sent you a message`,
      href: `/messages/${ctx.userId}`,
    });
  }

  /**
   * MENTIONS. Group chat only: in a DM the recipient is already notified by the
   * rule above, so naming them would just double it.
   *
   * The ids are validated against the real audience rather than trusted, then
   * recorded and notified. This is the ONLY thing that makes the group chat ring,
   * and only for the people deliberately named — the "group chat never notifies"
   * rule is otherwise untouched.
   */
  if (!recipientId && mentions.length > 0) {
    const named = [...new Set(mentions)].filter((id) => id !== ctx.userId);
    const audience = await getGroupAudience(ctx);
    const valid = named.filter((id) => audience.includes(id));
    if (valid.length > 0) {
      const { error: mentionError } = await ctx.supabase
        .from("message_mentions")
        .insert(valid.map((id) => ({ message_id: row.id, user_id: id })));
      // A mention that failed to record must not silently notify — the bell would
      // point at a message that doesn't know it named anyone.
      if (!mentionError) {
        for (const id of valid) {
          notifyUser(ctx, id, {
            kind: "message",
            title: `${myName} mentioned you in ${GROUP_LABEL}`,
            href: `/messages/${GROUP_THREAD}`,
          });
        }
      }
    }
  }

  // refresh(), not revalidatePath("/messages"): the docs note that
  // revalidatePath from a Server Action "causes all previously visited pages to
  // refresh when navigated to again", which throws away the client router cache
  // that next.config.ts's staleTimes exists to keep warm. refresh() re-renders
  // the tree the sender is already looking at — which is all this needs — and
  // leaves every other section warm. Other people's clients learn about the new
  // line from realtime, not from this.
  refresh();
  return {
    ok: true,
    message: "Sent.",
    warning,
    row: {
      ...(row as Message),
      images: imageRows,
      reply_to: replyRef,
      task: taskRef,
    },
  };
}

export type MessageRefsResult = ActionResult & {
  reply?: MessageReplyRef | null;
  task?: MessageTaskRef | null;
};

/**
 * Hydrate the preview cards for ONE message's refs — the realtime INSERT
 * payload carries bare ids, and the receiving client has to turn them into a
 * quote card and a task card without a full refetch. Reads under the caller's
 * own RLS, so it can't show anyone a line or a task they couldn't read anyway.
 * A read, not a mutation, but a client component can only reach the server
 * through an action (same note as loadOlderMessages).
 */
export async function getMessageRefs(
  replyToId: string | null,
  taskId: string | null
): Promise<MessageRefsResult> {
  const ctx = await getSessionContext();
  if (ctx.showcase) return { ok: false, message: "Not available in showcase." };
  if (!canAccess(ctx, "work"))
    return { ok: false, message: "Chat is for the work team." };

  const [original, originalImage, task] = await Promise.all([
    replyToId
      ? ctx.supabase
          .from("messages")
          .select("id, sender_id, body")
          .eq("id", replyToId)
          .maybeSingle()
      : Promise.resolve(null),
    replyToId
      ? ctx.supabase
          .from("message_images")
          .select("id", { count: "exact", head: true })
          .eq("message_id", replyToId)
      : Promise.resolve(null),
    taskId
      ? ctx.supabase
          .from("debug_tasks")
          .select("id, title, state, priority, kind")
          .eq("id", taskId)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  return {
    ok: true,
    message: "Loaded.",
    reply: original?.data
      ? { ...original.data, has_image: (originalImage?.count ?? 0) > 0 }
      : null,
    task: (task?.data as MessageTaskRef | undefined) ?? null,
  };
}

/**
 * One older page of a thread — `before` is the oldest `created_at` the client
 * already holds. A read, not a mutation, but it lives here because a client
 * component can only reach the server through an action.
 */
export async function loadOlderMessages(
  otherId: string | null,
  before: string
): Promise<OlderResult> {
  const ctx = await getSessionContext();
  // Chat is closed in showcase entirely — same answer the loaders give.
  if (ctx.showcase) return { ok: false, message: "Not available in showcase." };
  if (!canAccess(ctx, "work"))
    return { ok: false, message: "Chat is for the work team." };

  const page = otherId
    ? await getThread(ctx, otherId, before)
    : await getGroupThread(ctx, before);
  return {
    ok: true,
    message: "Loaded.",
    messages: page.messages,
    hasOlder: page.hasOlder,
  };
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
    // Same no-op guard the DM branch has: if my marker is already at or past
    // the newest group line, nothing can change and the layout revalidation
    // below would flush the whole router cache for nothing. Without this, every
    // arriving group line cost a full app-wide re-render even when the marker
    // did not move.
    const [marker, newest] = await Promise.all([
      ctx.supabase
        .from("message_reads")
        .select("read_at")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      ctx.supabase
        .from("messages")
        .select("created_at")
        .is("recipient_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const readAt = marker.data?.read_at ?? null;
    const newestAt = newest.data?.created_at ?? null;
    if (!marker.error && !newest.error && readAt && newestAt && readAt >= newestAt)
      return { ok: true, message: "Read." };

    const { error } = await ctx.supabase
      .from("message_reads")
      .upsert({ user_id: ctx.userId, read_at: new Date().toISOString() });
    if (error) return { ok: false, message: error.message };
  }

  // Was revalidatePath("/", "layout"), which the docs say "will purge the Client
  // Cache" — so every section the user had visited went cold again each time
  // they opened a thread, and this fires per inbound line. refresh() re-renders
  // the current tree, layout included, so the badge still drops.
  refresh();
  return { ok: true, message: "Read." };
}
