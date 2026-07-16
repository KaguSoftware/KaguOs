"use client";

import { useState, useTransition } from "react";
import { Hand, Loader2, Trash2, Undo2 } from "lucide-react";
import {
  claimTask,
  deleteTask,
  setTaskState,
  unclaimTask,
} from "@/lib/actions/debug";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { DebugPriority, DebugState, DebugTask, MembersMap } from "@/lib/types";

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
  projectName,
  onPatch,
  onRemove,
  onRestore,
}: {
  task: DebugTask;
  members: MembersMap;
  meId: string;
  isAdmin: boolean;
  projectName?: string | null;
  onPatch: (id: string, patch: Partial<DebugTask>) => void;
  onRemove: (id: string) => void;
  onRestore: (task: DebugTask) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const mine = task.assignee_id === meId;
  const canDelete = isAdmin || task.created_by === meId;

  /** Optimistic: apply the patch immediately, revert if the server says no. */
  function run(
    fn: () => Promise<{ ok: boolean; message: string } | null>,
    patch?: Partial<DebugTask>
  ) {
    setError(null);
    const before = { ...task };
    if (patch) onPatch(task.id, patch);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) {
        if (patch) onRestore(before);
        setError(result.message);
      }
    });
  }

  return (
    <li
      className={cn(
        "px-4 py-3 transition-colors duration-150",
        task.state === "done" && "opacity-60"
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
          </span>
        </button>

        {projectName && <Badge tone="info">{projectName}</Badge>}
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
              onClick={() => run(() => setTaskState(task.id, state), { state })}
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
                    run(() => unclaimTask(task.id), { assignee_id: null })
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
                run(() => claimTask(task.id), { assignee_id: meId })
              }
            >
              <Hand className="size-3.5" aria-hidden />
              Claim
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 flex items-start justify-between gap-4 pl-0.5">
          <p className="max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
            {task.description || "No details."}
          </p>
          {canDelete && (
            <ConfirmButton
              size="sm"
              confirmLabel="Really delete?"
              disabled={pending}
              onConfirm={() => {
                const before = { ...task };
                onRemove(task.id);
                setError(null);
                run(async () => {
                  const result = await deleteTask(task.id);
                  if (result && !result.ok) onRestore(before);
                  return result;
                });
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </ConfirmButton>
          )}
        </div>
      )}

      {error && (
        <p role="status" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
