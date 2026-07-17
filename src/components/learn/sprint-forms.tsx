"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { FileText, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import {
  addGoals,
  addResource,
  deleteSprint,
  removeGoal,
  removeResource,
  setParticipants,
  updateSprint,
} from "@/lib/actions/learn";
import type { ActionResult } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/client";
import { Button, ConfirmButton, SubmitButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { FileInput, UrlInput } from "@/components/ui/typed-inputs";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { Sprint, SprintGoal, SprintResource } from "@/lib/types";

function ResultNote({ result }: { result: ActionResult }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={cn("text-[13px]", result.ok ? "text-primary-dim" : "text-danger")}
    >
      {result.message}
    </p>
  );
}

export function EditSprintForm({ sprint }: { sprint: Sprint }) {
  const [result, action] = useActionState(updateSprint, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <input type="hidden" name="id" value={sprint.id} />
      <Field label="Title" htmlFor="sprint-title">
        <Input id="sprint-title" name="title" maxLength={120} defaultValue={sprint.title} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="sprint-starts">
          <DatePicker id="sprint-starts" name="starts_on" defaultValue={sprint.starts_on} />
        </Field>
        <Field label="Ends" htmlFor="sprint-ends">
          <DatePicker id="sprint-ends" name="ends_on" defaultValue={sprint.ends_on} />
        </Field>
      </div>
      <Field label="Description" htmlFor="sprint-description">
        <Textarea
          id="sprint-description"
          name="description"
          rows={3}
          defaultValue={sprint.description ?? ""}
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton size="sm">Save sprint</SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}

export function ParticipantsEditor({
  sprintId,
  people,
  current,
}: {
  sprintId: string;
  people: { id: string; name: string }[];
  current: string[];
}) {
  const { run } = useAction();
  // Optimistic: the checkbox flips instantly; the server reconciles after.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(current));

  // Adopted during render, not in an effect — see board.tsx. An effect would
  // commit the old selection first and flash the checkbox back for a frame.
  const [seenCurrent, setSeenCurrent] = useState(current);
  if (seenCurrent !== current) {
    setSeenCurrent(current);
    setSelected(new Set(current));
  }

  function toggle(userId: string) {
    const was = new Set(selected);
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelected(next);
    run(() => setParticipants(sprintId, [...next]), {
      rollback: () => setSelected(was),
    });
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {people.map((person) => (
          <Checkbox
            key={person.id}
            label={person.name}
            checked={selected.has(person.id)}
            onChange={() => toggle(person.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function GoalsEditor({
  sprintId,
  goals,
}: {
  sprintId: string;
  goals: SprintGoal[];
}) {
  const { pending, run } = useAction();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [list, setList] = useState<SprintGoal[]>(goals);

  const [seenGoals, setSeenGoals] = useState(goals);
  if (seenGoals !== goals) {
    setSeenGoals(goals);
    setList(goals);
  }

  const draftCount = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  function save() {
    const titles = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (titles.length === 0) return;
    run(() => addGoals(sprintId, titles, list.length), {
      success: titles.length === 1 ? "Goal added." : `${titles.length} goals added.`,
      onSuccess: () => {
        setText("");
        setAdding(false);
      },
    });
  }

  function remove(goal: SprintGoal) {
    setList((prev) => prev.filter((g) => g.id !== goal.id));
    run(() => removeGoal(goal.id, sprintId), {
      rollback: () =>
        setList((prev) =>
          [...prev, goal].sort((a, b) => a.sort_order - b.sort_order)
        ),
    });
  }

  return (
    <div className="space-y-3 p-4">
      <ul className="space-y-1.5">
        {list.map((goal) => (
          <li key={goal.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">{goal.title}</span>
            <button
              type="button"
              onClick={() => remove(goal)}
              title="Remove goal"
              aria-label={`Remove goal ${goal.title}`}
              className="text-faint hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="text-[13px] text-faint">
            No goals yet — the checklist everyone ticks lives here.
          </li>
        )}
      </ul>

      {adding ? (
        <div className="space-y-2 rounded-md border border-line bg-surface p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            autoFocus
            placeholder={"One goal per line:\nFinish chapters 1–3\nBuild the demo project\nWrite up notes"}
            onKeyDown={(e) => {
              // ⌘/Ctrl+Enter to save quickly.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-faint">
              {draftCount > 0
                ? `${draftCount} goal${draftCount === 1 ? "" : "s"} — one per line`
                : "One goal per line"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setText("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={pending || draftCount === 0}
                onClick={save}
              >
                Add {draftCount > 1 ? `${draftCount} goals` : "goal"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" aria-hidden />
          Add goals
        </Button>
      )}
    </div>
  );
}

export function ResourcesEditor({
  sprintId,
  resources,
}: {
  sprintId: string;
  resources: SprintResource[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  // Upload happens in the browser (straight to the private `learn` bucket,
  // admin-gated by storage RLS), then the row is saved via the server action.
  async function resourceAction(
    prev: ActionResult,
    formData: FormData
  ): Promise<ActionResult> {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${sprintId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("learn").upload(path, file);
      if (error) return { ok: false, message: `Upload failed: ${error.message}` };
      formData.set("file_path", path);
    }
    formData.delete("file");
    return addResource(prev, formData);
  }

  return (
    <div className="space-y-3 p-4">
      <ul className="space-y-1.5">
        {resources.map((resource) => (
          <li key={resource.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 text-muted">
              {resource.file_path ? (
                <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
              ) : (
                <Link2 className="size-3.5 shrink-0 text-faint" aria-hidden />
              )}
              <span className="truncate">{resource.title}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await removeResource(resource.id, sprintId);
                })
              }
              title="Remove resource"
              aria-label={`Remove resource ${resource.title}`}
              className="text-faint hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {resources.length === 0 && (
          <li className="text-[13px] text-faint">No resources yet.</li>
        )}
      </ul>
      <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
        <Plus className="size-3.5" aria-hidden />
        Add resource
      </Button>

      <CreateOverlay
        title="Add a resource"
        hint="A link, an uploaded file, or both."
        open={adding}
        onClose={() => setAdding(false)}
      >
        <CreateForm
          action={resourceAction}
          fieldLabels={{ title: "Title", url: "Link", file: "File" }}
          submitLabel="Add resource"
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
        >
          <input type="hidden" name="sprint_id" value={sprintId} />
          <Field label="Title" htmlFor="resource-title">
            <Input
              id="resource-title"
              name="title"
              maxLength={200}
              autoFocus
              placeholder="e.g. Python for Everybody"
            />
          </Field>
          <Field label="Link" htmlFor="resource-url">
            <UrlInput id="resource-url" name="url" />
          </Field>
          <Field label="File" htmlFor="resource-file">
            <FileInput id="resource-file" name="file" />
          </Field>
        </CreateForm>
      </CreateOverlay>
    </div>
  );
}

export function DeleteSprintButton({ sprintId }: { sprintId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <ConfirmButton
        size="sm"
        disabled={pending}
        confirmLabel="Really delete?"
        onConfirm={() => {
          setError(null);
          startTransition(async () => {
            const result = await deleteSprint(sprintId);
            if (result && !result.ok) setError(result.message);
          });
        }}
      >
        Delete sprint
      </ConfirmButton>
      {error && (
        <p role="status" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
