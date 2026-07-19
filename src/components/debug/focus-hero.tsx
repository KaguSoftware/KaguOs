"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Target, X } from "lucide-react";
import {
  clearAllDebugFocus,
  clearDebugFocus,
  reorderDebugFocus,
  saveDebugFocus,
} from "@/lib/actions/debug-focus";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { DebugFocus, DebugFocusParts } from "@/lib/types";

type Tone = "info" | "primary" | "warning";

const TONE: Record<Tone, string> = {
  info: "border-info/30 bg-info/10",
  primary: "border-primary/30 bg-primary/10",
  warning: "border-amber/30 bg-amber/10",
};

const ICON_TONE: Record<Tone, string> = {
  info: "text-info",
  primary: "text-primary-dim",
  warning: "text-amber",
};

const DOT_TONE: Record<Tone, string> = {
  info: "bg-info",
  primary: "bg-primary",
  warning: "bg-amber",
};

const TONE_OPTIONS: { key: Tone; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "primary", label: "Highlight" },
  { key: "warning", label: "Heads-up" },
];

/** Above this many boards the picker grows a filter box (matches board.tsx). */
const BOARD_SEARCH_THRESHOLD = 5;

/**
 * The qualifiers one focus item can carry. `label` is what the chip shows;
 * `phrase` is how it reads inside the sentence — "Unstarted work" as a chip,
 * "unstarted work" mid-clause.
 */
type Step = { value: string; label: string; phrase: string };

const KIND_STEP: Step[] = [
  { value: "fix", label: "Fixes", phrase: "fixes" },
  { value: "feature", label: "Features", phrase: "features" },
  { value: "audit", label: "Audits", phrase: "audits" },
];

const PRIORITY_STEP: Step[] = [
  { value: "urgent", label: "Urgent", phrase: "urgent" },
  { value: "high", label: "High", phrase: "high" },
  { value: "medium", label: "Medium", phrase: "medium" },
  { value: "low", label: "Low", phrase: "low" },
];

const STATE_STEP: Step[] = [
  { value: "open", label: "Unstarted", phrase: "unstarted work" },
  { value: "in_progress", label: "In progress", phrase: "work already started" },
  { value: "unclaimed", label: "Unclaimed", phrase: "unclaimed tasks" },
];

// Phrases deliberately avoid the word "and" — clauses are already joined with it.
const ORDER_STEP: Step[] = [
  { value: "overdue", label: "Overdue first", phrase: "overdue first" },
  { value: "oldest", label: "Oldest first", phrase: "oldest first" },
  { value: "quickest", label: "Quickest first", phrase: "quickest first" },
];

type Draft = {
  /** Editing an existing item keeps its id (and its rank). */
  id?: string;
  /** Empty = the whole board. Several = one instruction covering those boards. */
  projectIds: string[];
  /**
   * "work" = get through what's on the board · "find" = go LOOK for what isn't
   * on it yet. Opposite instructions, so they take different qualifiers and
   * read as different sentences.
   */
  mode: "work" | "find";
  /** What to go looking for, in "find" mode. */
  hunt: string[];
  kinds: string[];
  priorities: string[];
  states: string[];
  order: string[];
  tone: Tone;
  /** Set once the admin types — from then on the sentence stops auto-building. */
  body: string;
  edited: boolean;
};

const EMPTY_DRAFT: Draft = {
  projectIds: [],
  mode: "work",
  hunt: [],
  kinds: [],
  priorities: [],
  states: [],
  order: [],
  tone: "info",
  body: "",
  edited: false,
};

/** "a, b and c" — the way a person writes a list. */
function joinWords(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function phrasesFor(step: Step[], picked: string[]) {
  return step.filter((o) => picked.includes(o.value)).map((o) => o.phrase);
}

/** What kind of thing to go looking for, in "find work" mode. */
const HUNT_STEP: Step[] = [
  { value: "bugs", label: "Bugs", phrase: "anything broken" },
  { value: "missing", label: "Missing features", phrase: "what's missing" },
  { value: "rough", label: "Rough edges", phrase: "rough edges" },
  { value: "stale", label: "Out-of-date stuff", phrase: "anything out of date" },
];

/**
 * One item's sentence. The qualifiers apply to every board the item names —
 * which is exactly why a SECOND item exists for a board that needs different
 * instructions, instead of one line blending them all together.
 *
 * Two shapes, because the two modes are opposite instructions:
 *   work → "Pet app — fixes, urgent priority."      (work through what's there)
 *   find → "Pet app — go find anything broken and
 *           file what you hit."                      (put NEW tasks on the board)
 */
function buildSentence(draft: Draft, names: string[]) {
  const target = names.length ? joinWords(names) : "The whole board";

  if (draft.mode === "find") {
    const hunting = phrasesFor(HUNT_STEP, draft.hunt);
    if (hunting.length === 0) {
      return `${target} — go find what needs doing and file it.`;
    }
    // Comma-join, never "and": the clause already ends with "and file it", and
    // "anything broken and what's missing and file what you hit" is unreadable.
    return `${target} — go looking for ${hunting.join(", ")}. File what you hit.`;
  }

  const priorities = phrasesFor(PRIORITY_STEP, draft.priorities);
  const clauses = [
    joinWords(phrasesFor(KIND_STEP, draft.kinds)),
    priorities.length ? `${joinWords(priorities)} priority` : "",
    joinWords(phrasesFor(STATE_STEP, draft.states)),
    joinWords(phrasesFor(ORDER_STEP, draft.order)),
  ].filter(Boolean);

  if (clauses.length === 0) {
    return `${target} — claim what's open there first.`;
  }
  return `${target} — ${clauses.join(", ")}.`;
}

export function DebugFocusHero({
  items,
  isAdmin,
  projects,
}: {
  /** Every ACTIVE focus item, already rank-ordered by the server. */
  items: DebugFocus[];
  isAdmin: boolean;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);

  if (items.length === 0 && !isAdmin) return null;

  return (
    <>
      {open && (
        <FocusModal
          items={items}
          projects={projects}
          pending={pending}
          run={run}
          onClose={() => setOpen(false)}
          onChanged={() => router.refresh()}
        />
      )}

      {items.length === 0 ? (
        isAdmin && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mb-4 flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-4 py-2.5 text-[13px] text-faint transition-colors duration-150 hover:border-line-strong hover:text-muted"
          >
            <Plus className="size-3.5" aria-hidden />
            Set the focus for the Debug board
          </button>
        )
      ) : items.length === 1 ? (
        // A single focus stays a full-width banner — the shape it had before,
        // because one instruction doesn't need a list around it.
        <div
          className={cn(
            "mb-4 flex items-start gap-3 rounded-lg border px-4 py-3",
            TONE[items[0].tone]
          )}
        >
          <Target
            className={cn("mt-0.5 size-4 shrink-0", ICON_TONE[items[0].tone])}
            aria-hidden
          />
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-ink">
            {items[0].body}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Edit focus"
              className="shrink-0 rounded p-1 text-faint transition-colors hover:text-ink"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        // Several fronts at once: one row each, ranked. Each keeps its own tone
        // dot so "heads-up on Site" still reads differently from "info on Pet".
        <div className="mb-4 overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <Target className="size-3.5 text-faint" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
              Focus — {items.length} things
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink"
              >
                <Pencil className="size-3" aria-hidden />
                Edit
              </button>
            )}
          </div>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    DOT_TONE[item.tone]
                  )}
                  aria-hidden
                />
                {/* The board names are already the head of the sentence, so
                    there's no separate project label to repeat here. */}
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] text-ink">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[12px]",
        "transition-[background-color,border-color,transform] duration-150 ease-mac",
        "active:scale-[0.97]",
        selected
          ? "border-primary/50 bg-primary/10 text-ink"
          : "border-line text-muted hover:border-line-strong hover:bg-raised/50 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/**
 * The focus editor — same modal language as the sidebar status editor
 * (portaled, frosted, pop-in, Esc/backdrop close, scroll lock).
 *
 * The window shows the CURRENT LIST first: focus is usually a small edit to
 * what's already there ("drop Site, bump Pet app"), not a fresh composition.
 * The composer — the five chip groups — appears only while you're adding or
 * editing ONE item, so the modal is short at rest and the chips are never
 * permanent furniture.
 */
function FocusModal({
  items,
  projects,
  pending,
  run,
  onClose,
  onChanged,
}: {
  items: DebugFocus[];
  projects: { id: string; name: string }[];
  pending: boolean;
  run: ReturnType<typeof useAction>["run"];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [boardQuery, setBoardQuery] = useState("");
  // Local mirror so reordering feels instant; the server reconciles on refresh.
  const [order, setOrder] = useState(items);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const namesFor = (ids: string[]) =>
    ids
      .map((id) => projects.find((p) => p.id === id)?.name)
      .filter((n): n is string => Boolean(n));

  // Filter by the search box, but ALWAYS keep already-picked boards visible —
  // a filter that hides your own selection makes it look like it was dropped.
  const bq = boardQuery.trim().toLowerCase();
  const shownProjects = projects.filter(
    (p) =>
      !bq ||
      p.name.toLowerCase().includes(bq) ||
      (draft?.projectIds.includes(p.id) ?? false)
  );

  function startAdd() {
    setDraft({ ...EMPTY_DRAFT });
    setBoardQuery("");
  }

  function startEdit(item: DebugFocus) {
    const parts = (item.parts ?? {}) as DebugFocusParts;
    setDraft({
      id: item.id,
      projectIds: item.project_ids ?? [],
      mode: parts.mode === "find" ? "find" : "work",
      hunt: parts.hunt ?? [],
      kinds: parts.kinds ?? [],
      priorities: parts.priorities ?? [],
      states: parts.states ?? [],
      order: parts.order ?? [],
      tone: item.tone,
      body: item.body,
      // Existing items open with their saved wording intact; re-picking chips
      // regenerates it (see toggle()).
      edited: true,
    });
    setBoardQuery("");
  }

  /** Switching mode rewrites the sentence, since the two read nothing alike. */
  function setMode(mode: "work" | "find") {
    setDraft((d) => (d ? { ...d, mode, body: d.edited ? d.body : "" } : d));
  }

  function toggle(
    key: "kinds" | "priorities" | "states" | "order" | "hunt",
    value: string
  ) {
    setDraft((d) => {
      if (!d) return d;
      const next = {
        ...d,
        [key]: d[key].includes(value)
          ? d[key].filter((v) => v !== value)
          : [...d[key], value],
      };
      // Chips rewrite the sentence unless the admin has typed their own words.
      return { ...next, body: d.edited ? d.body : "" };
    });
  }

  /** Boards toggle like every other chip — several can share one instruction. */
  function toggleProject(id: string) {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        projectIds: d.projectIds.includes(id)
          ? d.projectIds.filter((v) => v !== id)
          : [...d.projectIds, id],
        body: d.edited ? d.body : "",
      };
    });
  }

  // The live sentence: whatever was typed, else built from the chips.
  const sentence = draft
    ? draft.edited && draft.body.trim()
      ? draft.body
      : buildSentence(draft, namesFor(draft.projectIds))
    : "";

  function save() {
    if (!draft) return;
    run(
      () =>
        saveDebugFocus({
          id: draft.id,
          projectIds: draft.projectIds,
          body: sentence,
          tone: draft.tone,
          parts: {
            mode: draft.mode,
            hunt: draft.hunt,
            kinds: draft.kinds,
            states: draft.states,
            priorities: draft.priorities,
            order: draft.order,
          },
        }),
      {
        success: "Focus set.",
        onSuccess: () => {
          setDraft(null);
          onChanged();
        },
      }
    );
  }

  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    run(() => reorderDebugFocus(next.map((i) => i.id)), {
      onSuccess: onChanged,
    });
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Board focus"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm motion-safe:animate-[overlay-in_150ms_var(--ease-mac)_both]"
      />

      <div className="relative flex max-h-[90vh] w-full max-w-lg origin-center flex-col animate-pop-in rounded-xl border border-line-strong bg-raised/90 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            What the board is focusing on
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-1">
          {/* The list as it stands. Focus is usually a small edit to this. */}
          {order.length > 0 && (
            <ul className="space-y-1.5">
              {order.map((item, i) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-line bg-surface/60 px-3 py-2"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      DOT_TONE[item.tone]
                    )}
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">
                    {item.body}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || pending}
                      aria-label="Move up"
                      className="rounded p-1 text-faint transition-colors hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === order.length - 1 || pending}
                      aria-label="Move down"
                      className="rounded p-1 text-faint transition-colors hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label="Edit this focus"
                      className="rounded p-1 text-faint transition-colors hover:text-ink"
                    >
                      <Pencil className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => clearDebugFocus(item.id), {
                          success: "Focus removed.",
                          optimistic: () =>
                            setOrder((o) => o.filter((x) => x.id !== item.id)),
                          onSuccess: onChanged,
                        })
                      }
                      aria-label="Remove this focus"
                      className="rounded p-1 text-faint transition-colors hover:text-danger"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* The composer — only while adding or editing ONE item. */}
          {draft ? (
            <div className="space-y-4 rounded-lg border border-line-strong bg-surface/60 p-3">
              <div>
                <div className="mb-2 flex items-baseline gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
                    Which boards
                  </p>
                  <span className="text-[11px] text-faint/70">
                    {draft.projectIds.length === 0
                      ? "none picked · the whole board"
                      : `${draft.projectIds.length} picked`}
                  </span>
                  {draft.projectIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) =>
                          d
                            ? { ...d, projectIds: [], body: d.edited ? d.body : "" }
                            : d
                        )
                      }
                      className="ml-auto text-[11px] text-faint transition-colors duration-150 hover:text-ink"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Search once the list is long enough to hunt through — the
                    same threshold and reasoning as the board tab strip. */}
                {projects.length >= BOARD_SEARCH_THRESHOLD && (
                  <div className="relative mb-2">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint"
                      aria-hidden
                    />
                    <input
                      value={boardQuery}
                      onChange={(e) => setBoardQuery(e.target.value)}
                      onKeyDown={(e) => {
                        // Enter picks the only match — type "pet", Enter, done.
                        if (e.key === "Enter" && shownProjects.length === 1) {
                          e.preventDefault();
                          toggleProject(shownProjects[0].id);
                          setBoardQuery("");
                        }
                      }}
                      data-no-ring
                      placeholder="Find a board…"
                      aria-label="Find a board"
                      className="h-8 w-full rounded-md border border-line bg-raised pl-8 pr-3 text-[13px] text-ink placeholder:text-faint transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {/* Picked boards always render, even when filtered out, so a
                      search never hides what you've already chosen. */}
                  {shownProjects.length === 0 && (
                    <span className="text-[12px] text-faint">
                      No boards match.
                    </span>
                  )}
                  {shownProjects.map((p) => (
                    <Chip
                      key={p.id}
                      selected={draft.projectIds.includes(p.id)}
                      onClick={() => toggleProject(p.id)}
                    >
                      {p.name}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* The two opposite instructions this board ever gives. */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                  Asking the team to
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    selected={draft.mode === "work"}
                    onClick={() => setMode("work")}
                  >
                    Work through the board
                  </Chip>
                  <Chip
                    selected={draft.mode === "find"}
                    onClick={() => setMode("find")}
                  >
                    Go find what needs doing
                  </Chip>
                </div>
              </div>

              {draft.mode === "find" ? (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                    Looking for{" "}
                    <span className="normal-case tracking-normal text-faint/70">
                      · optional
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {HUNT_STEP.map((o) => (
                      <Chip
                        key={o.value}
                        selected={draft.hunt.includes(o.value)}
                        onClick={() => toggle("hunt", o.value)}
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                    Narrow it{" "}
                    <span className="normal-case tracking-normal text-faint/70">
                      · optional
                    </span>
                  </p>
                  {/* One flat row: kind + priority + state + order all read as
                      "which tasks on this board", so splitting them into four
                      labelled sections was ceremony the admin had to scan past. */}
                  <div className="flex flex-wrap gap-1.5">
                    {KIND_STEP.map((o) => (
                      <Chip
                        key={o.value}
                        selected={draft.kinds.includes(o.value)}
                        onClick={() => toggle("kinds", o.value)}
                      >
                        {o.label}
                      </Chip>
                    ))}
                    <span className="w-px self-stretch bg-line" aria-hidden />
                    {PRIORITY_STEP.map((o) => (
                      <Chip
                        key={o.value}
                        selected={draft.priorities.includes(o.value)}
                        onClick={() => toggle("priorities", o.value)}
                      >
                        {o.label}
                      </Chip>
                    ))}
                    <span className="w-px self-stretch bg-line" aria-hidden />
                    {STATE_STEP.map((o) => (
                      <Chip
                        key={o.value}
                        selected={draft.states.includes(o.value)}
                        onClick={() => toggle("states", o.value)}
                      >
                        {o.label}
                      </Chip>
                    ))}
                    <span className="w-px self-stretch bg-line" aria-hidden />
                    {ORDER_STEP.map((o) => (
                      <Chip
                        key={o.value}
                        selected={draft.order.includes(o.value)}
                        onClick={() => toggle("order", o.value)}
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* The sentence, editable in place — no "use this wording" step. */}
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                  Reads as
                </p>
                <Textarea
                  value={sentence}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, body: e.target.value, edited: true } : d
                    )
                  }
                  maxLength={500}
                  rows={2}
                  aria-label="Focus wording"
                />
                {draft.edited && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => (d ? { ...d, body: "", edited: false } : d))
                    }
                    className="mt-1 text-[11px] text-faint transition-colors duration-150 hover:text-ink"
                  >
                    Back to the built wording
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] uppercase tracking-wide text-faint">
                  Tone
                </span>
                {TONE_OPTIONS.map((t) => (
                  <Chip
                    key={t.key}
                    selected={draft.tone === t.key}
                    onClick={() =>
                      setDraft((d) => (d ? { ...d, tone: t.key } : d))
                    }
                  >
                    {t.label}
                  </Chip>
                ))}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={pending || !sentence.trim()}
                    onClick={save}
                  >
                    {draft.id ? "Update" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startAdd}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-[13px] text-faint transition-colors duration-150 hover:border-line-strong hover:text-muted"
            >
              <Plus className="size-3.5" aria-hidden />
              {order.length === 0
                ? "Add a focus"
                : "Focus on something else too"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-4">
          {order.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => clearAllDebugFocus(), {
                  success: "Focus cleared.",
                  optimistic: () => setOrder([]),
                  onSuccess: onChanged,
                })
              }
              className="text-[13px] text-faint transition-colors duration-150 hover:text-danger"
            >
              Clear all
            </button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
