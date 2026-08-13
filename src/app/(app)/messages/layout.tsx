import { MessagesSquare } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getPresence } from "@/lib/data/presence";
import { getInboxSummary } from "@/lib/data/messages";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { MessagesPanes } from "@/components/messages/panes";
import { ChatAlertsPrompt } from "@/components/messages/alerts-prompt";
import {
  ThreadList,
  type ThreadSummary,
} from "@/components/messages/thread-list";
import type { Message } from "@/lib/types";

/** One line of preview — who said it isn't needed when it's you. */
function preview(m: Message, meId: string) {
  const mine = m.sender_id === meId ? "You: " : "";
  // An image-only message has an empty body, so this used to render a blank
  // preview (and a blank toast) — the row looked like it had no message at all.
  // A task card can travel alone too (task_id is a real column, so it's on the
  // inbox rows even though the card itself is only hydrated in the thread).
  const body =
    m.body ||
    (m.images?.length ? "Sent an image" : m.task_id ? "Shared a task" : "");
  return `${mine}${body}`;
}

/**
 * The messages shell: a persistent conversation list beside the open thread.
 *
 * WHY THIS IS A LAYOUT. Threads used to be reached by navigating from an inbox
 * page to a thread page and back via a arrow, so every switch tore down the
 * thread, re-authorized a websocket, replayed the route fade, and flashed the
 * generic three-block skeleton from `(app)/loading.tsx` — a silhouette shaped
 * like the dashboard, not a chat. A layout is rendered by the parent segment's
 * router slot and is NOT inside the node keyed on `[userId]`, so it survives
 * thread-to-thread navigation untouched. Only the right pane changes.
 */
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireSection("chat");

  // Chat has no demo shape — real names, real words. Showcase sees the door.
  if (ctx.showcase) {
    return (
      <>
        <PageHeader title="Messages" />
        <EmptyState
          icon={MessagesSquare}
          title="Not available in showcase"
          hint="Chat carries the team's real conversations, so the demo keeps it closed."
        />
      </>
    );
  }

  // One wave: the roster (names, colors, status) + the summaries.
  const [presence, inbox] = await Promise.all([
    getPresence(ctx),
    getInboxSummary(ctx),
  ]);
  const people = (presence ?? []).filter((p) => p.id !== ctx.userId);
  // Both gates above are the loader's own, so this only defends against a future
  // gate drift — never an error path.
  const summary = inbox ?? { direct: {}, group: { last: null, unread: 0 } };

  const threads: Record<string, ThreadSummary> = {};
  for (const [id, t] of Object.entries(summary.direct)) {
    threads[id] = {
      preview: preview(t.last, ctx.userId),
      at: t.last.created_at,
      unread: t.unread,
    };
  }
  const group: ThreadSummary | null = summary.group.last
    ? {
        preview: preview(summary.group.last, ctx.userId),
        at: summary.group.last.created_at,
        unread: summary.group.unread,
      }
    : null;

  return (
    // No LiveRefresh here — the shell's ChatLiveRefresh already watches these
    // tables app-wide, and a second channel would double the socket traffic.
    // The height constant is the one the thread page used to carry; it lives here
    // now so both panes share it and the thread simply fills its column.
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col md:h-[calc(100dvh-11rem)]">
      {/* Renders nothing once this device has answered — see alerts-prompt.tsx. */}
      <ChatAlertsPrompt />
      <MessagesPanes
        list={
          <ThreadList
            people={people}
            threads={threads}
            group={group}
            meId={ctx.userId}
          />
        }
      >
        {children}
      </MessagesPanes>
    </div>
  );
}
