import { formatDate } from "@/lib/utils";
import type { DebugTask, DebugTaskImage, MembersMap } from "@/lib/types";

/**
 * A short, filesystem-safe stem for a task's downloaded screenshots.
 *
 * Computed ONCE and used for both the download filename and the path written
 * into the copied text. If those two ever disagree, the paste hands Claude Code
 * a path that doesn't exist — worse than shipping no path at all.
 */
export function imageStem(task: DebugTask) {
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `kagu-${slug || "task"}-${task.id.slice(0, 8)}`;
}

/** `<stem>-1.png` — 1-based, matching how the text numbers them. */
export function imageFilename(
  task: DebugTask,
  image: DebugTaskImage,
  index: number
) {
  const ext = image.file_path.split(".").pop()?.toLowerCase() || "png";
  return `${imageStem(task)}-${index + 1}.${ext}`;
}

/**
 * Save a blob to the user's downloads. Same anchor dance used by the board's
 * text export and the finance CSV export — one copy, three callers.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
    images = [],
  }: {
    members: MembersMap;
    projects: { id: string; name: string }[];
    /** Attached screenshots, listed by the local path they're downloaded to. */
    images?: DebugTaskImage[];
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
    task.kind,
    `${task.priority} priority`,
    task.due_on ? `due ${formatDate(task.due_on)}` : null,
    author ? `by ${author}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // The whole point of this block is pasting into Claude Code, which runs in a
  // terminal: it can't take a pasted image, and it can't fetch a private
  // Supabase URL. A LOCAL PATH is the only thing it can act on — so Copy
  // downloads the files and names them here.
  //
  // "~/Downloads/" is an honest guess, not a fact: the browser is never told
  // where downloads land. The "(downloaded to your Downloads folder)" wording
  // says that plainly instead of asserting a path that might be wrong.
  const imageBlock =
    images.length > 0
      ? `\n\nImages (downloaded to your Downloads folder):\n${images
          .map((img, i) => `${imageFilename(task, img, i)}`)
          .join("\n")}`
      : "";

  return `${task.title}\n${meta}${
    task.description ? `\n\n${task.description}` : ""
  }${imageBlock}`;
}

/** Join several tasks into one text blob, separated by a rule. */
export function tasksToText(
  tasks: DebugTask[],
  ctx: {
    members: MembersMap;
    projects: { id: string; name: string }[];
    imagesByTask?: Record<string, DebugTaskImage[]>;
  }
) {
  return tasks
    .map((t) => taskToText(t, { ...ctx, images: ctx.imagesByTask?.[t.id] ?? [] }))
    .join("\n\n———\n\n");
}

/**
 * Download a task's screenshots and put its text — including their filenames —
 * on the clipboard, so one paste into Claude Code carries the whole bug report.
 *
 * Callers must write the clipboard BEFORE awaiting this: `writeText` has to
 * stay close to the user gesture that triggered it, and an await on a network
 * fetch in between is enough for Safari to reject it as untrusted.
 *
 * Returns how many images actually landed, so the caller can tell the truth in
 * its toast rather than promising files that failed to fetch.
 */
export async function downloadTaskImages(
  tasks: DebugTask[],
  imagesByTask: Record<string, DebugTaskImage[]>,
  signUrls: (paths: string[]) => Promise<(string | null)[]>
): Promise<number> {
  const jobs: { task: DebugTask; image: DebugTaskImage; index: number }[] = [];
  for (const task of tasks) {
    (imagesByTask[task.id] ?? []).forEach((image, index) => {
      jobs.push({ task, image, index });
    });
  }
  if (jobs.length === 0) return 0;

  const urls = await signUrls(jobs.map((j) => j.image.file_path));

  let saved = 0;
  // Sequential on purpose: browsers throttle (and Chrome prompts once for)
  // multi-file downloads, and firing six fetches at a private bucket in
  // parallel is no faster than doing them in order for files this size.
  for (const [i, job] of jobs.entries()) {
    const url = urls[i];
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      downloadBlob(await res.blob(), imageFilename(job.task, job.image, job.index));
      saved += 1;
    } catch {
      // One unreachable image must not abort the rest, and must not stop the
      // text from reaching the clipboard.
    }
  }
  return saved;
}
