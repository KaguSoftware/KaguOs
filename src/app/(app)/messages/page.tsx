import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Users } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getPresence } from "@/lib/data/presence";
import { getInboxSummary } from "@/lib/data/messages";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GROUP_LABEL, GROUP_THREAD } from "@/lib/messages-shared";
import { formatRelative } from "@/lib/utils";
import type { Message } from "@/lib/types";

export const metadata: Metadata = { title: "Messages" };

/** One line of preview — who said it isn't needed when it's you. */
function preview(m: Message, meId: string) {
  return `${m.sender_id === meId ? "You: " : ""}${m.body}`;
}

/**
 * The inbox. With 8 people it doubles as the "start a chat" picker: EVERY
 * member of the chat audience is a row whether you've talked or not — the
 * group chat first, then people with traffic (newest first), then the rest.
 */
export default async function MessagesPage() {
  const ctx = await requireSection("work");

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

  // One wave: the roster (presence — names, colors, status) + the summaries.
  const [presence, inbox] = await Promise.all([
    getPresence(ctx),
    getInboxSummary(ctx),
  ]);
  const people = (presence ?? []).filter((p) => p.id !== ctx.userId);
  // Both gates above (work access + not showcase) are the loader's own, so
  // this only defends against a future gate drift — never an error path.
  const summary = inbox ?? { direct: {}, group: { last: null, unread: 0 } };

  const withLast = (id: string) => summary.direct[id]?.last?.created_at ?? "";
  const roster = [...people].sort(
    (a, b) => withLast(b.id).localeCompare(withLast(a.id)) || a.name.localeCompare(b.name)
  );

  return (
    <>
      {/* No LiveRefresh here — the layout already refreshes on `messages`,
          and a second channel would just double the socket traffic. */}
      <PageHeader
        title="Messages"
        description="The work team, one thread each — plus the group."
      />
      <ul className="divide-y divide-line rounded-lg border border-line">
        <li>
          <Link
            href={`/messages/${GROUP_THREAD}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-raised/60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised">
              <Users className="size-4 text-muted" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {GROUP_LABEL}
              </span>
              <span className="block truncate text-[13px] text-muted">
                {summary.group.last
                  ? preview(summary.group.last, ctx.userId)
                  : "The whole work team, one room."}
              </span>
            </span>
            {summary.group.last && (
              <span className="shrink-0 font-mono text-[11px] text-faint">
                {formatRelative(summary.group.last.created_at)}
              </span>
            )}
            {summary.group.unread > 0 && (
              <span className="shrink-0 rounded-full bg-primary px-1.5 font-mono text-[11px] font-medium text-primary-ink">
                {summary.group.unread}
              </span>
            )}
          </Link>
        </li>
        {roster.map((p) => {
          const thread = summary.direct[p.id];
          return (
            <li key={p.id}>
              <Link
                href={`/messages/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-raised/60"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-bg"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-sm font-medium"
                    style={{ color: p.color }}
                  >
                    {p.name}
                    {p.status_emoji && (
                      <span className="ml-1.5" aria-hidden>
                        {p.status_emoji}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[13px] text-muted">
                    {thread
                      ? preview(thread.last, ctx.userId)
                      : "No messages yet."}
                  </span>
                </span>
                {thread && (
                  <span className="shrink-0 font-mono text-[11px] text-faint">
                    {formatRelative(thread.last.created_at)}
                  </span>
                )}
                {thread && thread.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-primary px-1.5 font-mono text-[11px] font-medium text-primary-ink">
                    {thread.unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
