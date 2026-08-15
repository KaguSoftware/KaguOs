import "server-only";
import { after } from "next/server";
import type { SessionContext } from "@/lib/data/session";
import type { Section } from "@/lib/types";

type NotifyKind =
  | "debug_task_new"
  | "debug_suggested"
  | "idea_new"
  | "idea_promoted"
  | "idea_comment"
  | "reminder_shared"
  | "learn_question"
  | "learn_answer"
  | "learn_proof"
  | "learn_review"
  | "status_change"
  | "message"
  | "debug_note"
  // Marketing (0063/0064). The hand-offs in a video's production life that are
  // worth a bell: you've been given one to produce, one you edit is ready, and
  // a decision has landed on a cut.
  | "creative_assigned"
  | "creative_status"
  | "creative_review";

type NotifyInput = {
  kind: NotifyKind;
  title: string;
  href?: string;
};

/**
 * Fan a notification out to a set of recipients. Best-effort: a failure here
 * must never break the action that triggered it, so errors are swallowed.
 * The actor is always excluded — you don't get notified of your own doing.
 */
async function insertFor(
  ctx: SessionContext,
  recipientIds: string[],
  input: NotifyInput
) {
  const recipients = [...new Set(recipientIds)].filter((id) => id !== ctx.userId);
  if (recipients.length === 0) return;

  const rows = recipients.map((recipient_id) => ({
    recipient_id,
    actor_id: ctx.userId,
    kind: input.kind,
    title: input.title,
    href: input.href ?? null,
  }));

  try {
    await ctx.supabase.from("notifications").insert(rows);
  } catch {
    /* notifications are best-effort — never fail the parent action */
  }
}

// Notifications are best-effort and off the user's critical path. Everything
// below runs inside after(), so the SELECT (recipient lookup) + INSERT happen
// AFTER the response is sent — the save no longer waits ~1–2 round-trips on
// them. On Vercel, after() extends the invocation via waitUntil so the work
// still completes. Errors are swallowed; they must never surface to the user.

/** Notify everyone who belongs to a section (minus the actor). */
export function notifySection(
  ctx: SessionContext,
  section: Section,
  input: NotifyInput
) {
  after(async () => {
    const { data } = await ctx.supabase
      .from("section_memberships")
      .select("user_id")
      .eq("section", section);
    await insertFor(ctx, (data ?? []).map((m) => m.user_id), input);
  });
}

/**
 * Notify everyone with an account (minus the actor) — e.g. team reminders.
 *
 * "Everyone" means everyone at KAGU. kind = 'member' (0062): a client account
 * has an account too, and this function is how a team reminder would otherwise
 * arrive in an outsider's notification bell.
 */
export function notifyEveryone(ctx: SessionContext, input: NotifyInput) {
  after(async () => {
    const { data } = await ctx.supabase
      .from("profiles")
      .select("id")
      .eq("kind", "member");
    await insertFor(ctx, (data ?? []).map((p) => p.id), input);
  });
}

/** Notify the admins (minus the actor) — e.g. admin-only sprint questions. */
export function notifyAdmins(ctx: SessionContext, input: NotifyInput) {
  after(async () => {
    const { data } = await ctx.supabase
      .from("profiles")
      .select("id")
      .eq("kind", "member")
      .eq("is_admin", true);
    await insertFor(ctx, (data ?? []).map((p) => p.id), input);
  });
}

/**
 * Notify the chat audience (minus the actor): admins ∪ explicit chat-section
 * members. This is the same denominator getPresence uses — everyone who can see
 * presence — so status-change pings reach exactly that audience and no wider.
 *
 * Chat, not Work, since 0052 split them: a status change is a "who's around"
 * signal, and it belongs to whoever can see the presence panel.
 */
export function notifyChatTeam(ctx: SessionContext, input: NotifyInput) {
  after(async () => {
    const [{ data: admins }, { data: chat }] = await Promise.all([
      ctx.supabase
        .from("profiles")
        .select("id")
        .eq("kind", "member")
        .eq("is_admin", true),
      ctx.supabase
        .from("section_memberships")
        .select("user_id")
        .eq("section", "chat"),
    ]);
    const ids = [
      ...(admins ?? []).map((p) => p.id),
      ...(chat ?? []).map((m) => m.user_id),
    ];
    await insertFor(ctx, ids, input);
  });
}

/** Notify one specific person (minus the actor, if they're the same). */
export function notifyUser(
  ctx: SessionContext,
  recipientId: string,
  input: NotifyInput
) {
  after(async () => {
    await insertFor(ctx, [recipientId], input);
  });
}
