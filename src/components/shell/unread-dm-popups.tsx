"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import type { MembersMap } from "@/lib/types";

export type UnreadDmThread = {
  partnerId: string;
  lastBody: string;
  lastAt: string;
};

/**
 * A small toast per unread direct message, re-shown on the layout's
 * incidental refreshes (LiveRefresh's router.refresh() on any `messages`
 * change) until the thread is opened and marked read.
 *
 * Dedup is keyed on `lastAt`: a partner already popped for their newest
 * unread line doesn't pop again on the next 150ms-debounced refresh of the
 * SAME data — only a genuinely newer message (a later `lastAt`) re-arms it.
 * The moment a thread is opened, `markThreadRead` drops its unread count to
 * 0 and the layout stops sending it here at all, which clears the entry
 * below and lets a future new message from that person pop fresh again.
 */
export function UnreadDmPopups({
  threads,
  members,
}: {
  threads: UnreadDmThread[];
  members: MembersMap;
}) {
  const { toast } = useToast();
  const shown = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const t of threads) {
      if (shown.current.get(t.partnerId) === t.lastAt) continue;
      shown.current.set(t.partnerId, t.lastAt);
      toast({
        tone: "info",
        message: `${members[t.partnerId]?.name ?? "Someone"}: ${t.lastBody}`,
        href: `/messages/${t.partnerId}`,
      });
    }
    for (const id of [...shown.current.keys()]) {
      if (!threads.some((t) => t.partnerId === id)) shown.current.delete(id);
    }
  }, [threads, members, toast]);

  return null;
}
