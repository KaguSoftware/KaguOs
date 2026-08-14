"use client";

import { BookOpen, Check, FileText, Link2, Play } from "lucide-react";
import { SignedFileLink } from "@/components/ui/signed-file-link";
import { cn } from "@/lib/utils";
import type { SprintResource } from "@/lib/types";

/**
 * One thing to watch or read, on one line.
 *
 * The syllabus decks put a coloured VIDEO / READ pill in front of every link.
 * Here the mark IS the badge: a play triangle means watch it, an open book
 * means read it. One glyph instead of a pill plus a glyph, which is what makes
 * nineteen of these in a column scan instead of shout.
 *
 * Two targets, deliberately separate: the tick records that you did it, the
 * title opens it. Merging them would mark things watched that you only clicked.
 */
export function ResourceRow({
  resource,
  watched,
  readOnly,
  onToggle,
  index,
}: {
  resource: SprintResource;
  watched: boolean;
  /** Not a participant, or view-only: the row reads, it doesn't record. */
  readOnly: boolean;
  onToggle: (resourceId: string, next: boolean) => void;
  /** 1-based position, shown only inside a goal's numbered run of techniques. */
  index?: number;
}) {
  const Icon =
    resource.kind === "video"
      ? Play
      : resource.kind === "read"
        ? BookOpen
        : resource.url
          ? Link2
          : FileText;

  const title = (
    <span
      className={cn(
        "min-w-0 flex-1 truncate text-[13px] transition-colors duration-150",
        watched ? "text-muted" : "text-ink"
      )}
    >
      {resource.title}
    </span>
  );

  const meta = (
    <>
      {resource.source && (
        <span className="hidden shrink-0 truncate text-xs text-faint sm:block sm:max-w-[14rem]">
          {resource.source}
        </span>
      )}
      <Icon
        aria-hidden
        className={cn(
          "size-3.5 shrink-0 transition-colors duration-150",
          resource.kind === "video" ? "text-primary-dim" : "text-faint"
        )}
        {...(resource.kind === "video" ? { fill: "currentColor" } : {})}
      />
    </>
  );

  // py-3 on a phone, dense from sm up — same reasoning as the goal row: watching
  // a resource is a tap you make over and over, on a row of 13px text.
  const linkClass =
    "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-3 transition-colors duration-150 hover:bg-raised/60 sm:py-1.5";

  return (
    // min-w-0: these rows are grid items (ul.grid), and a grid item's automatic
    // minimum is its content — without this the truncating title can't shrink
    // and the row pushes the whole page wider than the phone.
    <li className="flex min-w-0 items-center gap-1">
      {readOnly ? (
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center sm:size-9",
            !watched && "opacity-0"
          )}
        >
          <Mark watched={watched} />
        </span>
      ) : (
        <button
          type="button"
          aria-pressed={watched}
          aria-label={`${resource.title}: ${
            watched ? "done — click to unmark" : "mark as done"
          }`}
          onClick={() => onToggle(resource.id, !watched)}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 hover:bg-raised/60 sm:size-9"
        >
          <Mark watched={watched} />
        </button>
      )}

      {index !== undefined && (
        <span
          aria-hidden
          className={cn(
            "w-5 shrink-0 text-right font-mono text-[11px] tabular-nums transition-colors duration-150",
            watched ? "text-primary-dim" : "text-faint"
          )}
        >
          {String(index).padStart(2, "0")}
        </span>
      )}

      {resource.url ? (
        <a href={resource.url} target="_blank" rel="noreferrer" className={linkClass}>
          {title}
          {meta}
        </a>
      ) : resource.file_path ? (
        <SignedFileLink
          bucket="learn"
          path={resource.file_path}
          title={resource.title}
          className={cn(linkClass, "text-left")}
        >
          {title}
          {meta}
        </SignedFileLink>
      ) : (
        <span className={cn(linkClass, "text-faint")}>
          {title}
          {meta}
        </span>
      )}
    </li>
  );
}

function Mark({ watched }: { watched: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[18px] items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
        watched ? "bg-primary text-primary-ink" : "border border-line-strong bg-surface"
      )}
    >
      {watched && <Check className="size-2.5" />}
    </span>
  );
}
