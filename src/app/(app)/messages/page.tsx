import type { Metadata } from "next";
import { accentVar } from "@/lib/section-accent";
import { AccentRule, RiseText } from "@/components/ui/rise-text";

export const metadata: Metadata = { title: "Messages" };

/**
 * The right-hand pane with no thread open.
 *
 * This route used to BE the inbox. The list moved up into `layout.tsx` so it can
 * persist across thread switches, which leaves this as the desktop resting state
 * — and on mobile it is never seen at all, because `MessagesPanes` shows the list
 * in its place at this path.
 *
 * Display type rather than an empty-state card: with the pane full-bleed, a
 * small centred card read as something missing; a headline reads as a place.
 */
export default function MessagesIndexPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center py-10">
      <h1 className="text-[calc(clamp(44px,6vw,88px)*var(--text-scale,1))] leading-[0.92] font-semibold uppercase tracking-[-0.05em] text-ink">
        <RiseText delay={80}>Pick a</RiseText>
        <RiseText delay={170}>conversation.</RiseText>
      </h1>
      <AccentRule color={accentVar("messages")} delay={320} />
      <p className="mt-5 max-w-md text-[calc(15px*var(--text-scale,1))] text-muted motion-safe:animate-[page-in_400ms_var(--ease-mac)_420ms_both]">
        Choose someone on the left, or open the team room to talk to everyone at
        once. Anything you send here stays inside the team.
      </p>
    </div>
  );
}
