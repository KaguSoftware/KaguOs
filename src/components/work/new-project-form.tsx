"use client";

import { useRouter } from "next/navigation";
import { createProject } from "@/lib/actions/work";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { UrlInput } from "@/components/ui/typed-inputs";

export const PROJECT_STATUS_OPTIONS = [
  { value: "planning", label: "Planning", hint: "Not started yet" },
  { value: "active", label: "Active", hint: "Being built right now" },
  { value: "paused", label: "Paused", hint: "On hold" },
  { value: "done", label: "Done", hint: "Shipped / wrapped up" },
];

export function NewProjectForm() {
  const router = useRouter();

  return (
    <CreateForm
      action={createProject}
      fieldLabels={{
        name: "Name",
        client: "Client",
        repo_url: "Repo URL",
        prod_url: "Production URL",
        notes: "Notes",
      }}
      submitLabel="Create project"
      onCancel={() => router.back()}
      onDone={() => router.push("/work")}
    >
      <Field label="Name" htmlFor="project-name">
        <Input id="project-name" name="name" maxLength={120} autoFocus placeholder="Project name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="project-client" hint="Leave empty for internal work.">
          <Input id="project-client" name="client" maxLength={120} />
        </Field>
        <Field label="Status" htmlFor="project-status">
          <Dropdown
            id="project-status"
            name="status"
            defaultValue="planning"
            options={PROJECT_STATUS_OPTIONS}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repo URL" htmlFor="project-repo">
          <UrlInput id="project-repo" name="repo_url" placeholder="github.com/…" />
        </Field>
        <Field label="Production URL" htmlFor="project-prod">
          <UrlInput id="project-prod" name="prod_url" placeholder="example.com" />
        </Field>
      </div>
      <Field label="Notes" htmlFor="project-notes">
        <Textarea id="project-notes" name="notes" rows={5} />
      </Field>
    </CreateForm>
  );
}
