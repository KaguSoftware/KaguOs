import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { canAccess, getSessionContext, requireSection } from "@/lib/data/session";
import { getPresence } from "@/lib/data/presence";
import {
  getGroupAudience,
  getGroupReadMarkers,
  getGroupThread,
  getThread,
} from "@/lib/data/messages";
import { getMembersMap } from "@/lib/data/members";
import { DmHeader } from "@/components/messages/dm-header";
import { MessageThread } from "@/components/messages/thread";
import { GROUP_HINT, GROUP_LABEL, GROUP_THREAD } from "@/lib/messages-shared";

/**
 * Name the tab after who you're talking to. Every thread's tab said "Messages",
 * so three chats open were three identical tabs.
 *
 * Both lookups are React cache()-deduped against the page render below, so this
 * costs no extra round trip. It uses getSessionContext rather than
 * requireSection because metadata must not redirect.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  if (userId === GROUP_THREAD) return { title: GROUP_LABEL };
  const ctx = await getSessionContext();
  if (!canAccess(ctx, "chat") || ctx.showcase) return { title: "Messages" };
  const members = await getMembersMap(ctx.supabase);
  return { title: members[userId]?.name ?? "Messages" };
}

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
  const ctx = await requireSection("chat");
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
  /**
   * The id of the first line I haven't read — where the "N new" divider goes.
   *
   * This used to be reduced to a BOOLEAN here, which threw away the one piece of
   * information needed to show someone where they left off. Opening a thread with
   * fourteen unread landed you at the bottom with no marker, and marking-on-open
   * then destroyed the evidence.
   */
  const unread = isGroup
    ? // No marker yet = first time in the room, so nothing counts as unread; the
      // mark on open SEEDS the marker (see countGroupUnread).
      groupReadAt === null
      ? []
      : thread.messages.filter(
          (m) => m.sender_id !== ctx.userId && m.created_at > groupReadAt
        )
    : thread.messages.filter((m) => m.sender_id === userId && !m.read_at);
  const initialUnread = isGroup ? groupReadAt === null || unread.length > 0 : unread.length > 0;
  const firstUnreadId = unread[0]?.id ?? null;

  return (
    // The height lives on the messages layout now, shared by both panes; this
    // just fills its column. min-h-96 is gone too — on a short viewport with the
    // keyboard open it forced the PAGE to scroll instead of the message list.
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <Link
          href="/messages"
          aria-label="Back to conversations"
          // Only a phone needs this: on md+ the list is right there beside us.
          className="rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-raised hover:text-ink md:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        {isGroup ? (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised">
              <Users className="size-4 text-muted" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[calc(15px*var(--text-scale,1))] font-semibold text-ink">
                {GROUP_LABEL}
              </h1>
              <p className="text-xs text-faint">{GROUP_HINT}</p>
            </div>
          </>
        ) : (
          // Client island: carries the LIVE presence dot + label, which the
          // list pane provides on desktop but mobile hides while in a thread.
          <DmHeader
            meId={ctx.userId}
            partnerId={userId}
            name={partner!.name}
            color={partner!.color}
            statusEmoji={person?.status_emoji ?? null}
            statusText={person?.status_text ?? null}
            former={former}
          />
        )}
      </header>
      <MessageThread
        initialMessages={thread.messages}
        initialHasOlder={thread.hasOlder}
        readOnly={former}
        firstUnreadId={firstUnreadId}
        unreadCount={unread.length}
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
