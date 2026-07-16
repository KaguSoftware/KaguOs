"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import {
  addGoal,
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
import { DatePicker } from "@/components/ui/date-picker";
import { FileInput, UrlInput } from "@/components/ui/typed-inputs";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(userId: string) {
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    setError(null);
    startTransition(async () => {
      const result = await setParticipants(sprintId, next);
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {people.map((person) => (
          <label key={person.id} className="flex items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={current.includes(person.id)}
              onChange={() => toggle(person.id)}
              disabled={pending}
              className="size-4 accent-(--primary)"
            />
            {person.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />}
        {error && (
          <p role="status" className="text-[13px] text-danger">
            {error}
          </p>
        )}
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
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3 p-4">
      <ul className="space-y-1.5">
        {goals.map((goal) => (
          <li key={goal.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">{goal.title}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await removeGoal(goal.id, sprintId);
                })
              }
              title="Remove goal"
              aria-label={`Remove goal ${goal.title}`}
              className="text-faint hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {goals.length === 0 && (
          <li className="text-[13px] text-faint">
            No goals yet — the checklist everyone ticks lives here.
          </li>
        )}
      </ul>
      <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
        <Plus className="size-3.5" aria-hidden />
        Add goal
      </Button>

      <CreateOverlay
        title="Add a goal"
        hint="One checklist item — every participant ticks it off individually."
        open={adding}
        onClose={() => setAdding(false)}
      >
        <CreateForm
          action={addGoal}
          fieldLabels={{ title: "Goal" }}
          submitLabel="Add goal"
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
        >
          <input type="hidden" name="sprint_id" value={sprintId} />
          <input type="hidden" name="sort_order" value={goals.length} />
          <Field label="Goal" htmlFor="goal-title">
            <Input
              id="goal-title"
              name="title"
              maxLength={200}
              autoFocus
              placeholder="e.g. Finish chapters 1–3"
            />
          </Field>
        </CreateForm>
      </CreateOverlay>
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
