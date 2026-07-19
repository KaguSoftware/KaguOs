"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bug,
  FolderKanban,
  Lightbulb,
  Megaphone,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type { ActivityItem, ActivityKind } from "@/lib/data/activity";
import type { MembersMap } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const KIND: Record<ActivityKind, { icon: LucideIcon; verb: string; label: string }> = {
  debug_task: { icon: Bug, verb: "posted a task", label: "Tasks" },
  idea: { icon: Lightbulb, verb: "posted an idea", label: "Ideas" },
  project: { icon: FolderKanban, verb: "started a project", label: "Projects" },
  transaction: { icon: Receipt, verb: "logged", label: "Money" },
  post: { icon: Megaphone, verb: "planned a post", label: "Posts" },
};

/** How many rows show before "Show more". */
const PAGE = 12;

export function ActivityFeed({
  items,
  members,
}: {
  items: ActivityItem[];
  members: MembersMap;
}) {
  // Filter by kind, and reveal in pages. Both are client-side over rows the
  // server already sent: with 8 people the feed is otherwise dominated by
  // whichever section had a busy week, and there was no way to say "just show
  // me the money" or to look further back than the first handful.
  const [kind, setKind] = useState<ActivityKind | null>(null);
  const [shown, setShown] = useState(PAGE);

  // Only offer filters for kinds actually present — a "Money" chip that always
  // yields nothing is worse than no chip.
  const kinds = useMemo(() => {
    const present = new Set<ActivityKind>();
    for (const i of items) present.add(i.kind);
    return (Object.keys(KIND) as ActivityKind[]).filter((k) => present.has(k));
  }, [items]);

  const filtered = useMemo(
    () => (kind ? items.filter((i) => i.kind === kind) : items),
    [items, kind]
  );
  const visible = filtered.slice(0, shown);

  function pick(next: ActivityKind | null) {
    setKind(next);
    setShown(PAGE); // a new filter starts from the top
  }

  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {kinds.length > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter activity">
            <FilterChip on={kind === null} onClick={() => pick(null)}>
              All
            </FilterChip>
            {kinds.map((k) => (
              <FilterChip key={k} on={kind === k} onClick={() => pick(k)}>
                {KIND[k].label}
              </FilterChip>
            ))}
          </div>
        )}
      </header>

      {visible.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-faint">
          {kind
            ? "Nothing of that kind yet."
            : "Nothing yet — as the team claims tasks, posts ideas, and logs work, it shows up here."}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {visible.map((item) => {
              const meta = KIND[item.kind];
              const Icon = meta.icon;
              const actor = item.actorId ? members[item.actorId] : null;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-raised/60"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-line text-faint">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-faint">
                        {actor ? (
                          <span style={{ color: actor.color }}>{actor.name}</span>
                        ) : (
                          "Someone"
                        )}{" "}
                        {meta.verb} · {formatRelative(item.at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {filtered.length > visible.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="w-full border-t border-line px-4 py-2 text-[13px] text-muted transition-colors duration-150 hover:bg-raised/60 hover:text-ink"
            >
              Show more ({filtered.length - visible.length} older)
            </button>
          )}
        </>
      )}
    </section>
  );
}

function FilterChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] transition-colors duration-150",
        on ? "bg-raised text-ink" : "text-faint hover:bg-raised/60 hover:text-muted"
      )}
    >
      {children}
    </button>
  );
}
