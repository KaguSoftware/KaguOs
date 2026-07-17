"use client";

import { useRouter } from "next/navigation";
import { createTask } from "@/lib/actions/debug";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", hint: "Whenever someone gets to it" },
  { value: "medium", label: "Medium", hint: "Normal flow" },
  { value: "high", label: "High", hint: "Should be picked up soon" },
  { value: "urgent", label: "Urgent", hint: "Drop other things" },
];

export function NewTaskForm({
  projects,
  memberOptions,
}: {
  projects: { id: string; name: string }[];
  /** People an admin can suggest for the task. Empty for non-admins. */
  memberOptions: { value: string; label: string }[];
}) {
  const router = useRouter();

  return (
    <CreateForm
      action={createTask}
      fieldLabels={{ title: "Title", description: "Details" }}
      submitLabel="Post task"
      onCancel={() => router.back()}
      onDone={() => router.push("/debug")}
    >
      <Field label="Title" htmlFor="task-title">
        <Input
          id="task-title"
          name="title"
          maxLength={200}
          autoFocus
          placeholder="What needs doing?"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Board" htmlFor="task-project" hint="Which project's board it belongs to.">
          <Dropdown
            id="task-project"
            name="project_id"
            defaultValue=""
            options={[
              { value: "", label: "General", hint: "Not tied to a project" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <Dropdown
            id="task-priority"
            name="priority"
            defaultValue="medium"
            options={PRIORITY_OPTIONS}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Deadline"
          htmlFor="task-due"
          hint="Optional — when this should be done by."
        >
          <DatePicker id="task-due" name="due_on" placeholder="No deadline" />
        </Field>
        {memberOptions.length > 0 && (
          <Field
            label="Suggest for"
            htmlFor="task-suggested"
            hint="A nudge, not a claim — anyone can still pick it up."
          >
            <Dropdown
              id="task-suggested"
              name="suggested_for"
              defaultValue=""
              placeholder="No suggestion"
              options={[
                { value: "", label: "No suggestion" },
                ...memberOptions,
              ]}
            />
          </Field>
        )}
      </div>
      <Field
        label="Details"
        htmlFor="task-description"
        hint="Steps to reproduce, links, context — whatever helps the person who claims it."
      >
        <Textarea id="task-description" name="description" rows={6} />
      </Field>
    </CreateForm>
  );
}
