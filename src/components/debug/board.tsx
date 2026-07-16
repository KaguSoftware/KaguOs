"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bug } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TaskRow } from "@/components/debug/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { DebugState, DebugTask, MembersMap } from "@/lib/types";

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
  projects,
  members,
  meId,
  isAdmin,
}: {
  initialTasks: DebugTask[];
  projects: { id: string; name: string }[];
  members: MembersMap;
  meId: string;
  isAdmin: boolean;
}) {
  const [tasks, setTasks] = useState<DebugTask[]>(initialTasks);
  const [filter, setFilter] = useState<Filter>("active");
  // "all" | "general" | a project id — pure client-side switching, zero delay.
  const [board, setBoard] = useState<string>("all");
  const [live, setLive] = useState(false);

  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  // Server refreshes (revalidatePath after actions) re-send props — adopt them.
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  // Optimistic layer: rows update instantly, server + realtime reconcile after.
  const patchTask = useCallback((id: string, patch: Partial<DebugTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);
  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const restoreTask = useCallback((task: DebugTask) => {
    setTasks((prev) =>
      prev.some((t) => t.id === task.id)
        ? prev.map((t) => (t.id === task.id ? task : t))
        : [...prev, task]
    );
  }, []);

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
    let list = sortTasks(tasks);
    if (board === "general") list = list.filter((t) => !t.project_id);
    else if (board !== "all") list = list.filter((t) => t.project_id === board);
    switch (filter) {
      case "active":
        return list.filter((t) => t.state !== "done");
      case "done":
        return list.filter((t) => t.state === "done");
      case "mine":
        return list.filter((t) => t.assignee_id === meId);
      default:
        return list;
    }
  }, [tasks, filter, board, meId]);

  const openCount = tasks.filter((t) => t.state === "open").length;

  const countFor = (key: string) =>
    tasks.filter(
      (t) =>
        t.state !== "done" &&
        (key === "general" ? !t.project_id : t.project_id === key)
    ).length;

  return (
    <div className="space-y-3">
      {/* Project boards — one table per project, switched locally */}
      <div
        className="flex gap-1 overflow-x-auto border-b border-line pb-px"
        role="tablist"
        aria-label="Project boards"
      >
        {[
          { key: "all", name: "All boards" },
          { key: "general", name: "General" },
          ...projects.map((p) => ({ key: p.id, name: p.name })),
        ].map((tab) => {
          const active = board === tab.key;
          const count = tab.key === "all" ? null : countFor(tab.key);
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setBoard(tab.key)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "border-primary-dim font-medium text-ink"
                  : "border-transparent text-muted hover:border-line-strong hover:text-ink"
              )}
            >
              {tab.name}
              {count !== null && count > 0 && (
                <span className="rounded-full bg-raised px-1.5 font-mono text-[11px] text-muted">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

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
                members={members}
                meId={meId}
                isAdmin={isAdmin}
                projectName={
                  board === "all" && task.project_id
                    ? (projectNames[task.project_id] ?? null)
                    : null
                }
                onPatch={patchTask}
                onRemove={removeTask}
                onRestore={restoreTask}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
