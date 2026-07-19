"use client";

import { useState } from "react";
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
import { taskToText } from "@/lib/debug-export";
import { cn, formatDate } from "@/lib/utils";
import type {
  DebugKind,
  DebugPriority,
  DebugState,
  DebugTask,
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
 * The kind marker. Every kind is NEUTRAL on purpose: colour on this board marks
 * state (green = done, amber = in progress, red = urgent), and a kind is not a
 * state — it never changes. A green "feature" pill would sit two inches from the
 * green "Done" button meaning something unrelated, and the row already carries
 * up to four coloured chips. Icon plus word separates the kinds without
 * spending a hue.
 */
function KindBadge({ kind }: { kind: DebugKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <Badge tone="neutral">
      <Icon className="size-3" aria-hidden />
      {KIND_LABEL[kind]}
    </Badge>
  );
}

const PRIORITY_TONE: Record<DebugPriority, BadgeTone> = {
  low: "faint",
  medium: "neutral",
  high: "amber",
  urgent: "danger",
};

const STATE_LABEL: Record<DebugState, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export function TaskRow({
  task,
  members,
  meId,
  isAdmin,
  projects,
  suggestOptions,
  projectName,
  foundCount,
  foundByTitle,
  highlight,
  selectable,
  selected,
  onToggleSelect,
  onPatch,
  onRemove,
  onRestore,
}: {
  task: DebugTask;
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
  const [expanded, setExpanded] = useState(false);
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

  // A deadline is "overdue" only while the task is still open. Compare on the
  // date string (YYYY-MM-DD) so it's timezone-agnostic — matches how due_on is
  // stored (a plain date, no time).
  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    task.due_on != null && task.state !== "done" && task.due_on < today;
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
    run(
      async () => {
        const res = await logAuditFindings(task.id, lines);
        return res.ok ? { ok: true, message: res.message } : res;
      },
      {
        success: `Filed ${lines.length} task${lines.length === 1 ? "" : "s"}.`,
        onSuccess: () => {
          setFindings("");
          setFiling(false);
        },
      }
    );
  }

  /** Plain-text snapshot for pasting into a chat or a commit message. */
  function copyTask() {
    navigator.clipboard.writeText(taskToText(task, { members, projects })).then(
      () => toastSuccess("Task copied."),
      () => toastError("Couldn't copy — clipboard blocked.")
    );
  }

  function saveEdit() {
    const patch = {
      title: draft.title.trim() || task.title,
      description: draft.description.trim() || null,
      priority: draft.priority,
      kind: draft.kind,
      due_on: draft.due_on || null,
      project_id: draft.project_id || null,
      suggested_for: draft.suggested_for || null,
    };
    const before = { ...task };
    run(() => updateTask(task.id, draft), {
      optimistic: () => {
        onPatch(task.id, patch);
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

  return (
    <li
      className={cn(
        "px-4 py-3 transition-colors duration-150",
        task.state === "done" && "opacity-60",
        highlight && "bg-primary/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {selectable && (
          <Checkbox
            checked={selected ?? false}
            onChange={() => onToggleSelect?.(task.id)}
            aria-label={`Select ${task.title}`}
          />
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <span
            className={cn(
              "text-sm font-medium text-ink",
              task.state === "done" && "line-through decoration-faint"
            )}
          >
            {task.title}
          </span>
          <span className="mt-0.5 block text-xs text-faint">
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
        </button>

        {projectName && <Badge tone="info">{projectName}</Badge>}
        <KindBadge kind={task.kind} />
        {task.due_on && (
          <Badge tone={overdue ? "danger" : "faint"}>
            {overdue ? "Overdue " : "Due "}
            {formatDate(task.due_on)}
          </Badge>
        )}
        <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>

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

        {/* Assignee / claim */}
        <div className="flex w-40 items-center justify-end gap-1.5">
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
        <div className="mt-2 flex items-start justify-between gap-4 pl-0.5">
          <p className="max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
            {task.description || "No details."}
          </p>
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
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              className="w-44"
              value={draft.project_id}
              options={[
                { value: "", label: "General" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(v) => setDraft((d) => ({ ...d, project_id: v }))}
            />
            <Dropdown
              className="w-32"
              value={draft.kind}
              options={KIND_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, kind: v as DebugKind }))}
            />
            <Dropdown
              className="w-32"
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
                className="w-44"
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
