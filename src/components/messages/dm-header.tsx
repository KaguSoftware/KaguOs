"use client";

import { useLivePresence, type LiveState } from "@/lib/use-live-presence";
import { cn } from "@/lib/utils";

/** Same vocabulary as the thread list and the sidebar presence panel. */
const DOT: Record<LiveState, string> = {
  online: "bg-primary",
  away: "bg-amber",
  offline: "bg-line-strong",
};

const LABEL: Record<LiveState, string> = {
  online: "Online",
  away: "Away",
  offline: "Offline",
};

/**
 * The DM header's identity block — avatar, name, status — with a LIVE presence
 * dot and label.
 *
 * A client island because presence is ephemeral socket state the server page
 * can't know. The gap it closes is a phone's: on md+ the thread list beside the
 * conversation carries a presence dot, but mobile hides that pane while a
 * thread is open (see MessagesPanes), so nothing on screen said whether the
 * person you were typing to was even here.
 */
export function DmHeader({
  meId,
  partnerId,
  name,
  color,
  statusEmoji,
  statusText,
  former,
}: {
  meId: string;
  partnerId: string;
  name: string;
  color: string;
  statusEmoji: string | null;
  statusText: string | null;
  /** No longer on the work team — they can't be "here", so no dot, no label. */
  former: boolean;
}) {
  const live = useLivePresence(meId);
  const state: LiveState = live[partnerId] ?? "offline";

  return (
    <>
      <span className="relative shrink-0" aria-hidden>
        <span
          className="flex size-8 items-center justify-center rounded-full text-[13px] font-semibold text-bg"
          style={{ backgroundColor: color }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        {!former && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-bg transition-colors duration-300 ease-mac",
              DOT[state]
            )}
          />
        )}
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold" style={{ color }}>
          {name}
          {statusEmoji && (
            <span className="ml-1.5" aria-hidden>
              {statusEmoji}
            </span>
          )}
        </h1>
        {former ? (
          <p className="truncate text-[12px] text-faint">
            No longer on the work team — you can still read this.
          </p>
        ) : (
          <p className="truncate text-[12px] text-faint">
            {LABEL[state]}
            {statusText && <span> · {statusText}</span>}
          </p>
        )}
      </div>
    </>
  );
}
