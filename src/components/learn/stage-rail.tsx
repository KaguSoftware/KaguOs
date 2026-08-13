import { cn } from "@/lib/utils";

/** One stop on the rail. `done` fills it; `current` rings it. */
export type RailStop = {
  id: string;
  title: string;
  done: boolean;
  current: boolean;
  capstone: boolean;
};

/**
 * A sprint's stages as a run of stops on a line: filled behind you, hollow
 * ahead. It's the progress bar, the table of contents, and the "which level am
 * I on" answer in one element — a bar says 60%, this says you cleared Landscape
 * and Access and Prompting is next.
 *
 * Server component: pure derivation from ticks that already exist. On the
 * sprint page the stops are anchor links to their stage block; on the catalogue
 * they're inert (the whole card is the link).
 */
export function StageRail({
  stops,
  href,
  className,
  size = "md",
}: {
  stops: RailStop[];
  /** When set, each stop links to `${href}#stage-${id}`. */
  href?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  if (stops.length === 0) return null;

  const doneCount = stops.filter((s) => s.done).length;
  const dot = size === "sm" ? "size-2" : "size-2.5";

  return (
    <ol
      className={cn("flex items-center", className)}
      aria-label={`Stages: ${doneCount} of ${stops.length} cleared`}
    >
      {stops.map((stop, index) => {
        // The segment behind a stop is lit when the stop before it is done —
        // the line fills as you advance, so the rail reads left-to-right.
        const litBefore = index > 0 && stops[index - 1].done;

        const mark = (
          <span
            aria-hidden
            className={cn(
              "block shrink-0 rotate-45 transition-colors duration-200 ease-mac motion-reduce:transition-none",
              dot,
              // The capstone is a diamond (rotated square); every other stage is
              // a circle. Shape carries the difference, not colour alone.
              stop.capstone ? "rounded-[2px]" : "rounded-full",
              stop.done
                ? "bg-primary"
                : stop.current
                  ? "bg-surface ring-2 ring-inset ring-primary/70"
                  : "bg-raised ring-1 ring-inset ring-line-strong"
            )}
          />
        );

        return (
          <li key={stop.id} className={cn("flex items-center", index > 0 && "flex-1")}>
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-px min-w-3 flex-1 transition-colors duration-200 ease-mac motion-reduce:transition-none",
                  litBefore ? "bg-primary/60" : "bg-line"
                )}
              />
            )}
            {href ? (
              <a
                href={`${href}#stage-${stop.id}`}
                // 44px hit area around a 10px dot, without the dot moving.
                className="flex size-6 items-center justify-center rounded-full transition-colors duration-150 hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dim"
                title={stop.title}
              >
                <span className="sr-only">
                  {stop.title}
                  {stop.done ? " — cleared" : stop.current ? " — you're here" : ""}
                </span>
                {mark}
              </a>
            ) : (
              <span className="flex size-6 items-center justify-center" title={stop.title}>
                {mark}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
