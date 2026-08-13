"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowUpDown,
  Bug,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  Keyboard,
  ListPlus,
  MoreHorizontal,
  Search,
  SearchCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  claimTask,
  deleteTasks,
  setTaskState,
  unclaimTask,
  updateTasks,
  type BulkPatch,
} from "@/lib/actions/debug";
import { TaskRow } from "@/components/debug/task-row";
import { BoardOrderOverlay } from "@/components/debug/board-order";
import { DebugFocusHero } from "@/components/debug/focus-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { Dropdown } from "@/components/ui/dropdown";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import {
  hasBoardFilterParams,
  loadStoredBoardFilters,
  readBoardFilters,
  storeBoardFilters,
  useBoardFilterUrl,
} from "@/lib/use-board-filters";
import {
  downloadBlob,
  downloadTaskImages,
  tasksToText,
} from "@/lib/debug-export";
import { cn, formatDate, todayInIstanbul, todayLocal } from "@/lib/utils";
import type {
  DebugFocus,
  DebugState,
  DebugTask,
  DebugTaskImage,
  DebugTaskNote,
  MembersMap,
} from "@/lib/types";

/** Stable identity for tasks with no screenshots — a fresh `[]` per render
 *  would re-sign URLs in TaskImages on every parent update. */
const EMPTY_IMAGES: DebugTaskImage[] = [];
const EMPTY_NOTES: DebugTaskNote[] = [];

/** Above this many options, long dropdowns (bulk "Move to…") get a filter box. */
const BOARD_SEARCH_THRESHOLD = 5;

type Sort = "smart" | "priority" | "deadline" | "newest";

export type BoardProject = {
  id: string;
  name: string;
  /** Admin-pinned tab position; null = unpinned, auto-sorted by open count. */
  debug_position: number | null;
};

/**
 * Tab order: admin-pinned boards first (by debug_position), then the rest by
 * open task count descending, name as tie-break. Counts come from the SERVER
 * snapshot, not liveTasks — closing a task must move the pill's number, never
 * reshuffle the tab rail under the user mid-click.
 */
function orderBoards(projects: BoardProject[], tasks: DebugTask[]) {
  const open: Record<string, number> = {};
  for (const t of tasks) {
    if (t.state === "done" || t.archived_at || !t.project_id) continue;
    open[t.project_id] = (open[t.project_id] ?? 0) + 1;
  }
  const pinned = projects
    .filter((p) => p.debug_position !== null)
    .sort((a, b) => a.debug_position! - b.debug_position!);
  const rest = projects
    .filter((p) => p.debug_position === null)
    .sort(
      (a, b) =>
        (open[b.id] ?? 0) - (open[a.id] ?? 0) || a.name.localeCompare(b.name)
    );
  return { ordered: [...pinned, ...rest], openCounts: open };
}

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
  canMessage,
  suggestOptions,
  focusItems,
  initialImages,
  initialNotes,
}: {
  initialTasks: DebugTask[];
  projects: BoardProject[];
  members: MembersMap;
  meId: string;
  isAdmin: boolean;
  /** Which world this board is showing — realtime must match the page query. */
  showcase: boolean;
  /** The viewer can open /messages — powers each row's "Message author". */
  canMessage: boolean;
  /** Work members to "suggest for" from the edit form. Empty outside the work team. */
  suggestOptions: { value: string; label: string }[];
  /** Every active focus item, rank-ordered. Empty = no focus set. */
  focusItems: DebugFocus[];
  /** Every screenshot on the board, grouped per task below. */
  initialImages: DebugTaskImage[];
  initialNotes: DebugTaskNote[];
}) {
  const [tasks, setTasks] = useState<DebugTask[]>(initialTasks);
  const [images, setImages] = useState<DebugTaskImage[]>(initialImages);
  const [notes, setNotes] = useState<DebugTaskNote[]>(initialNotes);

  // Filters are seeded FROM THE URL so a shared/bookmarked link reproduces the
  // exact view, then mirrored back to it on every change (see the effect below).
  // Read once via a lazy initialiser — re-reading on each render would fight the
  // user's own edits, since we rewrite the URL as they filter.
  const searchParams = useSearchParams();
  const [initialFilters] = useState(() => readBoardFilters(searchParams));
  // Whether the URL arrived with explicit filters (a shared/bookmarked link).
  // If so, the localStorage cache below never overrides it — the link IS the view.
  const [urlSeeded] = useState(() => hasBoardFilterParams(searchParams));

  // ["all"], or one-or-more of "general" / project ids. Pure client-side
  // switching, zero delay. Plain click replaces the selection, ctrl/cmd-click
  // adds to it, so the common case stays one click.
  const [board, setBoard] = useState<string[]>(initialFilters.board);

  // Filters are multi-select: an EMPTY array means "no filter" (show all), and
  // several picks are OR'd together — "urgent or high", "Pet app or Site".
  // That's the shape people actually want on a shared board; a single-value
  // filter forces you to look at one project at a time when the real question
  // is usually "these two".
  const [assignee, setAssignee] = useState<string[]>(initialFilters.assignee); // "unassigned" · user ids
  const [priority, setPriority] = useState<string[]>(initialFilters.priority);
  // Opens on the "Active" preset — the board's job is what's left to do.
  const [stateFilter, setStateFilter] = useState<string[]>(initialFilters.state);
  const [kindFilter, setKindFilter] = useState<string[]>(initialFilters.kind);
  const [taskQuery, setTaskQuery] = useState(initialFilters.q);
  const [sort, setSort] = useState<Sort>(initialFilters.sort as Sort);
  // Set from an audit's "Found N" link — narrows the board to that audit's yield.
  const [foundBy, setFoundBy] = useState(initialFilters.foundBy);

  // ⚠️ Adopt `f` when it changes IN THE URL, not just at mount.
  //
  // Every other filter is only ever set from inside this component, so seeding
  // once from `initialFilters` is enough. `f` is different: it arrives from a
  // <Link> on an audit row, which navigates CLIENT-SIDE without remounting the
  // board — so the query string would change while the state sat still, and the
  // link would appear to do nothing. Compared during render (not in an effect)
  // so the filtered list paints on the first pass rather than one frame later.
  const urlFoundBy = searchParams.get("f") ?? "";
  const [seenFoundBy, setSeenFoundBy] = useState(urlFoundBy);
  if (seenFoundBy !== urlFoundBy) {
    setSeenFoundBy(urlFoundBy);
    setFoundBy(urlFoundBy);
  }
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
  const [bulkPending, setBulkPending] = useState(false);
  // Keyboard cursor: an index into `visible`, or -1 for "not navigating".
  // PRODUCT.md commits to full keyboard operability for claim/tick flows; this
  // is what delivers it. See the key handler below for the full map.
  const [cursor, setCursor] = useState(-1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Admin-only board ordering editor (pin boards to the front of the rail).
  const [orderOpen, setOrderOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { success: toastSuccess, error: toastError } = useToast();
  // Brainstorm session trail: ids of tasks made in /debug/brainstorm, handed
  // over via sessionStorage. Highlighted + pinned to the top until cleared.
  const [sessionIds, setSessionIds] = useState<Set<string>>(new Set());

  // Mirror the live filters into the query string, so the view is shareable and
  // survives a refresh. One-way on purpose: the board owns the state (presets
  // write the real filters), and the URL only reflects it — making the URL a
  // second source of truth would recreate the two-rival-systems bug that the
  // Active/Mine/Done strip had before it was rewritten as presets.
  //
  // The writer no-ops when the resulting URL is unchanged, so the realtime
  // traffic that re-renders this board doesn't rewrite history on every tick.
  const writeFilterUrl = useBoardFilterUrl();
  // Flipped by the cache-restore effect below; until then the mirror effect
  // must not write the cache (see the gate inside it).
  const filtersAdoptedRef = useRef(false);
  useEffect(() => {
    writeFilterUrl({
      board,
      state: stateFilter,
      priority,
      kind: kindFilter,
      assignee,
      q: taskQuery,
      sort,
      foundBy,
    });
    // Cache the durable filters so a bare /debug (nav link, fresh tab) reopens
    // the way you left it — the URL alone only survives a literal reload.
    // Gated until the restore below has run: this effect fires on mount with
    // the defaults, and an ungated write would clobber the cache before the
    // restore ever read it.
    if (filtersAdoptedRef.current) {
      storeBoardFilters({
        board,
        state: stateFilter,
        priority,
        kind: kindFilter,
        assignee,
        q: taskQuery,
        sort,
        foundBy,
      });
    }
  }, [
    writeFilterUrl,
    board,
    stateFilter,
    priority,
    kindFilter,
    assignee,
    taskQuery,
    sort,
    foundBy,
  ]);

  // Restore the cached filters on a bare URL. After paint (rAF) for the same
  // reason as the brainstorm trail below: the server render has no
  // localStorage, so a synchronous set would either mismatch hydration (lazy
  // init) or trip react-hooks/set-state-in-effect (direct set).
  //
  // Values are sanitized against what exists NOW — the cache can be weeks old,
  // and a deleted project or departed assignee would silently filter the board
  // down to nothing with no visible chip explaining why.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      filtersAdoptedRef.current = true;
      if (urlSeeded) return; // an explicit link outranks the cache
      const stored = loadStoredBoardFilters();
      if (!stored) return;
      const keep = (values: string[] | undefined, ok: (v: string) => boolean) =>
        values?.filter(ok) ?? [];

      const projectIds = new Set(projects.map((p) => p.id));
      const boards = keep(
        stored.board,
        (v) => v === "all" || v === "general" || projectIds.has(v)
      );
      if (boards.length > 0) setBoard(boards);

      const states = keep(stored.state, (v) =>
        STATE_FILTER_OPTIONS.some((o) => o.value === v)
      );
      // An empty array is a REAL cached value for state (the "All" preset), so
      // presence of the field — not a non-empty result — is what restores it.
      // But an array that BECAME empty through sanitizing was garbage, not a
      // choice; restoring it would silently flip Active to All.
      if (stored.state && (states.length > 0 || stored.state.length === 0)) {
        setStateFilter(states);
      }
      setPriority(
        keep(stored.priority, (v) =>
          PRIORITY_FILTER_OPTIONS.some((o) => o.value === v)
        )
      );
      setKindFilter(
        keep(stored.kind, (v) => KIND_FILTER_OPTIONS.some((o) => o.value === v))
      );
      setAssignee(
        keep(stored.assignee, (v) => v === "unassigned" || v in members)
      );
      if (stored.sort && SORT_OPTIONS.some((o) => o.value === stored.sort)) {
        setSort(stored.sort as Sort);
      }
    });
    return () => cancelAnimationFrame(frame);
    // Mount-only: projects/members are only used to sanitize the one-time read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [seenImages, setSeenImages] = useState(initialImages);
  if (seenImages !== initialImages) {
    setSeenImages(initialImages);
    setImages(initialImages);
  }
  const [seenNotes, setSeenNotes] = useState(initialNotes);
  if (seenNotes !== initialNotes) {
    setSeenNotes(initialNotes);
    setNotes(initialNotes);
  }

  /** Screenshots grouped by task, so each row gets its own slice in O(1). */
  const imagesByTask = useMemo(() => {
    const map: Record<string, DebugTaskImage[]> = {};
    for (const img of images) (map[img.task_id] ??= []).push(img);
    return map;
  }, [images]);

  /** Notes grouped by task, oldest first — a thread reads down the page. */
  const notesByTask = useMemo(() => {
    const map: Record<string, DebugTaskNote[]> = {};
    for (const note of notes) (map[note.task_id] ??= []).push(note);
    return map;
  }, [notes]);

  /** Replace one task's images after an upload or delete inside a row. */
  function setTaskImages(taskId: string, next: DebugTaskImage[]) {
    setImages((prev) => [...prev.filter((i) => i.task_id !== taskId), ...next]);
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
      // Notes stream on the same channel as the tasks they hang off, so a
      // teammate's note lands in an already-expanded row without a reload.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "debug_task_notes", ...scope },
        (payload) => {
          const row = payload.new as DebugTaskNote;
          if (row.is_demo !== showcase) return;
          setNotes((prev) =>
            prev.some((n) => n.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "debug_task_notes", ...scope },
        (payload) => {
          const row = payload.new as DebugTaskNote;
          setNotes((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "debug_task_notes" },
        (payload) => {
          const gone = payload.old as { id: string };
          setNotes((prev) => prev.filter((n) => n.id !== gone.id));
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

    // One audit's findings. Set by the "Found N" link on an audit row; the chip
    // above the list names it, so the narrowing is never unexplained.
    if (foundBy) list = list.filter((t) => t.found_by === foundBy);

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
  }, [liveTasks, board, assignee, priority, stateFilter, kindFilter, taskQuery, sort, sessionIds, foundBy]);

  // Keep the keyboard cursor inside the list DURING RENDER as it shrinks —
  // filtering or a realtime delete can drop the row you were on. Doing this in
  // an effect would trip `react-hooks/set-state-in-effect` (an ERROR in this
  // repo) and paint one frame pointing at nothing. Same during-render clamp
  // Dropdown/MultiDropdown already use.
  const [seenLen, setSeenLen] = useState(visible.length);
  if (seenLen !== visible.length) {
    setSeenLen(visible.length);
    if (cursor > visible.length - 1) setCursor(visible.length - 1);
  }

  /**
   * Board keyboard shortcuts — the delivery of PRODUCT.md's "full keyboard
   * operability for claim/tick flows", which the board did not have.
   *
   * ⚠️ THE CRITICAL RULE: every shortcut must no-op while the user is TYPING.
   * These are bare keys, so without the guard below, `c` would claim a task
   * while you typed "crash" into the search box and `/` would never reach it at
   * all. The ⌘K palette is meta-scoped so it doesn't collide, but this board's
   * own search field absolutely would.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never hijack a modified chord (⌘K, ⌘R, ctrl+C…).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);

      if (typing) {
        // Escape is the one key that still means something while typing: it
        // gets you back out of the search box to the board.
        if (e.key === "Escape") el.blur();
        return;
      }

      if (shortcutsOpen && e.key !== "?" && e.key !== "Escape") return;

      const move = (delta: number) => {
        e.preventDefault();
        if (visible.length === 0) return;
        setCursor((c) => {
          const next = c < 0 ? (delta > 0 ? 0 : visible.length - 1) : c + delta;
          return Math.max(0, Math.min(visible.length - 1, next));
        });
      };

      const current = cursor >= 0 ? visible[cursor] : null;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          move(1);
          break;
        case "k":
        case "ArrowUp":
          move(-1);
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "?":
          e.preventDefault();
          setShortcutsOpen((v) => !v);
          break;
        case "Escape":
          e.preventDefault();
          if (shortcutsOpen) setShortcutsOpen(false);
          else if (selectMode) setSelectMode(false);
          else setCursor(-1);
          break;
        case "x":
          if (!current) break;
          e.preventDefault();
          // Selecting implies wanting select mode — don't make people turn it
          // on first just to use the key that turns things on.
          setSelectMode(true);
          setPicked((prev) => {
            const next = new Set(prev);
            if (next.has(current.id)) next.delete(current.id);
            else next.add(current.id);
            return next;
          });
          break;
        case "c": {
          if (!current) break;
          e.preventDefault();
          const mine = current.assignee_id === meId;
          // Unclaim only your own (admins may release anyone's) — the same rule
          // the row buttons and the DB trigger enforce.
          if (current.assignee_id && !mine && !isAdmin) {
            toastError("That task isn't yours to unclaim.");
            break;
          }
          if (current.assignee_id) {
            patchTask(current.id, { assignee_id: null });
            unclaimTask(current.id).then((r) => {
              if (r && !r.ok) {
                patchTask(current.id, { assignee_id: current.assignee_id });
                toastError(r.message);
              }
            });
          } else {
            patchTask(current.id, { assignee_id: meId });
            claimTask(current.id).then((r) => {
              if (r && !r.ok) {
                patchTask(current.id, { assignee_id: null });
                toastError(r.message);
              }
            });
          }
          break;
        }
        case "1":
        case "2":
        case "3": {
          if (!current) break;
          e.preventDefault();
          // State is locked until someone holds the task — the same rule as
          // the row's pills and the server action.
          if (!current.assignee_id) {
            toastError("Claim the task first — state tracks whoever holds it.");
            break;
          }
          const next = (["open", "in_progress", "done"] as DebugState[])[
            Number(e.key) - 1
          ];
          if (!next || current.state === next) break;
          const before = current.state;
          patchTask(current.id, { state: next });
          setTaskState(current.id, next).then((r) => {
            if (r && !r.ok) {
              patchTask(current.id, { state: before });
              toastError(r.message);
            }
          });
          break;
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    visible,
    cursor,
    selectMode,
    shortcutsOpen,
    meId,
    isAdmin,
    patchTask,
    toastError,
  ]);

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
    const text = tasksToText(pickedVisible, {
      members,
      projects,
      imagesByTask,
    });
    const n = pickedVisible.length;
    // Clipboard first, inside the gesture window — see task-row's copyTask.
    navigator.clipboard.writeText(text).then(
      async () => {
        const saved = await downloadTaskImages(
          pickedVisible,
          imagesByTask,
          async (paths) => {
            const { data } = await createClient()
              .storage
              .from("debug")
              .createSignedUrls(paths, 60 * 5);
            return (data ?? []).map((d) => d.signedUrl ?? null);
          }
        );
        toastSuccess(
          saved > 0
            ? `Copied ${n} task${n === 1 ? "" : "s"} — ${saved} image${saved === 1 ? "" : "s"} saved to Downloads.`
            : `Copied ${n} task${n === 1 ? "" : "s"}.`
        );
      },
      () => toastError("Couldn't copy — clipboard blocked.")
    );
  }

  function downloadPicked() {
    if (pickedVisible.length === 0) return;
    // The .txt names the screenshots too, and they come down beside it — a
    // saved bundle that mentions images you don't have is half a bug report.
    const text = tasksToText(pickedVisible, { members, projects, imagesByTask });
    // todayLocal (not todayInIstanbul) is right here: a download filename is
    // about the person saving it, not a shared domain date.
    downloadBlob(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      `debug-tasks-${todayLocal()}.txt`
    );
    const n = pickedVisible.length;
    downloadTaskImages(pickedVisible, imagesByTask, async (paths) => {
      const { data } = await createClient()
        .storage.from("debug")
        .createSignedUrls(paths, 60 * 5);
      return (data ?? []).map((d) => d.signedUrl ?? null);
    }).then((saved) => {
      toastSuccess(
        saved > 0
          ? `Downloaded ${n} task${n === 1 ? "" : "s"} and ${saved} image${saved === 1 ? "" : "s"}.`
          : `Downloaded ${n} task${n === 1 ? "" : "s"}.`
      );
    });
  }

  /**
   * Apply one change to every picked row.
   *
   * Optimistic on the rows the guards can't reject (state / priority / board),
   * but NOT on claim — a claim can legitimately lose the race to a teammate, and
   * painting it as claimed before the server agrees would show a lie for a beat
   * and then snap back. The action reports the split and the toast says it.
   *
   * Rows that were skipped stay picked, so you can see which ones didn't take.
   */
  function applyBulk(patch: BulkPatch, optimistic?: (t: DebugTask) => DebugTask) {
    const ids = pickedVisible.map((t) => t.id);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const before = tasks;
    if (optimistic) {
      setTasks((prev) => prev.map((t) => (idSet.has(t.id) ? optimistic(t) : t)));
    }
    // Called directly rather than through `useAction().run`, because that helper
    // only surfaces a message on FAILURE — and here the success message is the
    // whole point ("Claimed 7 — 3 were already taken"). A partial success that
    // toasted nothing would be the silent lie this feature exists to avoid.
    setBulkPending(true);
    updateTasks(ids, patch)
      .then((result) => {
        if (!result?.ok) {
          if (optimistic) setTasks(before);
          toastError(result?.message ?? "Couldn't apply that.");
          return;
        }
        toastSuccess(result.message);
        // Clear the selection only when everything took. A skipped row stays
        // picked so the selection itself shows you what didn't happen.
        if (!result.skipped) setPicked(new Set());
      })
      .catch(() => {
        if (optimistic) setTasks(before);
        toastError("Something went wrong. Please try again.");
      })
      .finally(() => setBulkPending(false));
  }

  // Assignee filter options: only people who actually hold a task, so the list
  // stays short and relevant. "Anyone" and "Unassigned" are always offered.
  //
  // Each option carries HOW MANY tasks it matches. The counts are taken over the
  // whole board (`liveTasks`) and deliberately IGNORE the other filters, so a
  // number is a stable fact — "Ali holds 12 here" — rather than something that
  // reshuffles every time you touch a different control. The tradeoff is
  // accepted: a non-zero count can still yield an empty view when another filter
  // excludes those rows.
  const assigneeOptions = useMemo(() => {
    const tally = new Map<string, number>();
    for (const t of liveTasks) {
      const key = t.assignee_id ?? "unassigned";
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    const people = [...tally.keys()]
      .filter((id) => id !== "unassigned")
      .map((id) => ({
        value: id,
        label: members[id]?.name ?? "Someone",
        count: tally.get(id) ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [
      { value: "unassigned", label: "Unassigned", count: tally.get("unassigned") ?? 0 },
      ...people,
    ];
  }, [liveTasks, members]);

  // Kind / state / priority tallies for the Filters popover, same whole-board
  // basis. One pass over the tasks rather than one filter() per option.
  const facetCounts = useMemo(() => {
    const kind: Record<string, number> = {};
    const state: Record<string, number> = {};
    const priority: Record<string, number> = {};
    const assignee: Record<string, number> = {};
    for (const t of liveTasks) {
      kind[t.kind] = (kind[t.kind] ?? 0) + 1;
      state[t.state] = (state[t.state] ?? 0) + 1;
      priority[t.priority] = (priority[t.priority] ?? 0) + 1;
      const holder = t.assignee_id ?? "unassigned";
      assignee[holder] = (assignee[holder] ?? 0) + 1;
    }
    return {
      Kind: kind,
      State: state,
      Priority: priority,
      Assignee: assignee,
    } as Record<string, Record<string, number>>;
  }, [liveTasks]);

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

  // Ordered from the SERVER snapshot (`initialTasks`), not `liveTasks` — both
  // inputs only change on a server re-render, so realtime task churn moves the
  // count pills but never reshuffles the rail mid-session.
  const { ordered: orderedProjects, openCounts } = useMemo(
    () => orderBoards(projects, initialTasks),
    [projects, initialTasks]
  );
  const projectTabs = orderedProjects.map((p) => ({ key: p.id, name: p.name }));

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
      {shortcutsOpen && (
        <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />
      )}
      <DebugFocusHero
        items={focusItems}
        isAdmin={isAdmin}
        projects={projects}
      />

      {/* Project boards — one table per project, switched locally. The divider
          lives on the wrapper (full-width, always crisp); the inner rail scrolls
          with no visible bar and fades at both edges, so an overflowing strip
          reads as "there's more this way" instead of exposing a scrollbar.

          ⚠️ THE RAIL MUST NOT SCROLL VERTICALLY. Two past mistakes, both fixed
          here, both easy to reintroduce:
          - `overflow-x-auto` alone makes the OTHER axis compute to `auto` too
            (CSS spec: one axis non-visible forces the visible one to auto), so
            without `overflow-y-hidden` the rail is a real vertical scroll
            container that eats wheel/touch scroll meant for the page.
          - the tabs used `-mb-px` to pull their active border over the
            wrapper's line — a negative margin inside a scroll container is 1px
            of vertical scrollable overflow, i.e. the same trap. The underline
            now lives inside the rail's height, sitting directly on top of the
            wrapper's hairline instead of overlapping it.
          Also: the edge fade was `mask-[…]`, which is not a Tailwind utility —
          it silently did nothing. `[mask-image:…]` is the arbitrary-property
          form that actually renders. */}
      <div className="flex items-center border-b border-line">
        <div
          className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]"
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
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-150",
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
        {/* Sits OUTSIDE the scrolling rail so it's always reachable, however
            long the strip grows. The rail auto-sorts by open work; this is
            where an admin overrides that to direct attention. */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setOrderOpen(true)}
            title="Order boards"
            aria-label="Order boards"
            className="ml-1 shrink-0 rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <ArrowUpDown className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {orderOpen && (
        <BoardOrderOverlay
          projects={orderedProjects}
          openCounts={openCounts}
          onClose={() => setOrderOpen(false)}
        />
      )}

      {/* THE TOOLBAR. One row between the rail and the list — this used to be
          TWO rows (presets + Select/Brainstorm/live, then search + assignee +
          filters + sort): with the rail above and a banner below, a phone
          showed a wall of controls before the first task, and the board's own
          comments had already fought that battle twice.

          What earned a visible slot: the presets (the switch people actually
          live in), the task search (the other thing people actually reach
          for), and Filters — which now carries EVERYTHING else that narrows or
          orders the list (kind/state/priority/assignee/sort) behind one count-
          badged button. Actions that aren't filtering at all (Select,
          Brainstorm, shortcuts) sit in a ⋯ menu. The live dot stays as passive
          text; it's a fact, not a control. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Quick views. These WRITE the state/assignee filters rather than
            filtering separately — a preset reads as "selected" whenever the
            controls happen to match it, including when you got there by
            setting the controls by hand. */}
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
                  "rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                  on
                    ? "bg-raised text-ink"
                    : "text-muted hover:bg-raised/60 hover:text-ink"
                )}
              >
                {p.label}
              </button>
            );
          })}
          {/* Reserved-slot Reset: it sits after fixed-width buttons so its
              mounting never resizes the flex-1 search beside it. */}
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
        <div className="relative min-w-36 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            ref={searchRef}
            value={taskQuery}
            onChange={(e) => setTaskQuery(e.target.value)}
            placeholder="Search…  (press /)"
            aria-label="Search tasks"
            className="h-9 w-full rounded-md border border-line bg-raised pl-8 pr-3 text-sm text-ink placeholder:text-muted transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong"
          />
        </div>
        <FiltersPopover
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          stateFilter={stateFilter}
          setStateFilter={setStateFilter}
          priority={priority}
          setPriority={setPriority}
          assignee={assignee}
          setAssignee={setAssignee}
          assigneeOptions={assigneeOptions}
          sort={sort}
          setSort={(v) => setSort(v as Sort)}
          counts={facetCounts}
        />
        <BoardMenu
          selectMode={selectMode}
          onToggleSelect={toggleSelectMode}
          onShortcuts={() => setShortcutsOpen(true)}
        />
        {/* Not hidden on phones: "offline — refresh" is the only recovery
            affordance when the realtime channel drops, and phones drop it most. */}
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

      {/* ONE BANNER SLOT. These three strips share a look (primary-tinted
          hairline bar) and used to stack — select mode over an audit filter
          over a brainstorm trail was three banners of chrome before the list.
          Now exactly one shows, most-actionable first: the bulk bar is a mode
          you're IN, the audit filter explains a narrowed list, the trail is
          an afterglow. The hidden ones aren't lost — leaving the winning mode
          reveals the next. */}

      {/* The brainstorm session's tasks stay marked and pinned for triage
          until someone clears the trail. */}
      {!selectMode && !foundBy && sessionIds.size > 0 && (
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

      {/* Naming the audit filter. A board narrowed to seven rows with nothing
          saying why reads as a bug — this makes the narrowing visible and
          removable, the same reasoning as the Filters count badge. */}
      {!selectMode && foundBy && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[13px]">
          <SearchCheck className="size-3.5 shrink-0 text-primary-dim" aria-hidden />
          <span className="min-w-0 text-muted">
            Showing what{" "}
            <span className="text-ink">
              {tasks.find((t) => t.id === foundBy)?.title ?? "an audit"}
            </span>{" "}
            found
          </span>
          <button
            type="button"
            onClick={() => setFoundBy("")}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink"
          >
            <X className="size-3" aria-hidden />
            Show everything
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
          {/* Write actions. They act on `pickedVisible` — what you can SEE is
              what you change, so a filtered-away row can never be caught in a
              batch you didn't look at. */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Dropdown's trigger text is a VALUE, not a label, so each one is
                wrapped with an explicit accessible name. */}
            <span aria-label="Set state for selected tasks">
              <Dropdown
                className="w-32"
                id="bulk-state"
                value=""
                placeholder="Set state"
                disabled={pickedVisible.length === 0 || bulkPending}
                options={STATE_FILTER_OPTIONS}
                onChange={(v) =>
                  applyBulk({ state: v as DebugState }, (t) =>
                    // Unclaimed rows are skipped server-side (state needs a
                    // holder) — painting them would flash a lie and snap back.
                    t.assignee_id ? { ...t, state: v as DebugState } : t
                  )
                }
              />
            </span>
            <span aria-label="Set priority for selected tasks">
              <Dropdown
                className="w-32"
                id="bulk-priority"
                value=""
                placeholder="Set priority"
                disabled={pickedVisible.length === 0 || bulkPending}
                options={PRIORITY_FILTER_OPTIONS}
                onChange={(v) =>
                  applyBulk({ priority: v as DebugTask["priority"] }, (t) => ({
                    ...t,
                    priority: v as DebugTask["priority"],
                  }))
                }
              />
            </span>
            <span aria-label="Move selected tasks to another board">
              <Dropdown
                className="w-32"
                id="bulk-board"
                value=""
                placeholder="Move to…"
                disabled={pickedVisible.length === 0 || bulkPending}
                searchThreshold={BOARD_SEARCH_THRESHOLD}
                options={[
                  { value: "", label: "General" },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                onChange={(v) =>
                  applyBulk({ project_id: v || null }, (t) => ({
                    ...t,
                    project_id: v || null,
                  }))
                }
              />
            </span>
            {/* Claim is NOT optimistic — it can lose the race to a teammate on
                this shared board, and showing it as yours before the server
                agrees would flash a lie. */}
            <Button
              variant="outline"
              size="sm"
              disabled={pickedVisible.length === 0 || bulkPending}
              onClick={() => applyBulk({ claim: "claim" })}
            >
              Claim
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pickedVisible.length === 0 || bulkPending}
              onClick={() => applyBulk({ claim: "unclaim" })}
            >
              Unclaim
            </Button>
          </div>

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
            {visible.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                cursored={index === cursor}
                members={members}
                meId={meId}
                isAdmin={isAdmin}
                canMessage={canMessage}
                projects={projects}
                suggestOptions={suggestOptions}
                foundCount={foundCounts[task.id] ?? 0}
                foundByTitle={
                  task.found_by
                    ? (tasks.find((t) => t.id === task.found_by)?.title ?? null)
                    : null
                }
                images={imagesByTask[task.id] ?? EMPTY_IMAGES}
                onImagesChange={(next) => setTaskImages(task.id, next)}
                notes={notesByTask[task.id] ?? EMPTY_NOTES}
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
 * Everything that narrows or orders the list, behind one control: Kind, State,
 * Priority, Assignee and Sort.
 *
 * These were five separate controls across a row that already held a search
 * box — six equal-weight widgets, none of which told you how filtered you
 * were. Folded into one button with a count, the toolbar gets its width back
 * and gains the summary it was missing. Assignee joined the chips because a
 * team of eight is a chip row, not a dropdown; Sort joined because "how the
 * list is arranged" is the same mental act as "what the list shows".
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
  assignee,
  setAssignee,
  assigneeOptions,
  sort,
  setSort,
  counts,
}: {
  kindFilter: string[];
  setKindFilter: (v: string[]) => void;
  stateFilter: string[];
  setStateFilter: (v: string[]) => void;
  priority: string[];
  setPriority: (v: string[]) => void;
  assignee: string[];
  setAssignee: (v: string[]) => void;
  assigneeOptions: { value: string; label: string; count: number }[];
  sort: string;
  setSort: (v: string) => void;
  /** Group label → option value → how many tasks on the board match. */
  counts: Record<string, Record<string, number>>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Sort stays out of the badge — it always has a value, so counting it would
  // read "1 filter active" on a board that isn't filtered at all.
  const count =
    kindFilter.length + stateFilter.length + priority.length + assignee.length;

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
    {
      label: "Assignee",
      options: assigneeOptions.map((o) => ({ value: o.value, label: o.label })),
      values: assignee,
      set: setAssignee,
    },
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
        <div className="absolute right-0 z-20 mt-1 w-[min(19rem,calc(100vw-2rem))] origin-top animate-pop-in rounded-md border border-line bg-raised/90 p-3 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="space-y-3">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map((o) => {
                    const on = group.values.includes(o.value);
                    const n = counts[group.label]?.[o.value] ?? 0;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${o.label} — ${n} task${n === 1 ? "" : "s"}`}
                        onClick={() =>
                          group.set(
                            on
                              ? group.values.filter((v) => v !== o.value)
                              : [...group.values, o.value]
                          )
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px]",
                          "transition-[background-color,border-color,transform] duration-150 ease-mac active:scale-[0.97]",
                          on
                            ? "border-primary/50 bg-primary/10 text-ink"
                            : "border-line text-muted hover:border-line-strong hover:text-ink"
                        )}
                      >
                        {o.label}
                        {/* The count is a fact about the board, so it recedes
                            behind the label it qualifies. Mono + tabular keeps
                            the chips from resizing as numbers change width. */}
                        <span className="font-mono text-[11px] tabular-nums text-faint">
                          {n}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Sort is single-select: picking one deselects the rest, and
                there's always exactly one on — so no counts, and no part in
                the filter badge. */}
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                Sort
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((o) => {
                  const on = sort === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSort(o.value)}
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[12px]",
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
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={() => {
                setKindFilter([]);
                setStateFilter([]);
                setPriority([]);
                setAssignee([]);
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
 * The toolbar's ⋯ menu: things you DO on the board rather than ways you
 * narrow it — select mode, the brainstorm flow, the shortcut reference. They
 * had a visible button each; none of them is reached often enough to charge
 * the toolbar three slots of width for the privilege.
 */
function BoardMenu({
  selectMode,
  onToggleSelect,
  onShortcuts,
}: {
  selectMode: boolean;
  onToggleSelect: () => void;
  onShortcuts: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Same dismissal contract as every popover in the app.
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

  const itemClass =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-muted transition-colors duration-150 hover:bg-raised hover:text-ink";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Board actions"
        title="Board actions"
        className={cn(
          "flex h-9 items-center rounded-md border px-2.5 transition-colors duration-150",
          // Select mode tints the trigger so the mode is visible even with
          // the menu closed — otherwise "why do my rows have checkboxes"
          // has no answer on screen.
          selectMode
            ? "border-primary-dim bg-primary/10 text-ink"
            : "border-line bg-raised text-muted hover:border-line-strong hover:text-ink"
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 origin-top animate-pop-in rounded-md border border-line bg-raised/90 p-1 shadow-lg shadow-black/40 backdrop-blur-md"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              onToggleSelect();
              setOpen(false);
            }}
          >
            <CheckSquare className="size-3.5" aria-hidden />
            {selectMode ? "Exit select mode" : "Select tasks…"}
          </button>
          <Link
            href="/debug/brainstorm"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <ListPlus className="size-3.5" aria-hidden />
            Brainstorm
          </Link>
          <button
            type="button"
            role="menuitem"
            className={cn(itemClass, "hidden md:flex")}
            onClick={() => {
              onShortcuts();
              setOpen(false);
            }}
          >
            <Keyboard className="size-3.5" aria-hidden />
            Keyboard shortcuts
          </button>
        </div>
      )}
    </div>
  );
}

/** The board's keyboard map, and the source of the `?` overlay below. */
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["j", "k"], label: "Move down / up" },
  { keys: ["c"], label: "Claim or release the task" },
  { keys: ["1", "2", "3"], label: "Open · In progress · Done" },
  { keys: ["x"], label: "Select the task" },
  { keys: ["/"], label: "Search" },
  { keys: ["?"], label: "This list" },
  { keys: ["Esc"], label: "Back out" },
];

/**
 * The `?` shortcuts overlay.
 *
 * A modal is right here even though DESIGN.md reserves them for destructive
 * confirms: this is transient HELP, not an authoring surface — it holds no
 * state, changes nothing, and every path out dismisses it. Same shell language
 * as the focus composer and the status editor.
 */
function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm motion-safe:animate-[overlay-in_150ms_var(--ease-mac)_both]"
      />
      <div className="relative w-full max-w-sm origin-center animate-pop-in rounded-xl border border-line-strong bg-raised/90 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <ul className="space-y-2 px-5 pb-5">
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-4 text-[13px]"
            >
              <span className="text-muted">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
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
