"use client";

import { cn } from "@/lib/utils";

export type RacePerson = { id: string; name: string; color: string };

const LANE_H = 44; // px — fixed so rank swaps can animate with pure transforms

/**
 * Team progress as a race: identical lanes, one finish line, order = standing.
 * Every participant runs the same track (0 → all goals), so relative position
 * is legible at a glance. Quiet on purpose — no badges, no confetti; the only
 * reward for leading is being first on the list.
 */
export function RaceStandings({
  participants,
  goalCount,
  done,
  meId,
}: {
  participants: RacePerson[];
  goalCount: number;
  /** keys of the form `${goalId}:${userId}` */
  done: Set<string>;
  meId: string;
}) {
  const counts = new Map<string, number>();
  for (const person of participants) counts.set(person.id, 0);
  for (const key of done) {
    const userId = key.slice(key.indexOf(":") + 1);
    if (counts.has(userId)) counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  // Standing order: most done first, ties by name so the order is stable.
  const standing = [...participants].sort(
    (a, b) =>
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name)
  );
  const laneIndex = new Map(standing.map((p, i) => [p.id, i]));
  // Competition ranking: equal counts share a rank (1, 1, 3, …).
  const rank = new Map<string, number>();
  standing.forEach((p, i) => {
    const count = counts.get(p.id) ?? 0;
    const prev = standing[i - 1];
    rank.set(
      p.id,
      i > 0 && prev && (counts.get(prev.id) ?? 0) === count
        ? (rank.get(prev.id) ?? i + 1)
        : i + 1
    );
  });

  function firstName(name: string) {
    return name.split(" ")[0];
  }

  return (
    <div
      className="relative mx-4 my-3"
      style={{ height: participants.length * LANE_H }}
    >
      {participants.map((person) => {
        const count = counts.get(person.id) ?? 0;
        const pct = goalCount > 0 ? (count / goalCount) * 100 : 0;
        const isMe = person.id === meId;
        return (
          <div
            key={person.id}
            style={{
              height: LANE_H,
              transform: `translateY(${(laneIndex.get(person.id) ?? 0) * LANE_H}px)`,
            }}
            className={cn(
              "absolute inset-x-0 top-0 flex items-center gap-3 rounded-md px-2",
              "transition-transform duration-200 ease-mac motion-reduce:transition-none",
              isMe && "bg-raised/40"
            )}
          >
            <span className="w-4 shrink-0 text-right font-mono text-xs text-faint">
              {rank.get(person.id)}
            </span>
            <span
              style={{ color: person.color }}
              className="w-16 shrink-0 truncate text-[13px] font-medium sm:w-24"
              title={person.name}
            >
              {isMe ? "You" : firstName(person.name)}
            </span>
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={goalCount}
              aria-valuenow={count}
              aria-label={`${person.name}: ${count} of ${goalCount} goals done`}
              className="relative h-1.5 min-w-0 flex-1 rounded-full bg-raised"
            >
              {/* The finish line — same spot for everyone. */}
              <span
                aria-hidden
                className="absolute inset-y-[-3px] right-0 w-px bg-line-strong"
              />
              <span
                style={{ width: `${pct}%`, backgroundColor: person.color }}
                className="block h-full rounded-full transition-[width] duration-200 ease-mac motion-reduce:transition-none"
              />
            </span>
            <span className="w-9 shrink-0 text-right font-mono text-xs text-muted">
              {count}/{goalCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
