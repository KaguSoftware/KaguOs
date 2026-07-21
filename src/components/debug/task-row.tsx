"use client";

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Hand,
  ListPlus,
  Loader2,
  Pencil,
  SearchCheck,
  Sparkles,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react";
import {
  claimTask,
  deleteTask,
  logAuditFindings,
  setTaskState,
  unclaimTask,
  updateTask,
} from "@/lib/actions/debug";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { downloadTaskImages, taskToText } from "@/lib/debug-export";
import { createClient } from "@/lib/supabase/client";
import { TaskImages } from "@/components/debug/task-images";
import { addDays, cn, formatDate, todayInIstanbul } from "@/lib/utils";
import type {
  DebugKind,
  DebugPriority,
  DebugState,
  DebugTask,
  DebugTaskImage,
  MembersMap,
} from "@/lib/types";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const KIND_OPTIONS = [
  { value: "fix", label: "Fix", hint: "Something's broken" },
  { value: "feature", label: "Feature", hint: "Something new to build" },
  { value: "audit", label: "Audit", hint: "Go find what needs fixing" },
];

const KIND_LABEL: Record<DebugKind, string> = {
  fix: "fix",
  feature: "feature",
  audit: "audit",
};

const KIND_ICON: Record<DebugKind, typeof Wrench> = {
  fix: Wrench,
  feature: Sparkles,
  audit: SearchCheck,
};

/**
 * The kind marker: a tinted icon at the head of the row, where the eye starts.
 *
 * Kind and priority swapped places (2026-07-19, Parsa). Priority is a SCALE —
 * low→urgent — and scales read as words; a colour dot makes you remember what
 * four hues mean in order, which nobody does. Kind is a CATEGORY of three, it
 * never changes, and it already has three distinct icons, so it survives being
 * compressed to a mark in a way priority doesn't.
 *
 * The tints deliberately avoid green/amber/red: those three ARE the state
 * vocabulary on this board (done / in progress / urgent), and a "feature" chip
 * in state-green sitting inches from the green Done button would mean something
 * unrelated in the same colour. Slate, blue and violet are outside that
 * vocabulary, so they read as "a different axis" rather than as state.
 */
const KIND_STYLE: Record<DebugKind, string> = {
  fix: "bg-line-strong/40 text-muted",
  feature: "bg-info/10 text-info",
  audit: "bg-[oklch(0.72_0.10_300)]/10 text-[oklch(0.72_0.10_300)]",
};

function KindMark({ kind }: { kind: DebugKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md",
        KIND_STYLE[kind]
      )}
      title={KIND_LABEL[kind]}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{KIND_LABEL[kind]}</span>
    </span>
  );
}

const PRIORITY_TONE: Record<DebugPriority, BadgeTone> = {
  low: "faint",
  medium: "neutral",
  high: "amber",
  urgent: "danger",
};

/** Deadlines only earn a chip when they're close enough to act on. */
const DUE_SOON_DAYS = 7;

const STATE_LABEL: Record<DebugState, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export function TaskRow({
  task,
  cursored,
  members,
  meId,
  isAdmin,
  projects,
  suggestOptions,
  projectName,
  foundCount,
  foundByTitle,
  images,
  onImagesChange,
  highlight,
  selectable,
  selected,
  onToggleSelect,
  onPatch,
  onRemove,
  onRestore,
}: {
  task: DebugTask;
  /** The keyboard cursor is on this row — mark it and scroll it into view. */
  cursored?: boolean;
  members: MembersMap;
  meId: string;
  isAdmin: boolean;
  projects: { id: string; name: string }[];
  /** Work members an admin can "suggest for". Empty for non-admins. */
  suggestOptions: { value: string; label: string }[];
  projectName?: string | null;
  /** How many tasks this audit turned up. 0 for non-audits. */
  foundCount: number;
  /** Title of the audit that found this task, when it came from one. */
  foundByTitle?: string | null;
  /** Screenshots attached to this task. */
  images: DebugTaskImage[];
  onImagesChange: (next: DebugTaskImage[]) => void;
  /** Part of the brainstorm session trail — tinted until the trail is cleared. */
  highlight?: boolean;
  /** In batch-select mode: show a leading checkbox. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onPatch: (id: string, patch: Partial<DebugTask>) => void;
  onRemove: (id: string) => void;
  onRestore: (task: DebugTask) => void;
}) {
  const { pending, run } = useAction();
  const { success: toastSuccess, error: toastError } = useToast();
  const rowRef = useRef<HTMLLIElement>(null);
  const [expanded, setExpanded] = useState(false);

  /**
   * Opening a row near the bottom of the list used to leave its panel below the
   * fold, so every control inside it cost a scroll (Parsa, 2026-07-19). Pull the
   * row into view as it opens — after paint, so the panel has already been laid
   * out and the browser scrolls to its real height.
   */
  function toggleExpanded() {
    setExpanded((wasOpen) => {
      if (!wasOpen) {
        requestAnimationFrame(() => {
          const el = rowRef.current;
          if (!el) return;
          // Only scroll if the row now overflows the viewport — a row already
          // fully visible shouldn't jump under the user.
          const rect = el.getBoundingClientRect();
          if (rect.bottom > window.innerHeight) {
            el.scrollIntoView({ block: "end", behavior: "smooth" });
          }
        });
      }
      return !wasOpen;
    });
  }
  // Keep the keyboard cursor on screen as j/k walks past the fold. `nearest`
  // (not `center`) so a row already in view doesn't jump under the reader —
  // the same restraint the expand-scroll above shows.
  useEffect(() => {
    if (!cursored) return;
    rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [cursored]);

  const [editing, setEditing] = useState(false);
  // Audit only: the "what I found" composer, one finding per line.
  const [filing, setFiling] = useState(false);
  const [findings, setFindings] = useState("");
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description ?? "",
    priority: task.priority as DebugPriority,
    kind: task.kind as DebugKind,
    due_on: task.due_on ?? "",
    project_id: task.project_id ?? "",
    suggested_for: task.suggested_for ?? "",
  });

  const mine = task.assignee_id === meId;
  const canDelete = isAdmin || task.created_by === meId;

  // A deadline is "overdue" only while the task is still open. Compared as
  // plain YYYY-MM-DD strings, both sides date-only, so no time-of-day math.
  // Istanbul rather than the device: two people looking at the same board must
  // agree on whether a task is late.
  const today = todayInIstanbul();
  const overdue =
    task.due_on != null && task.state !== "done" && task.due_on < today;
  // A deadline three months out is data, not a signal — it belongs in the
  // expanded row, not as a chip competing with the ones that need attention.
  // Overdue always shows; everything else shows once it's within the window.
  const dueSoon =
    task.due_on != null &&
    task.state !== "done" &&
    task.due_on >= today &&
    task.due_on <= addDays(today, DUE_SOON_DAYS);
  const showDue = overdue || dueSoon;
  // Show the suggestion only while nobody has claimed it — once claimed, the
  // assignee is the truth and the nudge is noise.
  const suggested =
    task.suggested_for && !task.assignee_id
      ? members[task.suggested_for]
      : null;

  const findingLines = findings
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  /**
   * File the audit's findings as real tasks. Deliberately does NOT mark the
   * audit done — finding things and deciding the sweep is over are two calls,
   * and an audit often files a batch, keeps looking, files more.
   */
  function fileFindings() {
    const lines = findingLines;
    if (lines.length === 0) return;
    // ⚠️ The toast repeats the SERVER's message rather than asserting
    // `lines.length` — the batch is capped, and a hardcoded count would claim
    // all 60 findings were filed when only 50 were. Report what happened.
    run(
      async () => {
        const res = await logAuditFindings(task.id, lines);
        if (!res.ok) return res;
        toastSuccess(res.message);
        return { ok: true, message: res.message };
      },
      {
        onSuccess: () => {
          setFindings("");
          setFiling(false);
        },
      }
    );
  }

  /**
   * Plain-text snapshot for pasting into a chat, a commit message, or Claude
   * Code. Any screenshots are downloaded alongside, and the text names the
   * files — a terminal can't take a pasted image or fetch a private URL, so a
   * local path is the only form it can act on.
   */
  function copyTask() {
    const text = taskToText(task, { members, projects, images });
    // Clipboard FIRST, still inside the click's gesture window — awaiting the
    // image fetches before this would get the write rejected in Safari.
    navigator.clipboard.writeText(text).then(
      async () => {
        if (images.length === 0) {
          toastSuccess("Task copied.");
          return;
        }
        const supabase = createClient();
        const saved = await downloadTaskImages(
          [task],
          { [task.id]: images },
          async (paths) => {
            const { data } = await supabase.storage
              .from("debug")
              .createSignedUrls(paths, 60 * 5);
            return (data ?? []).map((d) => d.signedUrl ?? null);
          }
        );
        toastSuccess(
          saved > 0
            ? `Copied — ${saved} image${saved === 1 ? "" : "s"} saved to Downloads.`
            : "Task copied, but the images couldn't be downloaded."
        );
      },
      () => toastError("Couldn't copy — clipboard blocked.")
    );
  }

  function saveEdit() {
    // ONE normalized object drives both the optimistic row and the server call.
    // Sending the raw draft while rendering a trimmed patch made the two
    // disagree: a whitespace-only title showed the old title optimistically and
    // was then rejected server-side ("A task needs a title").
    const fields = {
      title: draft.title.trim() || task.title,
      description: draft.description.trim(),
      priority: draft.priority,
      kind: draft.kind,
      due_on: draft.due_on || null,
      project_id: draft.project_id || null,
      suggested_for: draft.suggested_for || null,
    };
    const before = { ...task };
    run(() => updateTask(task.id, fields), {
      optimistic: () => {
        // The row mirrors what the server will actually store: an emptied
        // description becomes null there, so it must here too.
        onPatch(task.id, { ...fields, description: fields.description || null });
        setEditing(false);
      },
      rollback: () => onRestore(before),
      success: "Task updated.",
    });
  }

  /** Optimistic: apply the patch immediately, revert (and toast) if rejected. */
  function patchTask(
    fn: () => Promise<{ ok: boolean; message: string } | null>,
    patch?: Partial<DebugTask>
  ) {
    const before = { ...task };
    run(fn, {
      optimistic: patch ? () => onPatch(task.id, patch) : undefined,
      rollback: patch ? () => onRestore(before) : undefined,
    });
  }

  // Done rows recede via the title's own colour + strikethrough, NOT a blanket
  // opacity. `opacity-60` multiplied against text that is already `muted`/
  // `faint` pushed the meta line under 3:1 — the row read as disabled rather
  // than finished.
  return (
    <li
      ref={rowRef}
      // scroll-mb keeps a gap under the row when it scrolls itself into view,
      // so an opened panel never sits flush against the window edge.
      className={cn(
        "scroll-mb-6 px-4 py-3 transition-colors duration-150",
        highlight && "bg-primary/5",
        // The keyboard cursor. An inset ring rather than an outline so it can't
        // be clipped by the list's own overflow, and it reads as "this row is
        // focused" without competing with the state colours on the row itself.
        cursored && "bg-raised/60 ring-1 ring-inset ring-primary-dim/60"
      )}
    >
      {/* A grid, not a flex-wrap. Four columns that always mean the same thing:
          title (elastic) · badges · state · assignee. The old single wrapping
          row reflowed unpredictably below ~1100px — the state control would drop
          under the title and the badges would orphan. Here the collapse is
          declared instead: under `md` the row becomes two lines, badges moving
          to their own line beneath the title, and the state control narrows. */}
      <div
        className={cn(
          "grid items-center gap-x-3 gap-y-2",
          "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_auto_auto_auto]",
          selectable && "grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]"
        )}
      >
        {selectable && (
          <Checkbox
            checked={selected ?? false}
            onChange={() => onToggleSelect?.(task.id)}
            aria-label={`Select ${task.title}`}
          />
        )}
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex min-w-0 items-start gap-2 text-left"
          aria-expanded={expanded}
        >
          {/* Kind leads the row — see KindMark. */}
          <KindMark kind={task.kind} />
          <span className="min-w-0">
          {/* A long title used to `truncate` to ONE line, and the elastic column
              is narrow (badges, state and assignee take the rest), so most of
              the title was simply unreadable with no way to recover it. Two
              lines when collapsed — enough for any real title — and the full
              thing once the row is expanded. `title` gives the hover tooltip. */}
          <span
            title={task.title}
            className={cn(
              "block text-sm font-medium",
              expanded ? "break-words" : "line-clamp-2",
              task.state === "done"
                ? "text-muted line-through decoration-faint"
                : "text-ink"
            )}
          >
            {task.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-faint">
            {formatDate(task.created_at)}
            {task.created_by && members[task.created_by] && (
              <>
                {" · by "}
                <span style={{ color: members[task.created_by].color }}>
                  {members[task.created_by].name}
                </span>
              </>
            )}
            {suggested && (
              <>
                {" · suggested for "}
                <span style={{ color: suggested.color }}>{suggested.name}</span>
              </>
            )}
            {foundByTitle && (
              <>
                {" · found by "}
                <span className="text-muted">{foundByTitle}</span>
              </>
            )}
          </span>
          </span>
        </button>

        {/* Badges. Below `md` they take their own grid line under the title,
            spanning the full width, so they never squeeze the state control. */}
        <div className="col-span-full order-last flex flex-wrap items-center gap-1.5 md:order-0 md:col-span-1">
          {projectName && <Badge tone="info">{projectName}</Badge>}
          {showDue && (
            <Badge tone={overdue ? "danger" : "faint"}>
              {overdue ? "Overdue " : "Due "}
              {formatDate(task.due_on)}
            </Badge>
          )}
          {/* Priority stays a WORD. It's a four-step scale, and a scale that
              you have to decode from a colour is a scale nobody reads. */}
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
        </div>

        {/* One-click state switch */}
        <div
          className="flex overflow-hidden rounded-md border border-line"
          role="group"
          aria-label="State"
        >
          {(Object.keys(STATE_LABEL) as DebugState[]).map((state) => (
            <button
              key={state}
              type="button"
              disabled={task.state === state}
              onClick={() => patchTask(() => setTaskState(task.id, state), { state })}
              className={cn(
                "px-2 py-1 text-xs transition-colors duration-150",
                task.state === state
                  ? state === "done"
                    ? "bg-primary/15 text-primary-dim"
                    : state === "in_progress"
                      ? "bg-amber/15 text-amber"
                      : "bg-raised text-ink"
                  : "text-faint hover:bg-raised hover:text-muted"
              )}
            >
              {STATE_LABEL[state]}
            </button>
          ))}
        </div>

        {/* Assignee / claim. Fixed 10rem from `md` up so the column aligns down
            the list; fluid below that, where 160px is nearly half the screen. */}
        <div className="flex items-center justify-end gap-1.5 md:w-40">
          {pending && (
            <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />
          )}
          {task.assignee_id ? (
            <>
              <span
                style={{ color: members[task.assignee_id]?.color }}
                className="truncate text-[13px] font-medium"
              >
                {mine ? "You" : (members[task.assignee_id]?.name ?? "Someone")}
              </span>
              {(mine || isAdmin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Unclaim"
                  onClick={() =>
                    patchTask(() => unclaimTask(task.id), { assignee_id: null })
                  }
                >
                  <Undo2 className="size-3.5" aria-hidden />
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                patchTask(() => claimTask(task.id), { assignee_id: meId })
              }
            >
              <Hand className="size-3.5" aria-hidden />
              Claim
            </Button>
          )}
        </div>
      </div>

      {expanded && !editing && (
        <div className="mt-2 flex flex-col items-start justify-between gap-4 pl-0.5 sm:flex-row">
          <div className="min-w-0">
            <p className="max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
              {task.description || "No details."}
            </p>
            {/* Screenshots live with the details, not in the button cluster —
                they're part of what the task SAYS, not something you do to it. */}
            <TaskImages
              taskId={task.id}
              images={images}
              canEdit={!task.archived_at}
              onChange={onImagesChange}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* An audit's output IS a list of tasks — filing them is the way
                this kind of work gets finished. */}
            {task.kind === "audit" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiling((v) => !v)}
              >
                <ListPlus className="size-3.5" aria-hidden />
                {foundCount > 0 ? `Found ${foundCount}` : "Log findings"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={copyTask}>
              <Copy className="size-3.5" aria-hidden />
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft({
                  title: task.title,
                  description: task.description ?? "",
                  priority: task.priority,
                  kind: task.kind,
                  due_on: task.due_on ?? "",
                  project_id: task.project_id ?? "",
                  suggested_for: task.suggested_for ?? "",
                });
                setEditing(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
            {canDelete && (
              <ConfirmButton
                size="sm"
                confirmLabel="Really delete?"
                disabled={pending}
                onConfirm={() => {
                  const before = { ...task };
                  run(() => deleteTask(task.id), {
                    optimistic: () => onRemove(task.id),
                    rollback: () => onRestore(before),
                    success: "Task deleted.",
                  });
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </ConfirmButton>
            )}
          </div>
        </div>
      )}

      {/* Filing what an audit found: one line per finding, filed in one trip.
          Each becomes a normal task on this audit's board, linked back to it. */}
      {expanded && filing && (
        <div className="mt-2 space-y-2 rounded-md border border-line bg-raised/40 p-2.5">
          <Textarea
            autoFocus
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            rows={4}
            placeholder={"One finding per line…\nCheckout total wrong on discounts\nAvatar 404s on first load"}
            aria-label="What the audit found, one per line"
          />
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-faint">
              {findingLines.length > 0
                ? `${findingLines.length} task${findingLines.length === 1 ? "" : "s"} — they land on this board as fixes.`
                : "One per line."}
            </p>
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiling(false);
                  setFindings("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={findingLines.length === 0 || pending}
                onClick={fileFindings}
              >
                File {findingLines.length > 0 ? findingLines.length : ""}
              </Button>
            </div>
          </div>
        </div>
      )}

      {expanded && editing && (
        <div className="mt-2 space-y-2.5 pl-0.5">
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            maxLength={200}
            aria-label="Task title"
          />
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={3}
            placeholder="Details…"
            aria-label="Task description"
          />
          {/* Also in the editor, not just the read view: reaching for "add a
              screenshot" while you're already editing the task is the obvious
              move, and finding it only after cancelling out is a dead end
              (Parsa, 2026-07-19). Uploads are immediate — they don't wait for
              Save, because they're already stored against this task id. */}
          <TaskImages
            taskId={task.id}
            images={images}
            canEdit={!task.archived_at}
            onChange={onImagesChange}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              className="w-full sm:w-44"
              value={draft.project_id}
              options={[
                { value: "", label: "General" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(v) => setDraft((d) => ({ ...d, project_id: v }))}
            />
            <Dropdown
              className="w-full sm:w-32"
              value={draft.kind}
              options={KIND_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, kind: v as DebugKind }))}
            />
            <Dropdown
              className="w-full sm:w-32"
              value={draft.priority}
              options={PRIORITY_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, priority: v as DebugPriority }))}
            />
            <DatePicker
              key={task.id}
              name="due_on"
              className="w-40"
              defaultValue={task.due_on ?? ""}
              placeholder="No deadline"
              onChange={(iso) => setDraft((d) => ({ ...d, due_on: iso }))}
            />
            {suggestOptions.length > 0 && (
              <Dropdown
                className="w-full sm:w-44"
                value={draft.suggested_for}
                placeholder="No suggestion"
                options={[
                  { value: "", label: "No suggestion" },
                  ...suggestOptions,
                ]}
                onChange={(v) => setDraft((d) => ({ ...d, suggested_for: v }))}
              />
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={saveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
