"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Bug,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  ListPlus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteTasks } from "@/lib/actions/debug";
import { TaskRow } from "@/components/debug/task-row";
import { DebugFocusHero } from "@/components/debug/focus-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown, MultiDropdown } from "@/components/ui/dropdown";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { tasksToText } from "@/lib/debug-export";
import { cn, formatDate } from "@/lib/utils";
import type { DebugFocus, DebugState, DebugTask, MembersMap } from "@/lib/types";

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

// Multi-select filter options — no "Any …" row, because picking nothing IS
// "any". The placeholder on each control says so.
const PRIORITY_FILTER_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const KIND_FILTER_OPTIONS = [
  { value: "fix", label: "Fix" },
  { value: "feature", label: "Feature" },
  { value: "audit", label: "Audit" },
];

// Explicit per-state filter — finer than the Active/Done tabs, which fold
// open + in_progress together under "Active". Refines within the active tab.
const STATE_FILTER_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
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
  suggestOptions,
  focusItems,
}: {
  initialTasks: DebugTask[];
  projects: { id: string; name: string }[];
  members: MembersMap;
  meId: string;
  isAdmin: boolean;
  /** Work members an admin can "suggest for" from the edit form. Empty for non-admins. */
  suggestOptions: { value: string; label: string }[];
  /** Every active focus item, rank-ordered. Empty = no focus set. */
  focusItems: DebugFocus[];
}) {
  const [tasks, setTasks] = useState<DebugTask[]>(initialTasks);
  const [filter, setFilter] = useState<Filter>("active");
  // ["all"], or one-or-more of "general" / project ids. Pure client-side
  // switching, zero delay. Plain click replaces the selection, ctrl/cmd-click
  // adds to it, so the common case stays one click.
  const [board, setBoard] = useState<string[]>(["all"]);
  const [boardQuery, setBoardQuery] = useState("");
  // Filters are multi-select: an EMPTY array means "no filter" (show all), and
  // several picks are OR'd together — "urgent or high", "Pet app or Site".
  // That's the shape people actually want on a shared board; a single-value
  // filter forces you to look at one project at a time when the real question
  // is usually "these two".
  const [assignee, setAssignee] = useState<string[]>([]); // "unassigned" · user ids
  const [priority, setPriority] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<string[]>([]);
  const [taskQuery, setTaskQuery] = useState("");
  const [sort, setSort] = useState<Sort>("smart");
  const [live, setLive] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Batch select on the main board (distinct from the archived cleanup set):
  // pick tasks to copy or download as a plain-text file.
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { success: toastSuccess, error: toastError } = useToast();
  // Brainstorm session trail: ids of tasks made in /debug/brainstorm, handed
  // over via sessionStorage. Highlighted + pinned to the top until cleared.
  const [sessionIds, setSessionIds] = useState<Set<string>>(new Set());

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

  // How many tasks each audit turned up — counted over ALL tasks, not the
  // filtered view, so an audit's yield doesn't change as you filter the board.
  const foundCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks) {
      if (t.found_by) map[t.found_by] = (map[t.found_by] ?? 0) + 1;
    }
    return map;
  }, [tasks]);

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

  const togglePicked = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Pick up the trail a brainstorm session left behind. It persists across
  // navigations (sessionStorage, this tab only) until someone clears it, so
  // the triage highlight survives a detour to another section.
  useEffect(() => {
    // Adopt after paint (rAF), not synchronously: the server render has no
    // sessionStorage, so a synchronous set would either mismatch hydration
    // (lazy init) or trip react-hooks/set-state-in-effect (direct set).
    const frame = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem("kagu-debug-brainstorm");
        if (raw) {
          const ids = JSON.parse(raw) as string[];
          if (Array.isArray(ids) && ids.length > 0) setSessionIds(new Set(ids));
        }
      } catch {
        // Malformed storage — just no trail.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function clearTrail() {
    setSessionIds(new Set());
    try {
      sessionStorage.removeItem("kagu-debug-brainstorm");
    } catch {}
  }

  // Realtime: reflect everyone else's changes without reloading.
  //
  // debug_tasks has RLS, so postgres_changes only delivers events if the
  // realtime socket carries the user's JWT. The channel can report SUBSCRIBED
  // while still authorized as anon (which the SELECT policy rejects) — the
  // symptom being "connected, but only my own optimistic edits ever show and
  // nothing from teammates arrives". So set the auth token explicitly before
  // subscribing, and refresh it whenever the session token rotates.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      // Authorize the realtime connection as this user so RLS lets their events
      // through. Without this, an RLS table silently streams nothing.
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
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
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
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
    // `board` holds "all", or one-or-more board keys ("general" / project ids).
    // Ctrl/Cmd-click a tab to add it to the selection — "Pet app AND Site" is a
    // real question people ask, and one-board-at-a-time forced two passes.
    if (!board.includes("all")) {
      list = list.filter((t) =>
        t.project_id ? board.includes(t.project_id) : board.includes("general")
      );
    }

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

    // Each filter is OR-within, AND-across: "(urgent or high) and (Pet app)".
    // An empty array is no filter at all, so untouched controls never hide rows.
    if (assignee.length > 0) {
      list = list.filter((t) =>
        t.assignee_id
          ? assignee.includes(t.assignee_id)
          : assignee.includes("unassigned")
      );
    }

    if (priority.length > 0)
      list = list.filter((t) => priority.includes(t.priority));

    if (stateFilter.length > 0)
      list = list.filter((t) => stateFilter.includes(t.state));

    if (kindFilter.length > 0)
      list = list.filter((t) => kindFilter.includes(t.kind));

    const q = taskQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      );
    }

    // This session's batch-added tasks pin to the top (order preserved within
    // each group) so the brainstorm can be triaged as a block while it's warm.
    if (sessionIds.size > 0) {
      const fresh = list.filter((t) => sessionIds.has(t.id));
      if (fresh.length > 0) {
        list = [...fresh, ...list.filter((t) => !sessionIds.has(t.id))];
      }
    }
    return list;
  }, [liveTasks, filter, board, meId, assignee, priority, stateFilter, kindFilter, taskQuery, sort, sessionIds]);

  const openCount = liveTasks.filter((t) => t.state === "open").length;

  // Batch select operates over the currently-visible rows only — what you see
  // is what you pick. Only visible-and-picked tasks count toward the actions,
  // so leaving select mode or changing filters can't act on hidden rows.
  const pickedVisible = useMemo(
    () => visible.filter((t) => picked.has(t.id)),
    [visible, picked]
  );
  const allVisibleSelected =
    visible.length > 0 && pickedVisible.length === visible.length;

  function toggleSelectMode() {
    setSelectMode((on) => {
      if (on) setPicked(new Set());
      return !on;
    });
  }

  function toggleSelectAllVisible() {
    setPicked(
      allVisibleSelected ? new Set() : new Set(visible.map((t) => t.id))
    );
  }

  function copyPicked() {
    if (pickedVisible.length === 0) return;
    const text = tasksToText(pickedVisible, { members, projects });
    navigator.clipboard.writeText(text).then(
      () =>
        toastSuccess(
          `Copied ${pickedVisible.length} task${pickedVisible.length === 1 ? "" : "s"}.`
        ),
      () => toastError("Couldn't copy — clipboard blocked.")
    );
  }

  function downloadPicked() {
    if (pickedVisible.length === 0) return;
    const text = tasksToText(pickedVisible, { members, projects });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-tasks-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toastSuccess(
      `Downloaded ${pickedVisible.length} task${pickedVisible.length === 1 ? "" : "s"}.`
    );
  }

  // Assignee filter options: only people who actually hold a task, so the list
  // stays short and relevant. "Anyone" and "Unassigned" are always offered.
  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const t of liveTasks) if (t.assignee_id) ids.add(t.assignee_id);
    const people = [...ids]
      .map((id) => ({ value: id, label: members[id]?.name ?? "Someone" }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "unassigned", label: "Unassigned" }, ...people];
  }, [liveTasks, members]);

  const activeFilterCount =
    assignee.length +
    priority.length +
    stateFilter.length +
    kindFilter.length +
    (taskQuery.trim() ? 1 : 0);
  const secondaryActive = activeFilterCount > 0;

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
    .filter((p) => !q || p.name.toLowerCase().includes(q) || board.includes(p.id))
    .map((p) => ({ key: p.id, name: p.name }));

  /**
   * Plain click selects just this board; ctrl/cmd-click toggles it into a
   * multi-board selection. "All boards" always resets to the single "all"
   * state — it can't meaningfully combine with anything.
   */
  function pickBoard(key: string, additive: boolean) {
    if (key === "all" || !additive) {
      setBoard([key]);
      return;
    }
    setBoard((prev) => {
      const base = prev.filter((k) => k !== "all");
      const next = base.includes(key)
        ? base.filter((k) => k !== key)
        : [...base, key];
      // Deselecting the last board falls back to "all" rather than showing
      // an empty board with no way to tell why.
      return next.length === 0 ? ["all"] : next;
    });
  }

  return (
    <div className="space-y-3">
      <DebugFocusHero
        items={focusItems}
        isAdmin={isAdmin}
        projects={projects}
      />

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
                setBoard([projectTabs[0].key]);
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
            const active = board.includes(tab.key);
            const count = tab.key === "all" ? null : countFor(tab.key);
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                title={
                  tab.key === "all"
                    ? undefined
                    : "Ctrl/⌘-click to add another board"
                }
                onClick={(e) => pickBoard(tab.key, e.ctrlKey || e.metaKey)}
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSelectMode}
            aria-pressed={selectMode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] transition-colors duration-150",
              selectMode
                ? "border-primary-dim bg-primary/10 text-ink"
                : "border-line text-muted hover:border-line-strong hover:bg-raised hover:text-ink"
            )}
          >
            <CheckSquare className="size-3.5" aria-hidden />
            {selectMode ? "Done" : "Select"}
          </button>
          <Link
            href="/debug/brainstorm"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[13px] text-muted transition-colors duration-150 hover:border-line-strong hover:bg-raised hover:text-ink"
          >
            <ListPlus className="size-3.5" aria-hidden />
            Brainstorm
          </Link>
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
        <MultiDropdown
          className="w-40"
          label="Assignee"
          placeholder="Anyone"
          summaryNoun="people"
          values={assignee}
          onChange={setAssignee}
          options={assigneeOptions}
          searchThreshold={8}
        />
        <MultiDropdown
          className="w-36"
          label="Kind"
          placeholder="Any kind"
          summaryNoun="kinds"
          values={kindFilter}
          onChange={setKindFilter}
          options={KIND_FILTER_OPTIONS}
        />
        <MultiDropdown
          className="w-36"
          label="State"
          placeholder="Any state"
          summaryNoun="states"
          values={stateFilter}
          onChange={setStateFilter}
          options={STATE_FILTER_OPTIONS}
        />
        <MultiDropdown
          className="w-36"
          label="Priority"
          placeholder="Any priority"
          summaryNoun="priorities"
          values={priority}
          onChange={setPriority}
          options={PRIORITY_FILTER_OPTIONS}
        />
        <Dropdown
          className="w-36"
          id="debug-sort"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={SORT_OPTIONS}
        />
        {secondaryActive && (
          <button
            type="button"
            onClick={() => {
              setAssignee([]);
              setPriority([]);
              setStateFilter([]);
              setKindFilter([]);
              setTaskQuery("");
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink"
          >
            <X className="size-3" aria-hidden />
            Clear {activeFilterCount}
          </button>
        )}
      </div>

      {/* The brainstorm session's tasks stay marked and pinned for triage
          until someone clears the trail. */}
      {sessionIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5">
          <ListPlus className="size-3.5 shrink-0 text-primary-dim" aria-hidden />
          <p className="text-[13px] text-muted">
            <span className="font-medium text-ink">{sessionIds.size}</span>
            {" added this session — set priorities, claim, clear the dupes."}
          </p>
          <button
            type="button"
            onClick={clearTrail}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink"
          >
            <X className="size-3" aria-hidden />
            Clear
          </button>
        </div>
      )}

      {/* Batch actions — copy or download the picked rows as a .txt file. */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <Checkbox
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            disabled={visible.length === 0}
            label={
              pickedVisible.length > 0
                ? `${pickedVisible.length} selected`
                : `Select all (${visible.length})`
            }
          />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pickedVisible.length === 0}
              onClick={copyPicked}
            >
              <Copy className="size-3.5" aria-hidden />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pickedVisible.length === 0}
              onClick={downloadPicked}
            >
              <Download className="size-3.5" aria-hidden />
              Download .txt
            </Button>
            {pickedVisible.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink"
              >
                <X className="size-3" aria-hidden />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

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
                projects={projects}
                suggestOptions={suggestOptions}
                foundCount={foundCounts[task.id] ?? 0}
                foundByTitle={
                  task.found_by
                    ? (tasks.find((t) => t.id === task.found_by)?.title ?? null)
                    : null
                }
                highlight={sessionIds.has(task.id)}
                selectable={selectMode}
                selected={picked.has(task.id)}
                onToggleSelect={togglePicked}
                projectName={
                  // Name the board on the row whenever more than one is in
                  // view — with a single board selected it'd be noise.
                  board.length > 1 || board.includes("all")
                    ? task.project_id
                      ? (projectNames[task.project_id] ?? null)
                      : null
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
