"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { GROUP_HINT, GROUP_LABEL, GROUP_THREAD } from "@/lib/messages-shared";
import { useLivePresence, type LiveState } from "@/lib/use-live-presence";
import { cn, formatRelative } from "@/lib/utils";
import type { PresencePerson } from "@/lib/types";

/** Same vocabulary as the sidebar presence panel. */
const DOT: Record<LiveState, string> = {
  online: "bg-primary",
  away: "bg-amber",
  offline: "bg-line-strong",
};

export type ThreadSummary = {
  /** Last line either direction, already reduced to a preview string. */
  preview: string;
  at: string;
  unread: number;
};

/**
 * The persistent list of conversations.
 *
 * Lives in `messages/layout.tsx`, not in a page: a layout is rendered by the
 * PARENT segment's router slot, so it survives navigation between
 * `/messages/<a>` and `/messages/<b>` (only the `[userId]` segment is re-keyed).
 * That is what makes switching threads instant and stops the route-change fade
 * and the loading skeleton from replaying over the whole surface.
 *
 * ORDERING. The old inbox sorted by last-message time alone, so five unread from
 * three days ago sat below someone you messaged two minutes ago who owed you
 * nothing — which is the opposite of PRODUCT.md's first principle. Unread now
 * sorts first, and unread rows carry real typographic weight instead of
 * differing only by a pill in a ragged right-hand column. People you have never
 * messaged are separated out under their own heading rather than being
 * distinguishable from a quiet conversation only by reading the sub-line.
 */
export function ThreadList({
  people,
  threads,
  group,
  meId,
}: {
  people: PresencePerson[];
  /** partnerId → summary. Absent = never messaged. */
  threads: Record<string, ThreadSummary>;
  group: ThreadSummary | null;
  meId: string;
}) {
  const pathname = usePathname();
  const live = useLivePresence(meId);
  // Server-rendered relative labels are frozen at render time; the sidebar
  // presence panel ticks for the same reason.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const { talking, fresh } = useMemo(() => {
    const withThread = people.filter((p) => threads[p.id]);
    const without = people.filter((p) => !threads[p.id]);
    withThread.sort((a, b) => {
      const ta = threads[a.id]!;
      const tb = threads[b.id]!;
      // Unread first — that is the whole question the list answers.
      if ((tb.unread > 0 ? 1 : 0) !== (ta.unread > 0 ? 1 : 0))
        return (tb.unread > 0 ? 1 : 0) - (ta.unread > 0 ? 1 : 0);
      return tb.at.localeCompare(ta.at) || a.name.localeCompare(b.name);
    });
    without.sort((a, b) => a.name.localeCompare(b.name));
    return { talking: withThread, fresh: without };
  }, [people, threads]);

  const groupActive = pathname === `/messages/${GROUP_THREAD}`;

  return (
    <nav
      aria-label="Conversations"
      className="flex h-full min-h-0 flex-col overflow-y-auto"
    >
      <Row
        href={`/messages/${GROUP_THREAD}`}
        active={groupActive}
        avatar={
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised">
            <Users className="size-4 text-muted" aria-hidden />
          </span>
        }
        name={GROUP_LABEL}
        preview={group?.preview ?? GROUP_HINT}
        at={group?.at}
        unread={group?.unread ?? 0}
        now={now}
      />

      {talking.length > 0 && <Heading>Conversations</Heading>}
      {talking.map((p) => {
        const t = threads[p.id]!;
        return (
          <Row
            key={p.id}
            href={`/messages/${p.id}`}
            active={pathname === `/messages/${p.id}`}
            avatar={<Avatar person={p} live={live[p.id] ?? "offline"} />}
            name={p.name}
            nameColor={p.color}
            preview={t.preview}
            at={t.at}
            unread={t.unread}
            now={now}
          />
        );
      })}

      {fresh.length > 0 && <Heading>Start a chat</Heading>}
      {fresh.map((p) => (
        <Row
          key={p.id}
          href={`/messages/${p.id}`}
          active={pathname === `/messages/${p.id}`}
          avatar={<Avatar person={p} live={live[p.id] ?? "offline"} />}
          name={p.name}
          nameColor={p.color}
          preview="No messages yet."
          unread={0}
          now={now}
        />
      ))}
    </nav>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-faint">
      {children}
    </h2>
  );
}

function Avatar({
  person,
  live,
}: {
  person: PresencePerson;
  live: LiveState;
}) {
  return (
    <span className="relative shrink-0">
      <span
        className="flex size-8 items-center justify-center rounded-full text-[13px] font-semibold text-bg"
        style={{ backgroundColor: person.color }}
        aria-hidden
      >
        {person.name.slice(0, 1).toUpperCase()}
      </span>
      {/* Neither the inbox nor the thread header said whether the person was
          even here, while the sidebar two panels away did. */}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface",
          DOT[live]
        )}
        aria-hidden
      />
      <span className="sr-only">
        {live === "online" ? "Online" : live === "away" ? "Away" : "Offline"}
      </span>
    </span>
  );
}

function Row({
  href,
  active,
  avatar,
  name,
  nameColor,
  preview,
  at,
  unread,
  now,
}: {
  href: string;
  active: boolean;
  avatar: React.ReactNode;
  name: string;
  nameColor?: string;
  preview: string;
  at?: string;
  unread: number;
  now: number;
}) {
  const hot = unread > 0;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150",
        active ? "bg-raised" : "hover:bg-raised/60"
      )}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            hot ? "font-semibold text-ink" : "font-medium"
          )}
          style={nameColor && !hot ? { color: nameColor } : undefined}
        >
          {name}
        </span>
        <span
          className={cn(
            "block truncate text-[13px]",
            hot ? "text-ink" : "text-muted"
          )}
        >
          {preview}
        </span>
      </span>
      {/* Fixed-width right column so the counts line up and can be scanned.
          They used to sit after a variable-width timestamp, so no two pills
          shared an x-position. */}
      <span className="flex w-12 shrink-0 flex-col items-end gap-1">
        {at && (
          <span className="font-mono text-xs text-faint">
            {formatRelative(at, new Date(now))}
          </span>
        )}
        {hot && (
          <span className="rounded-full bg-primary px-1.5 font-mono text-xs font-medium text-primary-ink">
            {unread}
          </span>
        )}
      </span>
    </Link>
  );
}
