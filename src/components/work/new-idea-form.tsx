"use client";

import { useRouter } from "next/navigation";
import { createIdea } from "@/lib/actions/work";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { PROJECT_TYPE_OPTIONS, SECTOR_OPTIONS } from "@/lib/options";

export function NewIdeaForm() {
  const router = useRouter();

  return (
    <CreateForm
      action={createIdea}
      fieldLabels={{ title: "Idea", body: "Details", sector: "Sector", type: "Type" }}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sector" htmlFor="idea-sector" hint="Who it would serve.">
          <Dropdown
            id="idea-sector"
            name="sector"
            options={SECTOR_OPTIONS}
            placeholder="Pick a sector…"
          />
        </Field>
        <Field label="Type" htmlFor="idea-type" hint="What kind of software it would be.">
          <Dropdown
            id="idea-type"
            name="type"
            options={PROJECT_TYPE_OPTIONS}
            placeholder="Pick a type…"
          />
        </Field>
      </div>
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
