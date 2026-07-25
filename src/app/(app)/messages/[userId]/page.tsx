import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getPresence } from "@/lib/data/presence";
import {
  getGroupAudience,
  getGroupReadMarkers,
  getGroupThread,
  getThread,
} from "@/lib/data/messages";
import { getMembersMap } from "@/lib/data/members";
import { MessageThread } from "@/components/messages/thread";
import { GROUP_LABEL, GROUP_THREAD } from "@/lib/messages-shared";

export const metadata: Metadata = { title: "Messages" };

/** Member ids are uuids; anything else is a bad URL, not a missing person. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // A segment that isn't a uuid can't be a member id. Letting it reach the query
  // makes Postgres reject the cast, which surfaces as the section error screen
  // ("something went wrong") instead of an honest "no such page".
  if (!isGroup && !UUID.test(userId)) notFound();
  if (!isGroup && userId === ctx.userId) notFound();

  // One wave: the thread + the roster (validates the id, names the header) +
  // for the group, the full audience and everyone's last-read marker — both
  // needed for "seen by" and neither the client can know otherwise.
  const [thread, presence, members, audience, readMarkers] = await Promise.all([
    isGroup ? getGroupThread(ctx) : getThread(ctx, userId),
    getPresence(ctx),
    getMembersMap(ctx.supabase),
    isGroup ? getGroupAudience(ctx) : Promise.resolve(null),
    isGroup ? getGroupReadMarkers(ctx) : Promise.resolve(null),
  ]);

  const person = isGroup
    ? null
    : (presence ?? []).find((p) => p.id === userId);
  /**
   * Someone who has LEFT the work team is absent from the presence roster, but
   * the messages between you and your unread from them both still exist.
   * `notFound()` here meant a permanently lit badge with no surface able to
   * clear it, and an unread-DM toast whose link led to a dead page.
   *
   * So the thread stays readable — only the composer goes. The members map
   * covers every profile, not just the audience, so their name still resolves.
   */
  const former = !isGroup && !person;
  const partner = person ?? (former ? members[userId] : undefined);
  if (!isGroup && !partner) notFound();

  // Whether opening this thread should consume unread (and drop the badge).
  // Only the newest page is inspected, which is enough — the newest unread line
  // is always on it.
  const groupReadAt = readMarkers?.[ctx.userId] ?? null;
  const initialUnread = isGroup
    ? // No marker yet = first time in the room. Mark on open to SEED it, which
      // is what lets countGroupUnread treat a missing marker as zero instead of
      // showing a new member the whole room history as unread.
      groupReadAt === null ||
      thread.messages.some(
        (m) => m.sender_id !== ctx.userId && m.created_at > groupReadAt
      )
    : thread.messages.some((m) => m.sender_id === userId && !m.read_at);

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
              style={{ backgroundColor: partner!.color }}
              aria-hidden
            >
              {partner!.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1
                className="truncate text-[15px] font-semibold"
                style={{ color: partner!.color }}
              >
                {partner!.name}
                {person?.status_emoji && (
                  <span className="ml-1.5" aria-hidden>
                    {person.status_emoji}
                  </span>
                )}
              </h1>
              {former ? (
                <p className="truncate text-[12px] text-faint">
                  No longer on the work team — you can still read this.
                </p>
              ) : (
                person?.status_text && (
                  <p className="truncate text-[12px] text-faint">
                    {person.status_text}
                  </p>
                )
              )}
            </div>
          </>
        )}
      </header>
      <MessageThread
        initialMessages={thread.messages}
        initialHasOlder={thread.hasOlder}
        readOnly={former}
        meId={ctx.userId}
        otherId={isGroup ? null : userId}
        members={members}
        initialUnread={initialUnread}
        audience={audience}
        readMarkers={readMarkers}
      />
    </div>
  );
}
