"use client";

import { Bell } from "lucide-react";
import { useAlertPrefs } from "@/lib/chat-alerts";
import { buttonClasses } from "@/lib/utils";

/**
 * The one-time ask for desktop notifications.
 *
 * WHY IT ISN'T CALLED ON MOUNT. `Notification.requestPermission()` fired from a
 * page load is the pattern browsers built their defences against: Chrome mutes
 * the dialog into a bell icon nobody sees, Safari refuses it outright unless a
 * gesture is attached, and a person ambushed by a permission dialog three
 * seconds into a session clicks Block — which is permanent, and can only be
 * undone in browser settings that most people never open. One wrong moment
 * costs the feature forever, so the browser's dialog is put behind our own
 * button, which explains what it's for first.
 *
 * WHY HERE. It sits on Messages and nowhere else: this is the one screen where
 * "tell me when a message arrives" is obviously about the thing in front of you.
 *
 * It shows exactly once per device — until permission is answered, or until
 * "Not now" retires it. `asked` is true in the server snapshot, so this renders
 * nothing in the HTML and appears only once hydration knows the real answer.
 */
export function ChatAlertsPrompt() {
  const { permission, asked, ask, dismissAsk } = useAlertPrefs();

  if (asked || permission !== "default") return null;

  return (
    // shrink-0: this sits in the Messages column, which is a fixed-height flex
    // column — without it the strip is the thing that gets squashed.
    <div className="mb-4 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3.5 py-2.5">
      <Bell className="size-4 shrink-0 text-primary-dim" aria-hidden />
      <p className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] text-muted">
        Get a sound and a desktop alert when someone messages you.
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={dismissAsk}
          className={buttonClasses("ghost", "sm")}
        >
          Not now
        </button>
        {/* The browser's own dialog opens from this click — a gesture Safari
            requires, and the one that unlocks the chime's audio context. */}
        <button
          type="button"
          onClick={() => void ask()}
          className={buttonClasses("primary", "sm")}
        >
          Turn on
        </button>
      </div>
    </div>
  );
}
