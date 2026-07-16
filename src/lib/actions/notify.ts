import "server-only";
import { after } from "next/server";
import type { SessionContext } from "@/lib/data/session";
import type { Section } from "@/lib/types";

type NotifyKind =
  | "debug_task_new"
  | "idea_new"
  | "idea_promoted"
  | "idea_comment"
  | "reminder_shared";

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

/** Notify everyone with an account (minus the actor) — e.g. team reminders. */
export function notifyEveryone(ctx: SessionContext, input: NotifyInput) {
  after(async () => {
    const { data } = await ctx.supabase.from("profiles").select("id");
    await insertFor(ctx, (data ?? []).map((p) => p.id), input);
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
