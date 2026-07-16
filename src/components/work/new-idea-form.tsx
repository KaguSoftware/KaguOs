"use client";

import { useRouter } from "next/navigation";
import { createIdea } from "@/lib/actions/work";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export function NewIdeaForm() {
  const router = useRouter();

  return (
    <CreateForm
      action={createIdea}
      fieldLabels={{ title: "Idea", body: "Details" }}
      submitLabel="Post idea"
      onCancel={() => router.back()}
      onDone={() => router.push("/work/ideas")}
    >
      <Field label="Idea" htmlFor="idea-title">
        <Input
          id="idea-title"
          name="title"
          maxLength={200}
          autoFocus
          placeholder="What if we…"
        />
      </Field>
      <Field
        label="Details"
        htmlFor="idea-body"
        hint="Why it's worth doing, rough shape, anything that helps the discussion."
      >
        <Textarea id="idea-body" name="body" rows={7} />
      </Field>
    </CreateForm>
  );
}
