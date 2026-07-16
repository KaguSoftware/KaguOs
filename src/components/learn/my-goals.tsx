"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toggleGoalProgress } from "@/lib/actions/learn";
import { cn } from "@/lib/utils";
import type { SprintGoal } from "@/lib/types";

/** The participant's own checklist — optimistic: ticks land instantly. */
export function MyGoals({
  sprintId,
  goals,
  doneGoalIds,
}: {
  sprintId: string;
  goals: SprintGoal[];
  doneGoalIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => new Set(doneGoalIds));

  useEffect(() => setDone(new Set(doneGoalIds)), [doneGoalIds]);

  return (
    <div>
      <ul className="divide-y divide-line">
        {goals.map((goal) => {
          const isDone = done.has(goal.id);
          return (
            <li key={goal.id}>
              <button
                type="button"
                aria-pressed={isDone}
                onClick={() => {
                  setError(null);
                  const next = !isDone;
                  setDone((prev) => {
                    const copy = new Set(prev);
                    if (next) copy.add(goal.id);
                    else copy.delete(goal.id);
                    return copy;
                  });
                  startTransition(async () => {
                    const result = await toggleGoalProgress(goal.id, sprintId, next);
                    if (result && !result.ok) {
                      setDone((prev) => {
                        const copy = new Set(prev);
                        if (next) copy.delete(goal.id);
                        else copy.add(goal.id);
                        return copy;
                      });
                      setError(result.message);
                    }
                  });
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-raised/60",
                  "disabled:pointer-events-none"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
                    isDone
                      ? "border-primary/40 bg-primary text-primary-ink"
                      : "border-line-strong text-transparent"
                  )}
                >
                  <Check className="size-3.5" />
                </span>
                <span
                  className={cn(
                    "text-sm",
                    isDone ? "text-muted line-through decoration-faint" : "text-ink"
                  )}
                >
                  {goal.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 px-4 py-2">
        {pending && <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />}
        {error && (
          <p role="status" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
