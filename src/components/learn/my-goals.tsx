"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toggleGoalProgress } from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
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
  const { pending, run } = useAction();
  const [done, setDone] = useState(() => new Set(doneGoalIds));

  useEffect(() => setDone(new Set(doneGoalIds)), [doneGoalIds]);

  function toggle(goalId: string, next: boolean) {
    const flip = (add: boolean) =>
      setDone((prev) => {
        const copy = new Set(prev);
        if (add) copy.add(goalId);
        else copy.delete(goalId);
        return copy;
      });
    run(() => toggleGoalProgress(goalId, sprintId, next), {
      optimistic: () => flip(next),
      rollback: () => flip(!next),
    });
  }

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
                onClick={() => toggle(goal.id, !isDone)}
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
      {pending && (
        <div className="flex items-center gap-2 px-4 py-2">
          <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />
        </div>
      )}
    </div>
  );
}
