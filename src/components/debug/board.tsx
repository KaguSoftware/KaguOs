"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  SlidersHorizontal,
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
import { cn, formatDate, todayInIstanbul, todayLocal } from "@/lib/utils";
import type { DebugFocus, DebugState, DebugTask, MembersMap } from "@/lib/types";

/** Above this many project boards, the tab strip gets a filter box. */
const BOARD_SEARCH_THRESHOLD = 5;

type Sort = "smart" | "priority" | "deadline" | "newest";

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

/**
 * The quick views, expressed as WRITES INTO THE REAL FILTERS rather than as a
 * parallel filter of their own.
 *
 * There used to be two systems: an Active/Mine/Done/All tab strip AND the state
 * and assignee multi-selects. They overlapped, and they could contradict —
 * "Mine" plus assignee=someone-else guaranteed an empty board with nothing on
 * screen explaining why. Now a preset just sets the controls, so what it did is
 * visible in the controls themselves, and disagreement is impossible.
 */
type Preset = {
  key: string;
  label: string;
  /** `meId` is threaded in so "Mine" can name the current user. */
  apply: (meId: string) => { state: string[]; assignee: string[] };
};

const PRESETS: Preset[] = [
  {
    key: "active",
    label: "Active",
    apply: () => ({ state: ["open", "in_progress"], assignee: [] }),
  },
  {
    key: "mine",
    label: "Mine",
    apply: (meId) => ({ state: ["open", "in_progress"], assignee: [meId] }),
  },
  { key: "done", label: "Done", apply: () => ({ state: ["done"], assignee: [] }) },
  { key: "all", label: "All", apply: () => ({ state: [], assignee: [] }) },
];

/** Same members, any order — presets are sets, not sequences. */
function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((v) => b.includes(v));
}

const STATE_ORDER: Record<DebugState, number> = { open: 0, in_progress: 1, done: 2 };
const PRIORITY_ORDER: Record<DebugTask["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * The default "smart" order: overdue first, then active, then priority, then
 * newest.
 *
 * Overdue leads because a passed deadline is the only thing on this board that
 * gets worse on its own. Without it an overdue medium sank below a fresh high,
 * which made deadlines decorative — the board knew the date and still buried it.
 */
function smartSort(tasks: DebugTask[]) {
  // Istanbul, not the device — the sort order of a shared board shouldn't
  // depend on whose laptop is looking at it. (The download filename below
  // stays viewer-local: that one really is about your own clock.)
  const today = todayInIstanbul();
  const isOverdue = (t: DebugTask) =>
    t.due_on != null && t.state !== "done" && t.due_on < today;

  return [...tasks].sort(
    (a, b) =>
      Number(isOverdue(b)) - Number(isOverdue(a)) ||
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
  showcase,
  suggestOptions,
  focusItems,
}: {
  initialTasks: DebugTask[];
  projects: { id: string; name: string }[];
  members: MembersMap;
  meId: string;
  isAdmin: boolean;
  /** Which world this board is showing — realtime must match the page query. */
  showcase: boolean;
  /** Work members an admin can "suggest for" from the edit form. Empty for non-admins. */
  suggestOptions: { value: string; label: string }[];
  /** Every active focus item, rank-ordered. Empty = no focus set. */
  focusItems: DebugFocus[];
}) {
  const [tasks, setTasks] = useState<DebugTask[]>(initialTasks);
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
  // Opens on the "Active" preset — the board's job is what's left to do.
  const [stateFilter, setStateFilter] = useState<string[]>([
    "open",
    "in_progress",
  ]);
  const [kindFilter, setKindFilter] = useState<string[]>([]);
  const [taskQuery, setTaskQuery] = useState("");
  const [sort, setSort] = useState<Sort>("smart");
  // Three states, not two. The old boolean could only say "live" or
  // "connecting…", so a socket that never came back said "connecting…" forever
  // — the board looked merely slow while silently showing stale data.
  const [live, setLive] = useState<"connecting" | "live" | "offline">(
    "connecting"
  );
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
  //
  // The stream must also match the PAGE QUERY'S scope, which filters on
  // `is_demo` (and hides archived rows from non-admins). A channel that skips
  // those checks streams real tasks onto the showcase board — the server-side
  // `filter` does the first cut, and `accepts()` re-checks every payload because
  // an UPDATE can move a row out of scope after it arrived.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const scope = { filter: `is_demo=eq.${showcase}` };

    const accepts = (row: DebugTask) =>
      row.is_demo === showcase && (isAdmin || row.archived_at == null);

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
        { event: "INSERT", schema: "public", table: "debug_tasks", ...scope },
        (payload) => {
          const row = payload.new as DebugTask;
          if (!accepts(row)) return;
          setTasks((prev) =>
            prev.some((t) => t.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "debug_tasks", ...scope },
        (payload) => {
          const row = payload.new as DebugTask;
          // An edit can push a row OUT of scope (archived, for a non-admin).
          // Dropping it here keeps the board honest instead of leaving a stale copy.
          if (!accepts(row)) {
            setTasks((prev) => prev.filter((t) => t.id !== row.id));
            return;
          }
          setTasks((prev) => prev.map((t) => (t.id === row.id ? row : t)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "debug_tasks" },
        (payload) => {
          // DELETE payloads carry only the replica identity (the id), so there's
          // nothing to scope on — dropping an id we don't hold is a no-op anyway.
          const gone = payload.old as { id: string };
          setTasks((prev) => prev.filter((t) => t.id !== gone.id));
        }
      )
      // CHANNEL_ERROR / TIMED_OUT / CLOSED all mean "you are no longer seeing
      // other people's changes", which the user needs told — a stale board that
      // looks live is worse than one that admits it's stale.
      .subscribe((status) =>
        setLive(
          status === "SUBSCRIBED"
            ? "live"
            : status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
              ? "offline"
              : "connecting"
        )
      );
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [showcase, isAdmin]);

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
  }, [liveTasks, board, assignee, priority, stateFilter, kindFilter, taskQuery, sort, sessionIds]);

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
    a.download = `debug-tasks-${todayLocal()}.txt`;
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

  // What the user has NARROWED beyond the default view. The state filter opens
  // pre-set to "Active", so counting it flatly would show "Clear 2" on a board
  // nobody has touched — only a state selection that isn't the default counts.
  const activePreset = PRESETS.find((p) => {
    const target = p.apply(meId);
    return sameSet(stateFilter, target.state) && sameSet(assignee, target.assignee);
  });
  const activeFilterCount =
    (activePreset?.key === "active" ? 0 : assignee.length + stateFilter.length) +
    priority.length +
    kindFilter.length +
    (taskQuery.trim() ? 1 : 0);
  const secondaryActive = activeFilterCount > 0;

  // The board(s) in view, named — for the empty state, so it can say which
  // board is empty rather than implying the whole section is.
  const boardLabel = board.includes("all")
    ? null
    : board
        .map((k) => (k === "general" ? "General" : projectNames[k]))
        .filter(Boolean)
        .join(" + ") || null;

  /** Back to the board's resting state — the "Active" preset, nothing else on. */
  function clearFilters() {
    const base = PRESETS[0].apply(meId);
    setStateFilter(base.state);
    setAssignee(base.assignee);
    setPriority([]);
    setKindFilter([]);
    setTaskQuery("");
  }

  // Counted over liveTasks, never `tasks` — an admin also holds the archived
  // rows, and counting those makes a tab claim work that isn't on the board.
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
        {/* Quick views. These WRITE the state/assignee filters below rather
            than filtering separately — a preset reads as "selected" whenever
            the controls happen to match it, including when you got there by
            setting the controls by hand.

            "Reset" lives at the END of this group rather than in the control
            row below: that row's search box is `flex-1`, so anything appearing
            or disappearing there resized the search field and shifted the whole
            line. Here it sits after fixed-width buttons with nothing to push. */}
        <div className="flex items-center gap-1" role="group" aria-label="Quick views">
          {PRESETS.map((p) => {
            const target = p.apply(meId);
            const on =
              sameSet(stateFilter, target.state) &&
              sameSet(assignee, target.assignee);
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setStateFilter(target.state);
                  setAssignee(target.assignee);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[13px] transition-colors duration-150",
                  on
                    ? "bg-raised text-ink"
                    : "text-muted hover:bg-raised/60 hover:text-ink"
                )}
              >
                {p.label}
              </button>
            );
          })}
          {secondaryActive && (
            <button
              type="button"
              onClick={clearFilters}
              title="Clear search, kind, state, priority and assignee"
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted transition-colors duration-150 hover:bg-raised/60 hover:text-ink"
            >
              <X className="size-3" aria-hidden />
              Reset <span className="tabular-nums">{activeFilterCount}</span>
            </button>
          )}
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
                live === "live"
                  ? "bg-primary"
                  : live === "offline"
                    ? "bg-danger"
                    : "bg-line-strong"
              )}
              aria-hidden
            />
            {live === "offline" ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-danger transition-colors duration-150 hover:underline"
              >
                offline — refresh
              </button>
            ) : (
              <span>{live === "live" ? "live" : "connecting…"}</span>
            )}
            <span aria-hidden>·</span> {openCount} open
          </p>
        </div>
      </div>

      {/* Refine: search + who + the rest behind one control + sort.
          There used to be six equal-weight controls here, under two tab strips
          — three tiers of filtering furniture before you reach a task. Search
          and Assignee stay out (they're the two people actually reach for);
          Kind, State and Priority moved into one popover that carries a count,
          so the row states how narrowed you are without spending the width. */}
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
          // Full-width on a phone (where a 10rem control leaves a stranded gap
          // beside it), fixed from `sm` up so the row stays aligned.
          className="w-full sm:w-40"
          label="Assignee"
          placeholder="Anyone"
          summaryNoun="people"
          values={assignee}
          onChange={setAssignee}
          options={assigneeOptions}
          searchThreshold={8}
        />
        <FiltersPopover
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          stateFilter={stateFilter}
          setStateFilter={setStateFilter}
          priority={priority}
          setPriority={setPriority}
        />
        <Dropdown
          className="w-full sm:w-36"
          id="debug-sort"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={SORT_OPTIONS}
        />
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
            // Name the reason the board is empty. The old copy said "post a
            // task" even when the real answer was "you're looking at Pet app
            // with the Mine view on".
            <EmptyState
              icon={Bug}
              title={
                activePreset?.key === "mine"
                  ? "Nothing claimed by you"
                  : activePreset?.key === "done"
                    ? "Nothing done yet"
                    : boardLabel
                      ? `No tasks on ${boardLabel}`
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
 * Kind + State + Priority behind one control.
 *
 * These three were three more full-width dropdowns in a row that already held
 * a search box, an assignee picker and a sort — six equal-weight controls, none
 * of which told you how filtered you were. Folded into one button with a count,
 * the row gets its width back and gains the summary it was missing.
 *
 * Deliberately NOT a modal: it's a refinement, not a decision (DESIGN.md keeps
 * modals for destructive confirms). Same frosted-popover language as Dropdown.
 */
function FiltersPopover({
  kindFilter,
  setKindFilter,
  stateFilter,
  setStateFilter,
  priority,
  setPriority,
}: {
  kindFilter: string[];
  setKindFilter: (v: string[]) => void;
  stateFilter: string[];
  setStateFilter: (v: string[]) => void;
  priority: string[];
  setPriority: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = kindFilter.length + stateFilter.length + priority.length;

  // Same dismissal contract as every other popover in the app: click-away and
  // Escape both close it.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const GROUPS = [
    { label: "Kind", options: KIND_FILTER_OPTIONS, values: kindFilter, set: setKindFilter },
    { label: "State", options: STATE_FILTER_OPTIONS, values: stateFilter, set: setStateFilter },
    { label: "Priority", options: PRIORITY_FILTER_OPTIONS, values: priority, set: setPriority },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors duration-150",
          count > 0
            ? "border-primary-dim/40 bg-primary/5 text-ink"
            : "border-line bg-raised text-muted hover:border-line-strong"
        )}
      >
        <SlidersHorizontal className="size-3.5" aria-hidden />
        Filters
        {/* Reserved slot, same reasoning as the Clear button: a badge that
            mounts on demand widens the trigger and shifts the row beside it. */}
        <span
          aria-hidden={count === 0}
          className={cn(
            "rounded-full bg-primary/15 px-1.5 font-mono text-[11px] text-primary-dim tabular-nums",
            "transition-opacity duration-150 ease-mac",
            count > 0 ? "opacity-100" : "opacity-0"
          )}
        >
          {count || 0}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-[min(16rem,calc(100vw-2rem))] origin-top animate-pop-in rounded-md border border-line bg-raised/90 p-3 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="space-y-3">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map((o) => {
                    const on = group.values.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          group.set(
                            on
                              ? group.values.filter((v) => v !== o.value)
                              : [...group.values, o.value]
                          )
                        }
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[12px]",
                          "transition-[background-color,border-color,transform] duration-150 ease-mac active:scale-[0.97]",
                          on
                            ? "border-primary/50 bg-primary/10 text-ink"
                            : "border-line text-muted hover:border-line-strong hover:text-ink"
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={() => {
                setKindFilter([]);
                setStateFilter([]);
                setPriority([]);
              }}
              className="mt-3 w-full border-t border-line pt-2 text-left text-xs text-muted transition-colors duration-150 hover:text-ink"
            >
              Clear these {count}
            </button>
          )}
        </div>
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
                {/* Muted + strikethrough only. Adding an opacity on top (as
                    the done rows used to) stacked three dimming signals and
                    pushed this under the AA floor — archived, not disabled. */}
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
