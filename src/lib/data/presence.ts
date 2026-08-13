import { cache } from "react";
import { memberColorCss } from "@/lib/colors";
import { canAccess, type SessionContext } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import type { PresencePerson } from "@/lib/types";

/**
 * The team roster, plus — for anyone with Status access — the presence layer on
 * top of it. Real operational data, so it's null in showcase mode (a client
 * demo must never show who's actually online).
 *
 * TWO SECTIONS, ONE QUERY, because this list does two jobs. It is the DM
 * contact list on /messages AND the status panel in the sidebar:
 *
 *   chat   → gates the LIST. Without it there's no roster and no chat at all.
 *   status → gates the LAYER: last-seen, the status emoji/note, the countdown,
 *            and available-to-call. Stripped here rather than filtered in the
 *            components, so a user without Status can't read a teammate's
 *            "In a meeting until 4" out of the page payload.
 *
 * Splitting them matters: gating both on one flag would mean revoking someone's
 * status also emptied their contact list, and an admin shouldn't have to choose
 * between those. See 0052_chat_and_status_sections.sql.
 *
 * The denominator is admins ∪ explicit chat-section members — the same set the
 * status-change notifications target (see notifyChatTeam). cache()-wrapped so
 * the layout and any page can share one lookup per request.
 */
export const getPresence = cache(async function getPresence(
  ctx: SessionContext
): Promise<PresencePerson[] | null> {
  if (!canAccess(ctx, "chat") || ctx.showcase) return null;

  const showStatus = canAccess(ctx, "status");

  const [profileRows, chatRows] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("profiles")
        .select(
          "id, full_name, email, color, is_admin, last_seen_at, status_kind, status_emoji, status_text, available_to_call, status_until"
        ),
      "presence: profiles"
    ),
    rowsOrThrow(
      ctx.supabase.from("section_memberships").select("user_id").eq("section", "chat"),
      "presence: section_memberships"
    ),
  ]);

  const chatIds = new Set(chatRows.map((r) => r.user_id));
  return profileRows
    .filter((p) => p.is_admin || chatIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.full_name || p.email,
      color: memberColorCss(p.id, p.color),
      // Everything below this line is the status layer. Blanked — not omitted —
      // so the shape stays one type and every consumer keeps working.
      last_seen_at: showStatus ? p.last_seen_at : null,
      status_kind: showStatus ? p.status_kind : "none",
      status_emoji: showStatus ? p.status_emoji : null,
      status_text: showStatus ? p.status_text : null,
      available_to_call: showStatus ? p.available_to_call : false,
      status_until: showStatus ? p.status_until : null,
    }));
});
