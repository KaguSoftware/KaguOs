"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toggleGoalProgress } from "@/lib/actions/learn";
import { cn } from "@/lib/utils";
import type { SprintGoal } from "@/lib/types";

export function ProgressGrid({
  sprintId,
  goals,
  participants,
  progress,
  meId,
}: {
  sprintId: string;
  goals: SprintGoal[];
  participants: { id: string; name: string; color: string }[];
  progress: { goal_id: string; user_id: string }[];
  meId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(
    () => new Set(progress.map((p) => `${p.goal_id}:${p.user_id}`))
  );
  const iParticipate = participants.some((p) => p.id === meId);

  // Adopted during render, not in an effect — see board.tsx. An effect would
  // commit the stale grid first, flashing a just-ticked cell back for a frame.
  const [seenProgress, setSeenProgress] = useState(progress);
  if (seenProgress !== progress) {
    setSeenProgress(progress);
    setDone(new Set(progress.map((p) => `${p.goal_id}:${p.user_id}`)));
  }

  function toggleCell(goalId: string, next: boolean) {
    const key = `${goalId}:${meId}`;
    setError(null);
    setDone((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
    startTransition(async () => {
      const result = await toggleGoalProgress(goalId, sprintId, next);
      if (result && !result.ok) {
        setDone((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(key);
          else copy.add(key);
          return copy;
        });
        setError(result.message);
      }
    });
  }

  function firstName(name: string) {
    return name.split(" ")[0];
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="px-4 py-2.5 text-xs font-medium text-faint">Goal</th>
            {participants.map((person) => (
              <th
                key={person.id}
                style={{ color: person.color }}
                className="px-3 py-2.5 text-center text-xs font-medium"
              >
                {person.id === meId ? "You" : firstName(person.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {goals.map((goal) => (
            <tr key={goal.id}>
              <td className="max-w-72 px-4 py-2.5 text-ink">{goal.title}</td>
              {participants.map((person) => {
                const isDone = done.has(`${goal.id}:${person.id}`);
                const isMe = person.id === meId;
                return (
                  <td key={person.id} className="px-3 py-2.5 text-center">
                    {isMe ? (
                      <button
                        type="button"
                        aria-pressed={isDone}
                        aria-label={`${goal.title}: mark ${isDone ? "not done" : "done"}`}
                        onClick={() => toggleCell(goal.id, !isDone)}
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-md border transition-colors duration-150",
                          isDone
                            ? "border-primary/40 bg-primary/15 text-primary-dim"
                            : "border-line-strong text-transparent hover:border-primary/40 hover:text-faint"
                        )}
                      >
                        <Check className="size-3.5" aria-hidden />
                      </button>
                    ) : (
                      <span
                        aria-label={isDone ? "done" : "not done"}
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-md",
                          isDone ? "text-primary-dim" : "text-line-strong"
                        )}
                      >
                        {isDone ? <Check className="size-3.5" aria-hidden /> : "·"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 px-4 py-2">
        {pending && <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />}
        {!iParticipate && (
          <p className="text-xs text-faint">
            You&apos;re viewing — this sprint isn&apos;t assigned to you.
          </p>
        )}
        {error && (
          <p role="status" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
