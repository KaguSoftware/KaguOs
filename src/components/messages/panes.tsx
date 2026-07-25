"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Two panes on desktop, one at a time on mobile.
 *
 * The layout is a server component and can't read the pathname, so this thin
 * client wrapper decides which pane a phone sees: the list at `/messages`, the
 * thread at `/messages/<id>`. On `md` and up both are always visible, which is
 * the point of the whole exercise — the list stops being a separate destination
 * you navigate away from and back to.
 *
 * Both panes are always RENDERED; only mobile visibility changes. That is what
 * keeps the list mounted (and its presence channel connected) while you move
 * between threads.
 */
export function MessagesPanes({
  list,
  children,
}: {
  list: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const inThread = pathname !== "/messages";

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <aside
        className={cn(
          "min-h-0 w-full shrink-0 md:block md:w-72 md:border-r md:border-line md:pr-2",
          inThread ? "hidden" : "block"
        )}
      >
        {list}
      </aside>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          inThread ? "flex" : "hidden md:flex"
        )}
      >
        {children}
      </div>
    </div>
  );
}
