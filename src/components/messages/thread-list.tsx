"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { GROUP_HINT, GROUP_LABEL, GROUP_THREAD } from "@/lib/messages-shared";
import { useLivePresence, type LiveState } from "@/lib/use-live-presence";
import { cn, formatRelative } from "@/lib/utils";
import type { PresencePerson } from "@/lib/types";
import { accentMix, accentVar } from "@/lib/section-accent";
import { AccentRule, RiseText } from "@/components/ui/rise-text";

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
  // One running index across all three groups, so the names rise as one
  // cascade down the pane rather than restarting at each heading. Capped so a
  // long directory doesn't keep arriving for seconds.
  let n = 0;
  const next = () => Math.min(n++, 12);

  return (
    <nav
      aria-label="Conversations"
      className="flex h-full min-h-0 flex-col overflow-y-auto px-3 pb-6 md:px-4"
    >
      {/* The pane's own display title — Messages is full-bleed and has no
          PageHeader, so this is where the section announces itself. An h2:
          the open thread's name (or "Pick a conversation") is the page's h1. */}
      <header className="px-2 pb-4 pt-6 md:pt-8">
        <h2 className="text-[calc(40px*var(--text-scale,1))] leading-none font-semibold uppercase tracking-[-0.045em] text-ink">
          <RiseText delay={40}>Messages</RiseText>
        </h2>
        <AccentRule color={accentVar("messages")} delay={160} />
      </header>

      <Row
        href={`/messages/${GROUP_THREAD}`}
        active={groupActive}
        marker={<Users className="size-4 text-muted" aria-hidden />}
        name={GROUP_LABEL}
        preview={group?.preview ?? GROUP_HINT}
        at={group?.at}
        unread={group?.unread ?? 0}
        now={now}
        index={next()}
      />

      {talking.length > 0 && <Heading>Conversations</Heading>}
      {talking.map((p) => {
        const t = threads[p.id]!;
        return (
          <Row
            key={p.id}
            href={`/messages/${p.id}`}
            active={pathname === `/messages/${p.id}`}
            marker={<Dot person={p} live={live[p.id] ?? "offline"} />}
            name={p.name}
            preview={t.preview}
            at={t.at}
            unread={t.unread}
            now={now}
            index={next()}
          />
        );
      })}

      {fresh.length > 0 && <Heading>Start a chat</Heading>}
      {fresh.map((p) => (
        <Row
          key={p.id}
          href={`/messages/${p.id}`}
          active={pathname === `/messages/${p.id}`}
          marker={<Dot person={p} live={live[p.id] ?? "offline"} />}
          name={p.name}
          unread={0}
          now={now}
          index={next()}
          quiet
        />
      ))}
    </nav>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-2 pb-1 pt-6 text-xs font-medium text-faint">
      {children}
    </h2>
  );
}

/**
 * Presence as a dot beside the name — the big type carries identity now, so
 * the avatar circle went. The ring is the person's colour, so their hue still
 * travels with them from the sidebar to the thread.
 */
function Dot({ person, live }: { person: PresencePerson; live: LiveState }) {
  return (
    <>
      <span
        className={cn("block size-2.5 rounded-full ring-2 ring-offset-2 ring-offset-surface", DOT[live])}
        style={{ ["--tw-ring-color" as string]: person.color }}
        aria-hidden
      />
      <span className="sr-only">
        {live === "online" ? "Online" : live === "away" ? "Away" : "Offline"}
      </span>
    </>
  );
}

function Row({
  href,
  active,
  marker,
  name,
  preview,
  at,
  unread,
  now,
  index,
  quiet,
}: {
  href: string;
  active: boolean;
  marker: React.ReactNode;
  name: string;
  preview?: string;
  at?: string;
  unread: number;
  now: number;
  /** Position in the pane — staggers the name's rise. */
  index: number;
  /** Someone you've never messaged: smaller, sentence-case — the directory,
      not a conversation. */
  quiet?: boolean;
}) {
  const hot = unread > 0;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-start gap-3 overflow-hidden rounded-lg px-2 transition-colors duration-150",
        quiet ? "py-1.5" : "py-2.5",
        !active && "hover:bg-raised/60"
      )}
    >
      {/* The active fill draws in from the left each time a row BECOMES
          active — same gesture as the sidebar's selected row. */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 origin-left motion-safe:animate-[wipe-x_360ms_var(--ease-mac)_both]"
          style={{ backgroundColor: accentMix("messages", 14) }}
        />
      )}
      <span
        className={cn(
          "relative grid w-4 shrink-0 place-items-center",
          quiet ? "h-[1.25em] text-[calc(15px*var(--text-scale,1))]" : "h-[calc(22px*var(--text-scale,1))]"
        )}
      >
        {marker}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <RiseText
            delay={index * 40 + 140}
            className="min-w-0"
            innerClassName={cn(
              "truncate",
              quiet
                ? "text-[calc(15px*var(--text-scale,1))] font-medium text-muted group-hover:text-ink"
                : "text-[calc(22px*var(--text-scale,1))] leading-none font-semibold uppercase tracking-[-0.03em] text-ink"
            )}
          >
            {name}
          </RiseText>
          {/* Unread as a superscript in the Messages hue — the phone menu's
              device — instead of a pill in a ragged right column. */}
          {hot && (
            <span
              className="shrink-0 font-mono text-[calc(13px*var(--text-scale,1))] font-medium tabular-nums"
              style={{ color: accentVar("messages") }}
            >
              {unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </span>
        {preview && (
          <span
            className={cn(
              "mt-1 block truncate text-[calc(13px*var(--text-scale,1))]",
              hot ? "text-ink" : "text-muted"
            )}
          >
            {preview}
          </span>
        )}
      </span>
      {at && (
        <span className="relative shrink-0 pt-0.5 font-mono text-xs text-faint">
          {formatRelative(at, new Date(now))}
        </span>
      )}
    </Link>
  );
}
