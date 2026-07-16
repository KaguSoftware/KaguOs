"use client";

import { useRouter } from "next/navigation";
import { createTask } from "@/lib/actions/debug";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", hint: "Whenever someone gets to it" },
  { value: "medium", label: "Medium", hint: "Normal flow" },
  { value: "high", label: "High", hint: "Should be picked up soon" },
  { value: "urgent", label: "Urgent", hint: "Drop other things" },
];

export function NewTaskForm() {
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
      <Field label="Priority" htmlFor="task-priority">
        <Dropdown
          id="task-priority"
          name="priority"
          defaultValue="medium"
          options={PRIORITY_OPTIONS}
        />
      </Field>
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
