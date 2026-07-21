"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ListPlus, X } from "lucide-react";
import { notifyDebugBatch, quickAddTasks, updateTask } from "@/lib/actions/debug";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { TaskImages } from "@/components/debug/task-images";
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
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Screenshots per task id. Kept OUTSIDE `draft` because images are saved the
  // moment they're picked (TaskImages uploads and records them itself), while
  // the draft is only committed on "Save & next" — folding them together would
  // make Skip look like it discards attachments it has in fact already stored.
  const [images, setImages] = useState<Record<string, DebugTaskImage[]>>({});

  const projectOptions = [
    { value: "", label: "General", hint: "Not tied to a project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

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
          setTasks(res.tasks);
          setIdx(0);
          setDraft(draftFrom(res.tasks[0]));
          setPhase("details");
        } else {
          toastError(res.message || "Couldn't post the tasks.");
        }
      })
      .catch(() => toastError("Couldn't post the tasks — check the connection."))
      .finally(() => setPosting(false));
  }

  function finish(savedCount: number) {
    toastSuccess(
      `${tasks.length} task${tasks.length === 1 ? "" : "s"} posted${
        savedCount > 0 ? `, ${savedCount} detailed` : ""
      }.`
    );
    router.push("/debug");
  }

  // How many tasks got a real details save (for the finish toast).
  const [savedCount, setSavedCount] = useState(0);

  function advance(nextSaved: number) {
    if (idx + 1 >= tasks.length) {
      finish(nextSaved);
      return;
    }
    setIdx(idx + 1);
    setDraft(draftFrom(tasks[idx + 1]));
  }

  function goBack() {
    if (idx === 0) return;
    setIdx(idx - 1);
    setDraft(draftFrom(tasks[idx - 1]));
  }

  function saveAndNext() {
    const task = tasks[idx];
    if (!task || !draft) return;
    const fields = {
      title: draft.title.trim() || task.title,
      description: draft.description,
      priority: draft.priority,
      due_on: draft.due_on || null,
      project_id: draft.project_id || null,
      suggested_for: draft.suggested_for || null,
    };
    const nextSaved = savedCount + 1;
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
        setSavedCount(nextSaved);
        advance(nextSaved);
      },
    });
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
            <span className="font-mono text-xs text-muted">
              {titles.length} task{titles.length === 1 ? "" : "s"}
            </span>
          )}
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- details
  const task = tasks[idx];
  if (!task || !draft) return null;
  const last = idx === tasks.length - 1;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Add details</h1>
          <p className="mt-1 text-sm text-muted">
            All {tasks.length} are posted already — this pass just fills them in.
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm text-muted">
          {idx + 1} / {tasks.length}
        </span>
      </header>

      {/* Thin progress bar — how far through the pass you are. */}
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-raised" aria-hidden>
        <div
          className="h-full rounded-full bg-primary/60 transition-[width] duration-200 ease-mac"
          style={{ width: `${((idx + 1) / tasks.length) * 100}%` }}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-line bg-surface p-4">
        <Field label="Title" htmlFor="bs-title">
          <Input
            id="bs-title"
            value={draft.title}
            maxLength={200}
            onChange={(e) => setDraft((d) => d && { ...d, title: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Board" htmlFor="bs-project">
            <Dropdown
              id="bs-project"
              value={draft.project_id}
              options={projectOptions}
              onChange={(v) => setDraft((d) => d && { ...d, project_id: v })}
            />
          </Field>
          <Field label="Priority" htmlFor="bs-priority">
            <Dropdown
              id="bs-priority"
              value={draft.priority}
              options={PRIORITY_OPTIONS}
              onChange={(v) =>
                setDraft((d) => d && { ...d, priority: v as DebugPriority })
              }
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline" htmlFor="bs-due" hint="Optional.">
            <DatePicker
              key={task.id}
              id="bs-due"
              name="due_on"
              defaultValue={draft.due_on}
              placeholder="No deadline"
              onChange={(iso) => setDraft((d) => d && { ...d, due_on: iso })}
            />
          </Field>
          {suggestOptions.length > 0 && (
            <Field
              label="Suggest for"
              htmlFor="bs-suggested"
              hint="A nudge, not a claim."
            >
              <Dropdown
                id="bs-suggested"
                value={draft.suggested_for}
                placeholder="No suggestion"
                options={[{ value: "", label: "No suggestion" }, ...suggestOptions]}
                onChange={(v) => setDraft((d) => d && { ...d, suggested_for: v })}
              />
            </Field>
          )}
        </div>
        <Field
          label="Details"
          htmlFor="bs-description"
          hint="Steps, links, context — whatever helps whoever claims it."
        >
          <Textarea
            id="bs-description"
            rows={4}
            value={draft.description}
            onChange={(e) =>
              setDraft((d) => d && { ...d, description: e.target.value })
            }
          />
        </Field>
        {/* Screenshots. The task already exists by this phase (capture posted
            every title), so this needs none of the create form's staged-upload
            machinery — it's the same TaskImages the expanded row uses, saving
            straight to the task. */}
        <Field label="Screenshots" hint="A picture beats a paragraph for a bug.">
          <TaskImages
            taskId={task.id}
            images={images[task.id] ?? []}
            canEdit
            onChange={(next) =>
              setImages((prev) => ({ ...prev, [task.id]: next }))
            }
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={idx === 0 || pending}
          onClick={goBack}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => finish(savedCount)}
            className={cn(last && "hidden")}
          >
            Leave the rest as-is
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => advance(savedCount)}
          >
            Skip
          </Button>
          <Button variant="primary" disabled={pending} onClick={saveAndNext}>
            {last ? (
              <>
                <Check className="size-4" aria-hidden />
                Save & finish
              </>
            ) : (
              <>
                Save & next
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
