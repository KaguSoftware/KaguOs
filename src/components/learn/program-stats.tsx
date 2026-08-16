import { hoursLabel, type ProgramStats } from "@/lib/learn";

/**
 * The four numbers a program leads with. Every one is counted from the stages
 * and dates that already exist, so the headline cannot drift from the run.
 *
 * A hairline grid rather than four cards: this is a fact strip, and boxing each
 * number would give it more weight than the run it describes.
 */
export function ProgramStatsRow({ stats }: { stats: ProgramStats }) {
  const hours = hoursLabel(stats);
  const cells: { value: string; label: string }[] = [];

  if (stats.days % 7 === 0 && stats.days >= 7) {
    const weeks = stats.days / 7;
    cells.push({ value: String(weeks), label: weeks === 1 ? "week" : "weeks" });
  } else {
    cells.push({ value: String(stats.days), label: stats.days === 1 ? "day" : "days" });
  }
  if (hours) cells.push({ value: hours, label: "hours of practice" });
  if (stats.stages > 0) {
    cells.push({
      value: String(stats.stages),
      label: stats.stages === 1 ? "stage" : "stages",
    });
  }
  if (stats.capstones > 0) {
    cells.push({
      value: String(stats.capstones),
      label: stats.capstones === 1 ? "capstone" : "capstones",
    });
  }
  if (cells.length < 2) return null;

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-surface px-4 py-3">
          <dd className="font-mono text-lg leading-none tabular-nums text-ink">
            {cell.value}
          </dd>
          <dt className="mt-1.5 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
            {cell.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
