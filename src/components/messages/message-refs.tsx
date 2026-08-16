import { ImageIcon, SearchCheck, Sparkles, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebugKind, DebugState, MessageTaskRef } from "@/lib/types";

/**
 * The shared interiors of a message's reference cards — the quoted line a
 * reply points at, and the task a message shares. One file, because the same
 * card renders in TWO places and must read as the same object in both: pinned
 * above the composer while you write, and inside the bubble once sent.
 * The wrappers differ (the composer's has a cancel ×, the bubble's is a
 * button/link), so the wrapper stays with the caller.
 */

/** One line of the quoted original — what a reply card shows under the name. */
export function replySnippet(ref: { body: string; has_image: boolean }) {
  const firstLine = ref.body.split("\n").find((l) => l.trim())?.trim() ?? "";
  const cut =
    firstLine.length > 120 ? `${firstLine.slice(0, 120).trimEnd()}…` : firstLine;
  return cut || (ref.has_image ? "Photo" : "");
}

/**
 * Where a task card opens. There is no task detail route — the board is one
 * page — so this is the board searched down to the task, the same deep-link
 * shape `task-row`'s messageAuthor() has always used.
 */
export function taskSearchHref(task: { title: string }) {
  return `/debug?q=${encodeURIComponent(task.title.slice(0, 60))}`;
}

// Same icons the board's KindMark uses, so the card is recognisably "a task
// off the debug board" — but NOT the tinted chip: at quote-card size a second
// colour system inside a bubble is noise. Labels are lowercase to match
// `taskToText`'s "fix · high priority" line, the one other place a task is
// compressed to a sentence.
const KIND_ICON: Record<DebugKind, typeof Wrench> = {
  fix: Wrench,
  feature: Sparkles,
  audit: SearchCheck,
};
const STATE_TEXT: Record<DebugState, string> = {
  open: "open",
  in_progress: "in progress",
  done: "done",
};

/** The task card's interior: kind icon, title, one meta line. */
export function TaskRefBody({
  task,
  className,
}: {
  task: MessageTaskRef;
  className?: string;
}) {
  const Icon = KIND_ICON[task.kind] ?? Wrench;
  return (
    <span className={cn("flex min-w-0 items-start gap-2 text-left", className)}>
      <span
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-line-strong/40 text-muted"
        aria-hidden
      >
        <Icon className="size-3" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
          {task.title}
        </span>
        <span className="block truncate font-mono text-xs text-faint">
          {task.kind} · {task.priority} priority ·{" "}
          {STATE_TEXT[task.state] ?? task.state}
        </span>
      </span>
    </span>
  );
}

/** The reply card's interior: who said it, one line of what they said. */
export function ReplyRefBody({
  name,
  nameColor,
  snippet,
  hasImage,
}: {
  name: string;
  /** The sender's identity colour, same as the group-chat name labels. */
  nameColor?: string;
  snippet: string;
  hasImage: boolean;
}) {
  return (
    <span className="block min-w-0 border-l-2 border-primary-dim/70 pl-2 text-left">
      <span
        className="block truncate text-xs font-medium text-primary-dim"
        style={nameColor ? { color: nameColor } : undefined}
      >
        {name}
      </span>
      <span className="flex min-w-0 items-center gap-1 text-[calc(13px*var(--text-scale,1))] text-faint">
        {hasImage && <ImageIcon className="size-3 shrink-0" aria-hidden />}
        <span className="truncate">{snippet}</span>
      </span>
    </span>
  );
}
