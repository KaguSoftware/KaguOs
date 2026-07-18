import { formatDate } from "@/lib/utils";
import type { DebugTask, MembersMap } from "@/lib/types";

/**
 * Plain-text snapshot of a task for pasting into a chat or a commit message.
 * Shared by the row's "Copy" and the board's batch copy/download so a single
 * task and a batch of them read identically.
 */
export function taskToText(
  task: DebugTask,
  {
    members,
    projects,
  }: {
    members: MembersMap;
    projects: { id: string; name: string }[];
  }
) {
  const boardName = task.project_id
    ? (projects.find((p) => p.id === task.project_id)?.name ?? null)
    : null;
  const author =
    task.created_by && members[task.created_by]
      ? members[task.created_by].name
      : null;
  const meta = [
    boardName ?? "General",
    `${task.priority} priority`,
    task.due_on ? `due ${formatDate(task.due_on)}` : null,
    author ? `by ${author}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `${task.title}\n${meta}${
    task.description ? `\n\n${task.description}` : ""
  }`;
}

/** Join several tasks into one text blob, separated by a rule. */
export function tasksToText(
  tasks: DebugTask[],
  ctx: { members: MembersMap; projects: { id: string; name: string }[] }
) {
  return tasks.map((t) => taskToText(t, ctx)).join("\n\n———\n\n");
}
