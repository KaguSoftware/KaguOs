"use client";

import { useState } from "react";
import { Copy, Hand, Loader2, Pencil, Trash2, Undo2 } from "lucide-react";
import {
  claimTask,
  deleteTask,
  setTaskState,
  unclaimTask,
  updateTask,
} from "@/lib/actions/debug";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import type { DebugPriority, DebugState, DebugTask, MembersMap } from "@/lib/types";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

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
  highlight,
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
  /** Part of the brainstorm session trail — tinted until the trail is cleared. */
  highlight?: boolean;
  onPatch: (id: string, patch: Partial<DebugTask>) => void;
  onRemove: (id: string) => void;
  onRestore: (task: DebugTask) => void;
}) {
  const { pending, run } = useAction();
  const { success: toastSuccess, error: toastError } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description ?? "",
    priority: task.priority as DebugPriority,
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

  /** Plain-text snapshot for pasting into a chat or a commit message. */
  function copyTask() {
    const boardName = task.project_id
      ? (projects.find((p) => p.id === task.project_id)?.name ?? null)
      : null;
    const author =
      task.created_by && members[task.created_by]
        ? members[task.created_by].name
        : null;
    const meta = [
      boardName ?? "General",
      `${task.priority} priority`,
      task.due_on ? `due ${formatDate(task.due_on)}` : null,
      author ? `by ${author}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const text = `${task.title}\n${meta}${
      task.description ? `\n\n${task.description}` : ""
    }`;
    navigator.clipboard.writeText(text).then(
      () => toastSuccess("Task copied."),
      () => toastError("Couldn't copy — clipboard blocked.")
    );
  }

  function saveEdit() {
    const patch = {
      title: draft.title.trim() || task.title,
      description: draft.description.trim() || null,
      priority: draft.priority,
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
          </span>
        </button>

        {projectName && <Badge tone="info">{projectName}</Badge>}
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
