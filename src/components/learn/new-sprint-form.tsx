"use client";

import { useRouter } from "next/navigation";
import { createSprint } from "@/lib/actions/learn";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";

export function NewSprintForm() {
  const router = useRouter();

  return (
    <CreateForm
      action={createSprint}
      fieldLabels={{
        title: "Title",
        starts_on: "Start date",
        ends_on: "End date",
        description: "Description",
      }}
      submitLabel="Create sprint"
      onCancel={() => router.back()}
    >
      <Field label="Title" htmlFor="sprint-title">
        <Input
          id="sprint-title"
          name="title"
          maxLength={120}
          autoFocus
          placeholder="e.g. Starting Python"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="sprint-starts">
          <DatePicker id="sprint-starts" name="starts_on" />
        </Field>
        <Field label="Ends" htmlFor="sprint-ends">
          <DatePicker id="sprint-ends" name="ends_on" />
        </Field>
      </div>
      <Field
        label="Description"
        htmlFor="sprint-description"
        hint="After creating, you'll pick participants and add the goal checklist + resources."
      >
        <Textarea id="sprint-description" name="description" rows={5} />
      </Field>
    </CreateForm>
  );
}
