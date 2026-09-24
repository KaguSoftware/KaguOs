"use client";

import { useLivePresence, type LiveState } from "@/lib/use-live-presence";
import { cn } from "@/lib/utils";
import { RiseText } from "@/components/ui/rise-text";

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
 * The DM header's identity block — display-size name, status — with a LIVE
 * presence dot (ringed in their colour) and label.
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
    // The name is display type in ink; the person's colour moves to the
    // presence dot's ring, so it still travels with them from the list.
    <div className="min-w-0">
      <h1 className="text-[calc(28px*var(--text-scale,1))] leading-none font-semibold uppercase tracking-[-0.04em] text-ink md:text-[calc(36px*var(--text-scale,1))]">
        <RiseText innerClassName="truncate">
          {name}
          {statusEmoji && (
            <span className="ml-2 align-middle text-[0.6em]" aria-hidden>
              {statusEmoji}
            </span>
          )}
        </RiseText>
      </h1>
      <p className="mt-1.5 flex min-w-0 items-center gap-2 text-[calc(12px*var(--text-scale,1))] text-faint">
        {!former && (
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-bg transition-colors duration-300 ease-mac",
              DOT[state]
            )}
            style={{ ["--tw-ring-color" as string]: color }}
          />
        )}
        <span className="truncate">
          {former ? (
            "No longer on the work team — you can still read this."
          ) : (
            <>
              {LABEL[state]}
              {statusText && <span> · {statusText}</span>}
            </>
          )}
        </span>
      </p>
    </div>
  );
}
