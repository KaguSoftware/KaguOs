"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ListPlus, X } from "lucide-react";
import { notifyDebugBatch, quickAddTasks, updateTask } from "@/lib/actions/debug";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { TaskImages } from "@/components/debug/task-images";
import { MAX_TASKS_PER_BATCH, overflowNote } from "@/lib/debug-limits";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { DebugPriority, DebugTask, DebugTaskImage } from "@/lib/types";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", hint: "Whenever someone gets to it" },
  { value: "medium", label: "Medium", hint: "Normal flow" },
  { value: "high", label: "High", hint: "Should be picked up soon" },
  { value: "urgent", label: "Urgent", hint: "Drop other things" },
];

type Draft = {
  title: string;
  description: string;
  priority: DebugPriority;
  due_on: string;
  project_id: string;
  suggested_for: string;
};

function draftFrom(task: DebugTask): Draft {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    due_on: task.due_on ?? "",
    project_id: task.project_id ?? "",
    suggested_for: task.suggested_for ?? "",
  };
}

/**
 * Brainstorm mode, two phases on one surface so the title list never has to
 * survive a route change:
 *
 * 1. CAPTURE — spam titles, Enter appends, nothing touches the database.
 * 2. DETAILS — "Done" posts every title in ONE trip (so the dump is durable
 *    the moment capture ends — bailing mid-details loses nothing) + fires the
 *    single collapsed notification, then steps task-by-task adding details
 *    via updateTask. Skipping leaves a task as-is; "Leave the rest as-is"
 *    ends the pass early. Finish lands on /debug with the session trail
 *    (sessionStorage) highlighting everything just made.
 */
export function Brainstorm({
  projects,
  suggestOptions,
}: {
  projects: { id: string; name: string }[];
  /** Work members an admin can "suggest for". Empty for non-admins. */
  suggestOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();
  const { pending, run } = useAction();

  const [phase, setPhase] = useState<"capture" | "details">("capture");

  // ---- capture state ----
  const [text, setText] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [project, setProject] = useState("");
  const [posting, setPosting] = useState(false);

  // ---- details state ----
  const [tasks, setTasks] = useState<DebugTask[]>([]);
  // Which row is expanded, or null for "all collapsed". ONE at a time: opening
  // another closes (and therefore saves) the current one, which keeps the page
  // short and makes "where am I" unambiguous.
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Screenshots per task id. Kept OUTSIDE `draft` because images are saved the
  // moment they're picked (TaskImages uploads and records them itself), while
  // the draft only commits when the row collapses — folding them together would
  // make an open row look like it discards attachments it has already stored.
  const [images, setImages] = useState<Record<string, DebugTaskImage[]>>({});

  const projectOptions = [
    { value: "", label: "General", hint: "Not tied to a project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  /** id → name, so a collapsed row can name its board without a lookup loop. */
  const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  /** More titles than one batch accepts — the overflow won't post. */
  const overBatchCap = titles.length > MAX_TASKS_PER_BATCH;

  function addLines(raw: string[]) {
    const clean = raw.map((l) => l.trim().slice(0, 200)).filter(Boolean);
    if (clean.length > 0) setTitles((prev) => [...prev, ...clean]);
  }

  /** Post the whole dump in one trip, then move to the details pass. */
  function finishCapture() {
    const clean = titles.map((t) => t.trim()).filter(Boolean);
    if (clean.length === 0 || posting) return;
    setPosting(true);
    quickAddTasks(clean, project || null)
      .then((res) => {
        if (res.ok && res.tasks && res.tasks.length > 0) {
          // The dump is now durable — remember it for the board's trail
          // immediately, not at Finish, so even a mid-details bail keeps
          // the highlight.
          try {
            sessionStorage.setItem(
              "kagu-debug-brainstorm",
              JSON.stringify(res.tasks.map((t) => t.id))
            );
          } catch {}
          notifyDebugBatch(
            res.tasks.length,
            project ? (projects.find((p) => p.id === project)?.name ?? null) : null
          ).catch(() => {});
          // The server is the authority on what actually landed. If it capped
          // the batch, say so here too — the details pass is about to show
          // fewer tasks than were typed, and that must not look like a glitch.
          if (res.dropped) toastError(res.message);
          setTasks(res.tasks);
          // Nothing expanded at the start — the list is the view, and you open
          // only the rows that deserve attention.
          setOpenId(null);
          setDraft(null);
          setPhase("details");
        } else {
          toastError(res.message || "Couldn't post the tasks.");
        }
      })
      .catch(() => toastError("Couldn't post the tasks — check the connection."))
      .finally(() => setPosting(false));
  }

  function finish() {
    const saved = savedIds.size;
    toastSuccess(
      `${tasks.length} task${tasks.length === 1 ? "" : "s"} posted${
        saved > 0 ? `, ${saved} detailed` : ""
      }.`
    );
    router.push("/debug");
  }

  /**
   * WHICH tasks got a details save — a Set of ids, not a counter.
   *
   * ⚠️ It used to be `savedCount + 1` on every save, with no memory of which
   * task it was. Walking Back and re-saving the same task counted it twice, so
   * a 14-task session could finish claiming "14 posted, 17 detailed" — a number
   * that can't be true and is obviously wrong to the person who just did it.
   * A set makes re-saving idempotent, so the tally can never exceed the tasks.
   *
   * It now doubles as the per-row done mark: a tick is `savedIds.has(id)`.
   */
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  /**
   * Commit one row's draft, if it actually changed.
   *
   * ⚠️ The dirty check is load-bearing, not an optimisation. Rows save when they
   * COLLAPSE, and opening a row to read it collapses it again — without this,
   * merely scrolling through the list would fire an `updateTask` per row and
   * mark every one of them "detailed", which is precisely the kind of untrue
   * report the last two phases were spent removing.
   */
  function commit(task: DebugTask, next: Draft) {
    const fields = {
      title: next.title.trim() || task.title,
      description: next.description,
      priority: next.priority,
      due_on: next.due_on || null,
      project_id: next.project_id || null,
      suggested_for: next.suggested_for || null,
    };
    const before = draftFrom(task);
    const unchanged =
      fields.title === before.title.trim() &&
      fields.description === before.description &&
      fields.priority === before.priority &&
      (fields.due_on ?? "") === before.due_on &&
      (fields.project_id ?? "") === before.project_id &&
      (fields.suggested_for ?? "") === before.suggested_for;
    if (unchanged) return;

    run(() => updateTask(task.id, fields), {
      optimistic: () => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  title: fields.title,
                  description: fields.description || null,
                  priority: fields.priority,
                  due_on: fields.due_on,
                  project_id: fields.project_id,
                  suggested_for: fields.suggested_for,
                }
              : t
          )
        );
        setSavedIds((prev) => new Set(prev).add(task.id));
      },
    });
  }

  /**
   * Open a row — which first saves whichever row is currently open.
   *
   * Collapsing IS saving (no per-row Save button), so this one function covers
   * every way a row closes: opening another, toggling the same one shut, or
   * finishing the pass.
   */
  function openRow(id: string | null) {
    if (openId && draft) {
      const current = tasks.find((t) => t.id === openId);
      if (current) commit(current, draft);
    }
    setOpenId(id);
    setDraft(id ? draftFrom(tasks.find((t) => t.id === id)!) : null);
  }

  // ---------------------------------------------------------------- capture
  if (phase === "capture") {
    return (
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Brainstorm</h1>
            <p className="mt-1 text-sm text-muted">
              Spam titles — Enter adds a line, nothing posts until you hit Done.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <ListPlus
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-dim"
              aria-hidden
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLines([text]);
                  setText("");
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (pasted.includes("\n")) {
                  e.preventDefault();
                  addLines(pasted.split(/\r?\n/));
                }
              }}
              autoFocus
              placeholder="Type a task, hit Enter, keep going…"
              aria-label="New task title"
              data-no-ring
              className="h-11 w-full rounded-lg border border-line bg-raised pl-10 pr-3 text-[15px] text-ink placeholder:text-faint transition-colors duration-150 hover:border-line-strong focus-visible:border-primary/40"
            />
          </div>
          <Dropdown
            className="w-44"
            value={project}
            options={projectOptions}
            onChange={setProject}
          />
        </div>

        {titles.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface">
            {titles.map((t, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 shrink-0 text-right font-mono text-[11px] text-faint">
                  {i + 1}
                </span>
                <input
                  value={t}
                  onChange={(e) =>
                    setTitles((prev) =>
                      prev.map((v, j) => (j === i ? e.target.value : v))
                    )
                  }
                  aria-label={`Task ${i + 1} title`}
                  data-no-ring
                  className="h-7 min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTitles((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label={`Remove task ${i + 1}`}
                  className="rounded p-1 text-faint transition-colors duration-150 hover:bg-raised hover:text-danger"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[13px] text-faint">
            The list builds here as you type. Paste a multi-line list to add it all at once.
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="primary"
            disabled={titles.length === 0 || posting}
            onClick={finishCapture}
          >
            Done — add details
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          {titles.length > 0 && (
            <span
              className={cn(
                "font-mono text-xs",
                overBatchCap ? "text-amber" : "text-muted"
              )}
            >
              {titles.length} task{titles.length === 1 ? "" : "s"}
            </span>
          )}
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        {/* Warn BEFORE the trip, not after. The cap used to apply silently on
            the server, so the overflow simply vanished; saying it here means you
            can still split the batch while the titles are in front of you. */}
        {overBatchCap && (
          <p role="status" className="mt-3 text-[13px] text-amber">
            Only the first {MAX_TASKS_PER_BATCH} will post —{" "}
            {overflowNote(titles.length - MAX_TASKS_PER_BATCH)}
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- details
  //
  // A LIST, not a wizard. It used to be one task on screen with `N / M` and
  // Back / Skip / Save & next — so reaching item 7 of 14 cost six clicks
  // through tasks you didn't care about, and "which ones did I skip?" had no
  // answer at any point, including the end.
  //
  // Now it's the same shape as the capture list directly above it: scan the
  // rows, open the ones that deserve attention. Rows SAVE WHEN THEY COLLAPSE
  // (see `commit`), so there's no per-row Save button and nothing is lost by
  // navigating away.
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Add details</h1>
          <p className="mt-1 text-sm text-muted">
            All {tasks.length} are posted already — open the ones worth filling in.
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-muted">
          {savedIds.size} of {tasks.length} detailed
        </span>
      </header>

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {tasks.map((t, i) => (
          <DetailRow
            key={t.id}
            task={t}
            index={i}
            open={openId === t.id}
            done={savedIds.has(t.id)}
            draft={openId === t.id ? draft : null}
            onDraftChange={setDraft}
            onToggle={() => openRow(openId === t.id ? null : t.id)}
            projectOptions={projectOptions}
            suggestOptions={suggestOptions}
            projectNames={projectNames}
            images={images[t.id] ?? EMPTY_IMAGES}
            onImagesChange={(next) =>
              setImages((prev) => ({ ...prev, [t.id]: next }))
            }
          />
        ))}
      </ul>

      <div className="mt-5 flex items-center gap-3">
        <p className="text-[13px] text-faint">
          Anything you leave closed stays exactly as posted.
        </p>
        <Button
          variant="primary"
          disabled={pending}
          className="ml-auto"
          onClick={() => {
            // Collapsing IS saving, and finishing collapses everything — so
            // flush whatever is open before leaving.
            openRow(null);
            finish();
          }}
        >
          <Check className="size-4" aria-hidden />
          Done
        </Button>
      </div>
    </div>
  );
}

/** Stable empty array — a fresh `[]` each render would remount TaskImages. */
const EMPTY_IMAGES: DebugTaskImage[] = [];

/**
 * One task in the details list: a collapsed summary that expands into the
 * full editor.
 *
 * ⚠️ Field ids come from `useId()`, NOT hardcoded strings. The wizard could get
 * away with `id="bs-title"` because exactly one task was ever on screen; in a
 * list that yields duplicate DOM ids, and every `<label htmlFor>` would point at
 * the FIRST row's input — clicking a label would focus the wrong task's field.
 * Same reasoning as the `useId` in ui/dropdown.tsx.
 */
function DetailRow({
  task,
  index,
  open,
  done,
  draft,
  onDraftChange,
  onToggle,
  projectOptions,
  suggestOptions,
  projectNames,
  images,
  onImagesChange,
}: {
  task: DebugTask;
  index: number;
  open: boolean;
  /** Already saved in this pass — the mark a wizard structurally couldn't show. */
  done: boolean;
  /** The live draft while open; null when collapsed. */
  draft: Draft | null;
  onDraftChange: (next: Draft) => void;
  onToggle: () => void;
  projectOptions: { value: string; label: string; hint?: string }[];
  suggestOptions: { value: string; label: string }[];
  projectNames: Record<string, string>;
  images: DebugTaskImage[];
  onImagesChange: (next: DebugTaskImage[]) => void;
}) {
  const uid = useId();
  const set = (patch: Partial<Draft>) => {
    if (draft) onDraftChange({ ...draft, ...patch });
  };

  const boardLabel = task.project_id
    ? (projectNames[task.project_id] ?? "Project")
    : "General";

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-raised/60"
      >
        <span className="w-6 shrink-0 text-right font-mono text-[11px] text-faint">
          {index + 1}
        </span>
        <span className="w-4 shrink-0" aria-hidden>
          {done && <Check className="size-3.5 text-primary-dim" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{task.title}</span>
          <span className="mt-0.5 block truncate text-xs text-faint">
            {boardLabel} · {task.priority}
            {task.due_on ? ` · due ${task.due_on}` : ""}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && draft && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <Field label="Title" htmlFor={`${uid}-title`}>
            <Input
              id={`${uid}-title`}
              value={draft.title}
              maxLength={200}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Board" htmlFor={`${uid}-project`}>
              <Dropdown
                id={`${uid}-project`}
                value={draft.project_id}
                options={projectOptions}
                onChange={(v) => set({ project_id: v })}
              />
            </Field>
            <Field label="Priority" htmlFor={`${uid}-priority`}>
              <Dropdown
                id={`${uid}-priority`}
                value={draft.priority}
                options={PRIORITY_OPTIONS}
                onChange={(v) => set({ priority: v as DebugPriority })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deadline" htmlFor={`${uid}-due`} hint="Optional.">
              {/* `key` per task: DatePicker is uncontrolled with a defaultValue,
                  so without it a reopened row would show the previous date. */}
              <DatePicker
                key={task.id}
                id={`${uid}-due`}
                name="due_on"
                defaultValue={draft.due_on}
                placeholder="No deadline"
                onChange={(iso) => set({ due_on: iso })}
              />
            </Field>
            {suggestOptions.length > 0 && (
              <Field
                label="Suggest for"
                htmlFor={`${uid}-suggested`}
                hint="A nudge, not a claim."
              >
                <Dropdown
                  id={`${uid}-suggested`}
                  value={draft.suggested_for}
                  placeholder="No suggestion"
                  options={[{ value: "", label: "No suggestion" }, ...suggestOptions]}
                  onChange={(v) => set({ suggested_for: v })}
                />
              </Field>
            )}
          </div>
          <Field
            label="Details"
            htmlFor={`${uid}-description`}
            hint="Steps, links, context — whatever helps whoever claims it."
          >
            <Textarea
              id={`${uid}-description`}
              rows={4}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          {/* Screenshots. The task already exists by this phase (capture posted
              every title), so this needs none of the create form's staged-upload
              machinery — it's the same TaskImages the expanded row uses. Images
              live OUTSIDE the draft: they upload on pick, while the draft only
              commits on collapse. */}
          <Field label="Screenshots" hint="A picture beats a paragraph for a bug.">
            <TaskImages
              taskId={task.id}
              images={images}
              canEdit
              onChange={onImagesChange}
            />
          </Field>
        </div>
      )}
    </li>
  );
}
