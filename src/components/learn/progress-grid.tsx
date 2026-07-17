"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SprintGoal } from "@/lib/types";

/**
 * The per-goal detail matrix: who did which goal. Presentational — the shared
 * done-set lives in SprintProgress so the race above moves with every tick.
 * The first column sticks so wide teams stay readable while scrolling.
 */
export function ProgressGrid({
  goals,
  participants,
  done,
  meId,
  iParticipate,
  pending,
  onToggle,
}: {
  goals: SprintGoal[];
  participants: { id: string; name: string; color: string }[];
  /** keys of the form `${goalId}:${userId}` */
  done: Set<string>;
  meId: string;
  iParticipate: boolean;
  pending: boolean;
  onToggle: (goalId: string, next: boolean) => void;
}) {
  function firstName(name: string) {
    return name.split(" ")[0];
  }

  const goalDone = (goalId: string) =>
    participants.filter((p) => done.has(`${goalId}:${p.id}`)).length;
  const personDone = (personId: string) =>
    goals.filter((g) => done.has(`${g.id}:${personId}`)).length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-xs font-medium text-faint">
              Goal
            </th>
            {participants.map((person) => (
              <th
                key={person.id}
                style={{ color: person.color }}
                className={cn(
                  "px-3 py-2.5 text-center text-xs font-medium",
                  person.id === meId && "bg-primary/[0.04]"
                )}
              >
                {person.id === meId ? "You" : firstName(person.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {goals.map((goal) => (
            <tr key={goal.id} className="group">
              <td className="sticky left-0 z-10 max-w-72 bg-surface px-4 py-2.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-ink">{goal.title}</span>
                  <span className="shrink-0 font-mono text-xs text-faint">
                    {goalDone(goal.id)}/{participants.length}
                  </span>
                </span>
              </td>
              {participants.map((person) => {
                const isDone = done.has(`${goal.id}:${person.id}`);
                const isMe = person.id === meId;
                return (
                  <td
                    key={person.id}
                    className={cn(
                      "px-3 py-2.5 text-center transition-colors duration-150 group-hover:bg-raised/40",
                      isMe && "bg-primary/[0.04]"
                    )}
                  >
                    {isMe && iParticipate ? (
                      <button
                        type="button"
                        aria-pressed={isDone}
                        aria-label={`${goal.title}: mark ${isDone ? "not done" : "done"}`}
                        onClick={() => onToggle(goal.id, !isDone)}
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
        {goals.length > 1 && (
          <tfoot>
            <tr className="border-t border-line">
              <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-xs font-medium text-faint">
                Total
              </td>
              {participants.map((person) => (
                <td
                  key={person.id}
                  className={cn(
                    "px-3 py-2.5 text-center font-mono text-xs text-muted",
                    person.id === meId && "bg-primary/[0.04]"
                  )}
                >
                  {personDone(person.id)}/{goals.length}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {(pending || !iParticipate) && (
        <div className="flex items-center gap-2 px-4 py-2">
          {pending && (
            <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />
          )}
          {!iParticipate && (
            <p className="text-xs text-faint">
              You&apos;re viewing — this sprint isn&apos;t assigned to you.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
