"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Bug, ChevronDown, Search, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteTasks } from "@/lib/actions/debug";
import { TaskRow } from "@/components/debug/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown } from "@/components/ui/dropdown";
import { ConfirmButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAction } from "@/lib/use-action";
import { cn, formatDate } from "@/lib/utils";
import type { DebugState, DebugTask, MembersMap } from "@/lib/types";

/** Above this many project boards, the tab strip gets a filter box. */
const BOARD_SEARCH_THRESHOLD = 5;

type Filter = "active" | "done" | "mine" | "all";
type Sort = "smart" | "priority" | "deadline" | "newest";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "mine", label: "Mine" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

const SORT_OPTIONS = [
  { value: "smart", label: "Smart" },
  { value: "priority", label: "Priority" },
  { value: "deadline", label: "Deadline" },
  { value: "newest", label: "Newest" },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: "", label: "Any priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATE_ORDER: Record<DebugState, number> = { open: 0, in_progress: 1, done: 2 };
const PRIORITY_ORDER: Record<DebugTask["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** The default "smart" order: active first, then priority, then newest. */
function smartSort(tasks: DebugTask[]) {
  return [...tasks].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.created_at < b.created_at ? 1 : -1)
  );
}

function sortTasks(tasks: DebugTask[], sort: Sort) {
  switch (sort) {
    case "priority":
      return [...tasks].sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          (a.created_at < b.created_at ? 1 : -1)
      );
    case "deadline":
      // Tasks WITH a deadline first, soonest at top; undated sink to the bottom.
      return [...tasks].sort((a, b) => {
        if (a.due_on && b.due_on) return a.due_on.localeCompare(b.due_on);
        if (a.due_on) return -1;
        if (b.due_on) return 1;
        return a.created_at < b.created_at ? 1 : -1;
      });
    case "newest":
      return [...tasks].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    default:
      return smartSort(tasks);
  }
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
  const [boardQuery, setBoardQuery] = useState("");
  const [assignee, setAssignee] = useState(""); // "" any · "unassigned" · a user id
  const [priority, setPriority] = useState(""); // "" any · a priority
  const [taskQuery, setTaskQuery] = useState("");
  const [sort, setSort] = useState<Sort>("smart");
  const [live, setLive] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Server refreshes (revalidatePath after actions) re-send props — adopt them.
  //
  // Done DURING RENDER, not in an effect. Syncing props to state in an effect
  // makes React commit the stale rows first, then re-render with the new ones —
  // a visible flash where an optimistic edit reverts for a frame before the
  // server value lands. Resetting while rendering lets React throw the stale
  // pass away before it ever reaches the screen.
  const [seenTasks, setSeenTasks] = useState(initialTasks);
  if (seenTasks !== initialTasks) {
    setSeenTasks(initialTasks);
    setTasks(initialTasks);
  }

  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

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

  // Archived tasks (auto-archived after 7 days done) never show on the normal
  // board — they live in the admin-only cleanup section below.
  const liveTasks = useMemo(() => tasks.filter((t) => !t.archived_at), [tasks]);
  const archivedTasks = useMemo(
    () => tasks.filter((t) => t.archived_at),
    [tasks]
  );

  const visible = useMemo(() => {
    let list = sortTasks(liveTasks, sort);
    if (board === "general") list = list.filter((t) => !t.project_id);
    else if (board !== "all") list = list.filter((t) => t.project_id === board);

    switch (filter) {
      case "active":
        list = list.filter((t) => t.state !== "done");
        break;
      case "done":
        list = list.filter((t) => t.state === "done");
        break;
      case "mine":
        list = list.filter((t) => t.assignee_id === meId);
        break;
    }

    if (assignee === "unassigned") list = list.filter((t) => !t.assignee_id);
    else if (assignee) list = list.filter((t) => t.assignee_id === assignee);

    if (priority) list = list.filter((t) => t.priority === priority);

    const q = taskQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [liveTasks, filter, board, meId, assignee, priority, taskQuery, sort]);

  const openCount = liveTasks.filter((t) => t.state === "open").length;

  // Assignee filter options: only people who actually hold a task, so the list
  // stays short and relevant. "Anyone" and "Unassigned" are always offered.
  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const t of liveTasks) if (t.assignee_id) ids.add(t.assignee_id);
    const people = [...ids]
      .map((id) => ({ value: id, label: members[id]?.name ?? "Someone" }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [
      { value: "", label: "Anyone" },
      { value: "unassigned", label: "Unassigned" },
      ...people,
    ];
  }, [liveTasks, members]);

  const secondaryActive = Boolean(assignee || priority || taskQuery);

  const countFor = (key: string) =>
    liveTasks.filter(
      (t) =>
        t.state !== "done" &&
        (key === "general" ? !t.project_id : t.project_id === key)
    ).length;

  // Filter which PROJECT boards show in the strip. "All boards" and "General"
  // stay pinned so you can always get back to them. If the active board scrolls
  // out of the filtered set its tab still renders (so the selection stays legible).
  const showBoardSearch = projects.length >= BOARD_SEARCH_THRESHOLD;
  const q = boardQuery.trim().toLowerCase();
  const projectTabs = projects
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.id === board)
    .map((p) => ({ key: p.id, name: p.name }));

  return (
    <div className="space-y-3">
      {showBoardSearch && (
        <div className="relative max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            value={boardQuery}
            onChange={(e) => setBoardQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter jumps to the board when the filter narrows to one match —
              // type "pet", hit Enter, you're on Pet app without reaching for it.
              if (e.key === "Enter" && projectTabs.length === 1) {
                e.preventDefault();
                setBoard(projectTabs[0].key);
                setBoardQuery("");
              }
            }}
            placeholder="Find a project board…"
            aria-label="Find a project board"
            className="h-8 w-full rounded-md border border-line bg-raised pl-8 pr-8 text-sm text-ink placeholder:text-faint transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong"
          />
          {boardQuery && (
            <button
              type="button"
              onClick={() => setBoardQuery("")}
              aria-label="Clear board search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-faint transition-colors duration-150 hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      )}

      {/* Project boards — one table per project, switched locally. The divider
          lives on the wrapper (full-width, always crisp); the inner rail scrolls
          with no visible bar and fades at both edges, so an overflowing strip
          reads as "there's more this way" instead of exposing a scrollbar. */}
      <div className="border-b border-line">
        <div
          className="scrollbar-none flex gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]"
          role="tablist"
          aria-label="Project boards"
        >
          {[
            { key: "all", name: "All boards" },
            { key: "general", name: "General" },
            ...projectTabs,
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
          {q && projectTabs.length === 0 && (
            <span className="px-3 py-2 text-sm text-faint">No boards match.</span>
          )}
        </div>
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

      {/* Refine: search + who + priority + sort. Client-side, instant. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            value={taskQuery}
            onChange={(e) => setTaskQuery(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="h-9 w-full rounded-md border border-line bg-raised pl-8 pr-3 text-sm text-ink placeholder:text-muted transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong"
          />
        </div>
        <Dropdown
          className="w-40"
          value={assignee}
          onChange={setAssignee}
          options={assigneeOptions}
          searchThreshold={8}
        />
        <Dropdown
          className="w-36"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_FILTER_OPTIONS}
        />
        <Dropdown
          className="w-36"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={SORT_OPTIONS}
        />
        {secondaryActive && (
          <button
            type="button"
            onClick={() => {
              setAssignee("");
              setPriority("");
              setTaskQuery("");
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink"
          >
            <X className="size-3" aria-hidden />
            Clear
          </button>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface">
        {visible.length === 0 ? (
          secondaryActive ? (
            <EmptyState
              icon={Bug}
              title="No tasks match"
              hint="Try a different person, priority, or search term."
            />
          ) : (
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
          )
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

      {isAdmin && archivedTasks.length > 0 && (
        <ArchivedSection
          tasks={archivedTasks}
          projectNames={projectNames}
          open={showArchived}
          onToggle={() => setShowArchived((v) => !v)}
          selected={selected}
          setSelected={setSelected}
          onDeleted={(ids) => {
            setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

/**
 * Admin-only cleanup for auto-archived tasks: batch-select and hard-delete.
 * Archived tasks are already off the main board; this is where they go to die
 * for good so they don't accumulate invisibly. Collapsed by default.
 */
function ArchivedSection({
  tasks,
  projectNames,
  open,
  onToggle,
  selected,
  setSelected,
  onDeleted,
}: {
  tasks: DebugTask[];
  projectNames: Record<string, string>;
  open: boolean;
  onToggle: () => void;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  onDeleted: (ids: string[]) => void;
}) {
  const { pending, run } = useAction();
  const allSelected = tasks.length > 0 && selected.size === tasks.length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
  }

  return (
    <div className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <Archive className="size-3.5 text-faint" aria-hidden />
          Archived ({tasks.length})
          <span className="text-faint">· done 7+ days, admin cleanup</span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-faint transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <Checkbox
              checked={allSelected}
              onChange={toggleAll}
              label={`Select all (${tasks.length})`}
            />
            {selected.size > 0 && (
              <ConfirmButton
                size="sm"
                disabled={pending}
                confirmLabel={`Delete ${selected.size}?`}
                onConfirm={() => {
                  const ids = [...selected];
                  run(() => deleteTasks(ids), {
                    success: `Deleted ${ids.length} task${ids.length === 1 ? "" : "s"}.`,
                    optimistic: () => onDeleted(ids),
                  });
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete {selected.size}
              </ConfirmButton>
            )}
          </div>
          <ul className="divide-y divide-line">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <Checkbox
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  aria-label={`Select ${t.title}`}
                />
                <span className="min-w-0 flex-1 truncate text-muted line-through decoration-faint">
                  {t.title}
                </span>
                {t.project_id && projectNames[t.project_id] && (
                  <span className="shrink-0 text-xs text-faint">
                    {projectNames[t.project_id]}
                  </span>
                )}
                <span className="shrink-0 font-mono text-xs text-faint">
                  {t.done_at ? formatDate(t.done_at) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
