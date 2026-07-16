"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Trash2 } from "lucide-react";
import { clearAll, markAllRead } from "@/lib/actions/notifications";
import { useAction } from "@/lib/use-action";
import { cn, formatRelative } from "@/lib/utils";
import type { MembersMap, Notification } from "@/lib/types";

export function NotificationBell({
  notifications,
  members,
  align = "right",
}: {
  notifications: Notification[];
  members: MembersMap;
  /** Which edge the tray anchors to. In the narrow desktop sidebar use
   *  "left" so the 320px tray opens into the content, not off-screen. */
  align?: "left" | "right";
}) {
  const router = useRouter();
  const { run } = useAction();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Opening the tray marks everything read.
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      run(() => markAllRead(), { onSuccess: () => router.refresh() });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative rounded-md p-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-ink"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-pop-in overflow-hidden rounded-lg border border-line bg-raised shadow-lg shadow-black/40",
            align === "left"
              ? "left-0 origin-top-left"
              : "right-0 origin-top-right"
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[13px] font-semibold text-ink">Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  run(() => clearAll(), { onSuccess: () => router.refresh() })
                }
                className="inline-flex items-center gap-1 text-xs text-faint transition-colors hover:text-danger"
              >
                <Trash2 className="size-3" aria-hidden />
                Clear
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="flex items-center justify-center gap-1.5 px-3 py-8 text-center text-[13px] text-faint">
              <Check className="size-3.5" aria-hidden />
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notifications.map((n) => {
                const actor = n.actor_id ? members[n.actor_id] : null;
                const body = (
                  <div
                    className={cn(
                      "px-3 py-2.5 transition-colors duration-150 hover:bg-surface",
                      !n.read_at && "bg-primary/5"
                    )}
                  >
                    <p className="text-[13px] leading-snug text-ink">{n.title}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {actor && (
                        <span style={{ color: actor.color }}>{actor.name} · </span>
                      )}
                      {formatRelative(n.created_at)}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
