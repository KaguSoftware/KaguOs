"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccess, getUserId, getSessionContext } from "@/lib/data/session";
import { notifyChatTeam } from "@/lib/actions/notify";
import { isValidColorKey } from "@/lib/colors";
import { dict } from "@/lib/i18n";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { STATUS_KINDS, STATUS_PRESETS, type StatusKind } from "@/lib/types";

/**
 * Bounds for a status expiry, in ms. The picker offers chips (30m/1h/2h/12h)
 * AND a custom "3h 30m" entry, so this can no longer be a whitelist of the
 * chip values — it's a RANGE plus a granularity rule instead.
 *
 * Still validated server-side, and still the server that turns the relative
 * duration into an absolute `status_until`: the client never sends a wall
 * clock, so a skewed or tampered clock can't plant an expiry years out.
 * 0 = open-ended (clears any expiry).
 */
const STATUS_DURATION_MIN_MS = 60 * 1000; // 1m — below this the status is noise
const STATUS_DURATION_MAX_MS = 7 * 24 * 60 * 60 * 1000; // 7d — "off today" tops out well under this

function isValidDurationMs(ms: number): boolean {
  return (
    Number.isInteger(ms) &&
    ms >= STATUS_DURATION_MIN_MS &&
    ms <= STATUS_DURATION_MAX_MS &&
    ms % STATUS_DURATION_MIN_MS === 0 // whole minutes only
  );
}

export type ActionResult = {
  ok: boolean;
  message: string;
  /**
   * Id of the row a create action just inserted. Optional, and only set by the
   * actions whose forms need to do something with the new row before
   * navigating away — the debug create form attaches staged screenshots, which
   * can't be uploaded earlier because they need a task_id to belong to.
   */
  id?: string;
} | null;

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Rename yourself. Rendered by ResultNote on BOTH /account and the client
 * portal's /portal/account, which is why the messages are resolved from the
 * dictionary against the request's own locale cookie: only the portal ever
 * WRITES `kagu-locale` (lib/locale.ts), so a teammate has no cookie,
 * parseLocale answers "en", and the team-side page is unchanged to the byte.
 */
export async function updateName(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = dict(parseLocale((await cookies()).get(LOCALE_COOKIE)?.value));
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 1 || fullName.length > 80) {
    return { ok: false, message: t.accountNameLength };
  }

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return { ok: false, message: t.accountNotSignedIn };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
  // Postgres/PostgREST wording names the table and the constraint that refused
  // the write, which is not something an outside client account should be
  // shown. The real message stays in the server log; the caller gets a sentence.
  if (error) {
    console.error("updateName", error);
    return { ok: false, message: t.actionSaveFailed };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: t.accountNameSaved };
}

export async function updateMyColor(colorKey: string): Promise<ActionResult> {
  if (!isValidColorKey(colorKey)) return { ok: false, message: "Pick a color from the set." };

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ color: colorKey })
    .eq("id", userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Color updated." };
}

/**
 * Set your own presence status. The status is emoji + optional note that any
 * kind can carry; `durationMs` is a relative expiry the SERVER turns into an
 * absolute timestamp (client sends a choice, not a wall-clock time — no drift,
 * nothing to tamper with). available_to_call is the one availability signal.
 */
export async function updateMyStatus(fields: {
  kind: StatusKind;
  emoji?: string | null;
  text?: string | null;
  availableToCall: boolean;
  /** Relative expiry in ms from now; 0/absent = open-ended. */
  durationMs?: number | null;
}): Promise<ActionResult> {
  let kind: StatusKind = STATUS_KINDS.includes(fields.kind) ? fields.kind : "none";
  const text = (fields.text ?? "").trim().slice(0, 80);
  const emojiRaw = (fields.emoji ?? "").trim().slice(0, 16);
  // A custom status with neither emoji nor note written is no status at all.
  if (kind === "custom" && !text && !emojiRaw) kind = "none";

  // Clearing the status clears everything hanging off it.
  const emoji = kind === "none" ? null : emojiRaw || STATUS_PRESETS[kind].emoji || null;

  // Turn the relative duration into an absolute expiry. Only a value from the
  // known set counts, and only while a status is set.
  let until: string | null = null;
  if (kind !== "none" && fields.durationMs && isValidDurationMs(fields.durationMs)) {
    until = new Date(Date.now() + fields.durationMs).toISOString();
  }

  // getSessionContext gives us the previous status (no extra query) for the
  // change comparison, plus a SessionContext for the notification fan-out.
  const ctx = await getSessionContext();

  // The status system is its own section (0052). The status columns sit on
  // profiles, which every signed-in user can update for their own row, so RLS
  // can't express this — the gate has to live here, on the only write path.
  if (!canAccess(ctx, "status"))
    return { ok: false, message: "You don't have access to team status." };

  const prev = ctx.profile;

  const availableToCall = Boolean(fields.availableToCall);
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      status_kind: kind,
      status_emoji: emoji,
      status_text: kind === "none" ? null : text || null,
      available_to_call: availableToCall,
      status_until: until,
    })
    .eq("id", ctx.userId);
  if (error) return { ok: false, message: error.message };

  // Notify the work team only on a MEANINGFUL change — a different status kind,
  // or newly opening up to calls. Editing the note, clearing a status, or just
  // changing the expiry stays quiet (avoids pinging the team on churn).
  const kindChanged = kind !== "none" && kind !== prev.status_kind;
  const nowCallable = availableToCall && !prev.available_to_call;
  if (kindChanged || nowCallable) {
    const base =
      text || (kind !== "none" ? STATUS_PRESETS[kind].label : "available to call");
    const label = emoji ? `${emoji} ${base}` : base;
    const name = prev.full_name || "A teammate";
    const tail = until
      ? ` — till ${new Date(until).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "";
    notifyChatTeam(ctx, {
      kind: "status_change",
      title: `${name} is now ${label}${tail}`,
      href: "/",
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Status updated." };
}

/**
 * Change your own password. Shared with /portal/account exactly as updateName
 * is, and localised the same way and for the same reason.
 */
export async function updatePassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = dict(parseLocale((await cookies()).get(LOCALE_COOKIE)?.value));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { ok: false, message: t.accountPasswordShort };
  }
  if (password !== confirm) {
    return { ok: false, message: t.accountPasswordMismatch };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  // Supabase writes these in English and in provider-internal terms ("New
  // password should be different from the old password"), so forwarding one
  // verbatim puts untranslated auth-vendor copy in front of an end customer.
  // Logged in full, answered generically. Trade-off: the specific reasons —
  // reused password, rejected as too weak — are no longer distinguishable.
  if (error) {
    console.error("updatePassword", error);
    return { ok: false, message: t.actionSaveFailed };
  }

  return { ok: true, message: t.accountPasswordSaved };
}
