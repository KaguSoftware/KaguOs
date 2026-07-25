import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Messages" };

/**
 * The right-hand pane with no thread open.
 *
 * This route used to BE the inbox. The list moved up into `layout.tsx` so it can
 * persist across thread switches, which leaves this as the desktop resting state
 * — and on mobile it is never seen at all, because `MessagesPanes` shows the list
 * in its place at this path.
 */
export default function MessagesIndexPage() {
  return (
    <div className="grid min-h-0 flex-1 place-items-center">
      <EmptyState
        icon={MessagesSquare}
        title="Pick a conversation"
        hint="Choose someone on the left, or open the Work team room to talk to everyone at once. Anything you send here stays inside the team."
      />
    </div>
  );
}
