"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Strip any count we previously prefixed, so it never compounds. */
const PREFIX = /^\(\d+\)\s*/;

/**
 * Put the unread count in the tab title.
 *
 * KaguOs is a desk tool that spends most of its day in a background tab, where
 * the sidebar badge — the only unread signal — is invisible. This is the cheapest
 * possible way to make "someone wrote to you" visible from another tab, and it
 * needs no permission prompt, unlike the Notification API.
 *
 * Re-applied on pathname change as well as on count change: Next writes
 * `document.title` from the route's metadata on every navigation, which would
 * otherwise drop the prefix until the next time the count moved.
 */
export function TitleUnread({ count }: { count: number }) {
  const pathname = usePathname();

  useEffect(() => {
    const base = document.title.replace(PREFIX, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, pathname]);

  return null;
}
