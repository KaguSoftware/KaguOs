"use client";

import { Volume2 } from "lucide-react";
import { playChime, primeChime, useAlertPrefs } from "@/lib/chat-alerts";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonClasses } from "@/lib/utils";

/**
 * Where message alerts live once the one-time prompt on Messages is gone.
 *
 * PER DEVICE, not per account — deliberately, and said so on screen. Both
 * settings are browser facts: a Notification grant belongs to this browser on
 * this machine, and syncing the chime to the profile would mean turning it off
 * on the laptop also turns it off on the desk machine you actually wanted it on.
 * So they're stored in `kagu:*` localStorage alongside the board filters and the
 * chat drafts, and the copy has to carry that, or "I turned this off" becomes a
 * bug report from the other machine.
 *
 * A denied permission is a dead end from here: browsers give a page no way back,
 * by design. All this can do is name the place that can.
 */
export function ChatAlertsForm() {
  const { sound, permission, setSound, ask } = useAlertPrefs();

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm text-ink">Desktop notifications</p>
          <p className="mt-0.5 text-[13px] text-faint">
            {permission === "granted"
              ? "On. New messages show as a banner when KaguOs isn't in front of you."
              : permission === "denied"
                ? "Blocked for this site. Your browser's site settings are the only place that can undo that."
                : permission === "unsupported"
                  ? "This browser doesn't support desktop notifications."
                  : "Off. A banner when a message arrives while you're in another window."}
          </p>
        </div>
        {permission === "default" && (
          <button
            type="button"
            onClick={() => void ask()}
            className={buttonClasses("outline", "sm")}
          >
            Turn on
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4">
        <div className="min-w-0">
          <Checkbox
            checked={sound}
            onChange={(e) => setSound(e.currentTarget.checked)}
            label="Play a sound for new messages"
            className="text-ink"
          />
          <p className="mt-0.5 text-[13px] text-faint">
            Plays unless you already have that conversation open in front of you.
          </p>
        </div>
        {/* Hearing it is the only way to judge it — and this click is a user
            gesture, so it also unlocks the audio context for the session. */}
        <button
          type="button"
          onClick={() => {
            primeChime();
            playChime();
          }}
          disabled={!sound}
          className={buttonClasses("ghost", "sm")}
        >
          <Volume2 className="size-3.5" aria-hidden />
          Play
        </button>
      </div>

      <p className="border-t border-line pt-3 text-xs text-faint">
        Both settings apply to this browser only — each device you sign in on has
        its own.
      </p>
    </div>
  );
}
