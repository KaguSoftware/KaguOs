import { cache } from "react";
import { memberColorCss } from "@/lib/colors";
import { canAccess, type SessionContext } from "@/lib/data/session";
import type { PresencePerson } from "@/lib/types";

/**
 * Team presence for the always-open sidebar panel: Work members' status +
 * last-seen + call availability. Real operational data, so it's null in
 * showcase mode (a client demo must never show who's actually online) and gated
 * to Work access, per Parsa's rule.
 *
 * The denominator is admins ∪ explicit work-section members — the same set the
 * status-change notifications target (see notifyWorkTeam). cache()-wrapped so
 * the layout and any page can share one lookup per request.
 */
export const getPresence = cache(async function getPresence(
  ctx: SessionContext
): Promise<PresencePerson[] | null> {
  if (!canAccess(ctx, "work") || ctx.showcase) return null;

  const [{ data: profileRows }, { data: workRows }] = await Promise.all([
    ctx.supabase
      .from("profiles")
      .select(
        "id, full_name, email, color, is_admin, last_seen_at, status_kind, status_emoji, status_text, available_to_call, status_until"
      ),
    ctx.supabase.from("section_memberships").select("user_id").eq("section", "work"),
  ]);

  const workIds = new Set((workRows ?? []).map((r) => r.user_id));
  return (profileRows ?? [])
    .filter((p) => p.is_admin || workIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.full_name || p.email,
      color: memberColorCss(p.id, p.color),
      last_seen_at: p.last_seen_at,
      status_kind: p.status_kind,
      status_emoji: p.status_emoji,
      status_text: p.status_text,
      available_to_call: p.available_to_call,
      status_until: p.status_until,
    }));
});
