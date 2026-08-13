"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { useChatAlerts } from "@/lib/chat-alerts";
import { GROUP_THREAD } from "@/lib/messages-shared";
import type { ChangePayload } from "@/lib/use-realtime-refresh";
import type { MembersMap } from "@/lib/types";

/**
 * The shell's live subscription to the chat tables — the sidebar badge and the
 * unread-DM toasts both come from a server re-render, so something has to watch
 * `messages` and `message_reads` app-wide.
 *
 * THE PROBLEM THIS SOLVES. That subscription used to live in the layout as a
 * plain `<LiveRefresh tables={[…, "messages", "message_reads"]} />`, which meant
 * it was also alive while the user was sitting inside a thread. Every arriving
 * line therefore triggered `router.refresh()` on `/messages/[userId]` — a full
 * server re-render of the layout wave plus the thread wave, ~19 queries to
 * Tokyo, shipping the whole thread payload back down. `thread.tsx` goes to real
 * trouble to patch its state in place precisely so that never happens ("a
 * refresh per line would drop composer focus mid-word"), and the shell was
 * quietly doing it anyway from outside the file that made the decision.
 *
 * Simply pausing while a thread is open would have been wrong in the other
 * direction: a message arriving in a DIFFERENT thread must still light the
 * badge. So the events are filtered instead of the subscription. Rows belonging
 * to the thread on screen are dropped — that thread is already handling them —
 * and everything else refreshes as before.
 *
 * It is also where the desk alerts hang (`onChange`), for the same reason the
 * badge does: this is the one place in the app that hears every arriving line.
 * They read the raw row rather than the refresh, and their "should this fire"
 * question is not the same as the refresh's — see lib/chat-alerts.ts.
 */
export function ChatLiveRefresh({
  meId,
  members,
}: {
  meId: string;
  /** Names for the notification headline — see lib/chat-alerts.ts. */
  members: MembersMap;
}) {
  const pathname = usePathname();
  // "" when not inside a thread; a member id, or GROUP_THREAD, when we are.
  const open = pathname.startsWith("/messages/")
    ? pathname.slice("/messages/".length)
    : "";
  const alert = useChatAlerts({ meId, members, openThread: open });

  const shouldRefresh = useCallback(
    (payload: ChangePayload) => {
      if (!open) return true;
      const row = (payload.new ?? payload.old) as
        | {
            sender_id?: string | null;
            recipient_id?: string | null;
            user_id?: string | null;
          }
        | undefined;
      if (!row) return true;

      // My own group read-marker write, while I'm in the group chat.
      if (payload.table === "message_reads")
        return !(open === GROUP_THREAD && row.user_id === meId);

      // Group rows carry a null recipient; a DM row belongs to the open thread
      // when it runs in either direction between me and that person.
      if (open === GROUP_THREAD) return row.recipient_id !== null;
      return !(
        (row.sender_id === open && row.recipient_id === meId) ||
        (row.sender_id === meId && row.recipient_id === open)
      );
    },
    [open, meId]
  );

  return (
    <LiveRefresh
      tables={["messages", "message_reads"]}
      shouldRefresh={shouldRefresh}
      onChange={alert}
    />
  );
}
