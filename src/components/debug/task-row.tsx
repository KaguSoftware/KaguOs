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
import type { DebugPriority, DebugState, DebugTask } from "@/lib/types";

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
  names,
  meId,
  isAdmin,
}: {
  task: DebugTask;
  names: Record<string, string>;
  meId: string;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const mine = task.assignee_id === meId;
  const canDelete = isAdmin || task.created_by === meId;

  function run(fn: () => Promise<{ ok: boolean; message: string } | null>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) setError(result.message);
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
            {task.created_by && names[task.created_by]
              ? ` · by ${names[task.created_by]}`
              : ""}
          </span>
        </button>

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
              disabled={pending || task.state === state}
              onClick={() => run(() => setTaskState(task.id, state))}
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
                className={cn(
                  "truncate text-[13px]",
                  mine ? "text-primary-dim" : "text-muted"
                )}
              >
                {mine ? "You" : (names[task.assignee_id] ?? "Someone")}
              </span>
              {(mine || isAdmin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Unclaim"
                  disabled={pending}
                  onClick={() => run(() => unclaimTask(task.id))}
                >
                  <Undo2 className="size-3.5" aria-hidden />
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => claimTask(task.id))}
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
              onConfirm={() => run(() => deleteTask(task.id))}
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
