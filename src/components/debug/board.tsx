"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TaskRow } from "@/components/debug/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { DebugState, DebugTask } from "@/lib/types";

type Filter = "active" | "done" | "mine" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "mine", label: "Mine" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

const STATE_ORDER: Record<DebugState, number> = { open: 0, in_progress: 1, done: 2 };
const PRIORITY_ORDER: Record<DebugTask["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortTasks(tasks: DebugTask[]) {
  return [...tasks].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.created_at < b.created_at ? 1 : -1)
  );
}

export function DebugBoard({
  initialTasks,
  names,
  meId,
  isAdmin,
}: {
  initialTasks: DebugTask[];
  names: Record<string, string>;
  meId: string;
  isAdmin: boolean;
}) {
  const [tasks, setTasks] = useState<DebugTask[]>(initialTasks);
  const [filter, setFilter] = useState<Filter>("active");
  const [live, setLive] = useState(false);

  // Server refreshes (revalidatePath after actions) re-send props — adopt them.
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  // Realtime: reflect everyone else's changes without reloading.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("debug-board")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "debug_tasks" },
        (payload) => {
          const row = payload.new as DebugTask;
          setTasks((prev) =>
            prev.some((t) => t.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "debug_tasks" },
        (payload) => {
          const row = payload.new as DebugTask;
          setTasks((prev) => prev.map((t) => (t.id === row.id ? row : t)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "debug_tasks" },
        (payload) => {
          const gone = payload.old as { id: string };
          setTasks((prev) => prev.filter((t) => t.id !== gone.id));
        }
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = useMemo(() => {
    const sorted = sortTasks(tasks);
    switch (filter) {
      case "active":
        return sorted.filter((t) => t.state !== "done");
      case "done":
        return sorted.filter((t) => t.state === "done");
      case "mine":
        return sorted.filter((t) => t.assignee_id === meId);
      default:
        return sorted;
    }
  }, [tasks, filter, meId]);

  const openCount = tasks.filter((t) => t.state === "open").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Filter tasks">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[13px] transition-colors duration-150",
                filter === f.key
                  ? "bg-raised text-ink"
                  : "text-muted hover:bg-raised/60 hover:text-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-faint">
          <span
            className={cn(
              "size-1.5 rounded-full",
              live ? "bg-primary" : "bg-line-strong"
            )}
            aria-hidden
          />
          {live ? "live" : "connecting…"} · {openCount} open
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        {visible.length === 0 ? (
          <EmptyState
            icon={Bug}
            title={
              filter === "mine"
                ? "Nothing claimed by you"
                : filter === "done"
                  ? "Nothing done yet"
                  : "No tasks here"
            }
            hint="Post a task with “New task” — anyone in Debug can claim it by one click."
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                names={names}
                meId={meId}
                isAdmin={isAdmin}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
