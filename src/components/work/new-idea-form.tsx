"use client";

import { useRouter } from "next/navigation";
import { createIdea } from "@/lib/actions/work";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { PROJECT_TYPE_OPTIONS, SECTOR_OPTIONS } from "@/lib/options";

/**
 * One form, two registers.
 *
 * Without a project it's the company pipeline's "propose a new project" form,
 * unchanged. WITH a project it's "suggest something for this project" — and
 * sector/type drop out, because those two describe the shape of a project that
 * would be created, and a suggestion inside an existing project never creates
 * one (see the auto-promote guard in actions/work.ts). Asking "what sector
 * would this belong to?" about a button rename is a question with no answer.
 */
export function NewIdeaForm({
  project,
}: {
  project?: { id: string; name: string };
}) {
  const router = useRouter();
  const done = project ? `/work/projects/${project.id}/ideas` : "/work?tab=ideas";

  return (
    <CreateForm
      action={createIdea}
      fieldLabels={
        project
          ? { title: "Idea", body: "Details" }
          : { title: "Idea", body: "Details", sector: "Sector", type: "Type" }
      }
      submitLabel="Post idea"
      onCancel={() => router.back()}
      onDone={() => router.push(done)}
    >
      {project && <input type="hidden" name="project_id" value={project.id} />}
      <Field label="Idea" htmlFor="idea-title">
        <Input
          id="idea-title"
          name="title"
          maxLength={200}
          autoFocus
          placeholder={project ? "What if we…" : "What if we built…"}
        />
      </Field>
      {!project && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sector" htmlFor="idea-sector" hint="Who it would serve.">
            <Dropdown
              id="idea-sector"
              name="sector"
              options={SECTOR_OPTIONS}
              placeholder="Pick a sector…"
            />
          </Field>
          <Field
            label="Type"
            htmlFor="idea-type"
            hint="What kind of software it would be."
          >
            <Dropdown
              id="idea-type"
              name="type"
              options={PROJECT_TYPE_OPTIONS}
              placeholder="Pick a type…"
            />
          </Field>
        </div>
      )}
      <Field
        label="Details"
        htmlFor="idea-body"
        hint={
          project
            ? "Why it's worth doing, and anything that helps the team judge it."
            : "Why it's worth doing, rough shape, anything that helps the discussion."
        }
      >
        <Textarea id="idea-body" name="body" rows={7} />
      </Field>
    </CreateForm>
  );
}
