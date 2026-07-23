import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getPresence } from "@/lib/data/presence";
import { getGroupThread, getThread } from "@/lib/data/messages";
import { getMembersMap } from "@/lib/data/members";
import { selectOrThrow } from "@/lib/data/query";
import { MessageThread } from "@/components/messages/thread";
import { GROUP_LABEL, GROUP_THREAD } from "@/lib/messages-shared";

export const metadata: Metadata = { title: "Messages" };

/**
 * One thread: /messages/<memberId>, or /messages/team for the group chat.
 * The header is the person (identity color + their current status text) or
 * the group; the body is the live thread + composer.
 */
export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const ctx = await requireSection("work");
  // Chat carries real conversations — showcase never reaches a thread.
  if (ctx.showcase) notFound();

  const isGroup = userId === GROUP_THREAD;
  if (!isGroup && userId === ctx.userId) notFound();

  // One wave: the thread + the roster (validates the id, names the header) +
  // for the group, my last-read marker — the client can't know it otherwise.
  const [thread, presence, members, marker] = await Promise.all([
    isGroup ? getGroupThread(ctx) : getThread(ctx, userId),
    getPresence(ctx),
    getMembersMap(ctx.supabase),
    isGroup
      ? selectOrThrow(
          ctx.supabase
            .from("message_reads")
            .select("read_at")
            .eq("user_id", ctx.userId)
            .maybeSingle(),
          "message_reads"
        )
      : null,
  ]);

  const person = isGroup
    ? null
    : (presence ?? []).find((p) => p.id === userId);
  if (!isGroup && !person) notFound();

  // Whether opening this thread should consume unread (and drop the badge).
  const groupReadAt = marker?.data?.read_at ?? null;
  const initialUnread = isGroup
    ? thread.some(
        (m) =>
          m.sender_id !== ctx.userId &&
          (!groupReadAt || m.created_at > groupReadAt)
      )
    : thread.some((m) => m.sender_id === userId && !m.read_at);

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-96 flex-col md:h-[calc(100dvh-11rem)]">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        {isGroup ? (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised">
              <Users className="size-4 text-muted" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-ink">
                {GROUP_LABEL}
              </h1>
              <p className="text-[12px] text-faint">
                Every work member, one room.
              </p>
            </div>
          </>
        ) : (
          <>
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-bg"
              style={{ backgroundColor: person!.color }}
              aria-hidden
            >
              {person!.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1
                className="truncate text-[15px] font-semibold"
                style={{ color: person!.color }}
              >
                {person!.name}
                {person!.status_emoji && (
                  <span className="ml-1.5" aria-hidden>
                    {person!.status_emoji}
                  </span>
                )}
              </h1>
              {person!.status_text && (
                <p className="truncate text-[12px] text-faint">
                  {person!.status_text}
                </p>
              )}
            </div>
          </>
        )}
      </header>
      <MessageThread
        initialMessages={thread}
        meId={ctx.userId}
        otherId={isGroup ? null : userId}
        members={members}
        initialUnread={initialUnread}
      />
    </div>
  );
}
