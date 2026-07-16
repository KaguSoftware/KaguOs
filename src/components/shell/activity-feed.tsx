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
import { formatRelative } from "@/lib/utils";

const KIND: Record<ActivityKind, { icon: LucideIcon; verb: string }> = {
  debug_task: { icon: Bug, verb: "posted a task" },
  idea: { icon: Lightbulb, verb: "posted an idea" },
  project: { icon: FolderKanban, verb: "started a project" },
  transaction: { icon: Receipt, verb: "logged" },
  post: { icon: Megaphone, verb: "planned a post" },
};

export function ActivityFeed({
  items,
  members,
}: {
  items: ActivityItem[];
  members: MembersMap;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-faint">
          Nothing yet — as the team claims tasks, posts ideas, and logs work,
          it shows up here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
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
      )}
    </section>
  );
}
