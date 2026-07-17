"use client";

import { useActionState } from "react";
import { updateProject } from "@/lib/actions/work";
import type { ActionResult } from "@/lib/actions/account";
import { SubmitButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { UrlInput } from "@/components/ui/typed-inputs";
import { PROJECT_STATUS_OPTIONS } from "@/components/work/new-project-form";
import { PROJECT_TYPE_OPTIONS, SECTOR_OPTIONS } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

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

export function EditProjectForm({ project }: { project: Project }) {
  const [result, action] = useActionState(updateProject, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <input type="hidden" name="id" value={project.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="project-name">
          <Input
            id="project-name"
            name="name"
            maxLength={120}
            defaultValue={project.name}
          />
        </Field>
        <Field label="Client" htmlFor="project-client">
          <Input
            id="project-client"
            name="client"
            maxLength={120}
            defaultValue={project.client ?? ""}
            placeholder="Internal if empty"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sector" htmlFor="project-sector">
          <Dropdown
            id="project-sector"
            name="sector"
            defaultValue={project.sector ?? undefined}
            options={SECTOR_OPTIONS}
            placeholder="Pick a sector…"
          />
        </Field>
        <Field label="Type" htmlFor="project-type">
          <Dropdown
            id="project-type"
            name="type"
            defaultValue={project.type ?? undefined}
            options={PROJECT_TYPE_OPTIONS}
            placeholder="Pick a type…"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="project-status">
          <Dropdown
            id="project-status"
            name="status"
            defaultValue={project.status}
            options={PROJECT_STATUS_OPTIONS}
          />
        </Field>
        <Field
          label="Deadline"
          htmlFor="project-due"
          hint="Optional — target date for this project."
        >
          <DatePicker
            id="project-due"
            name="due_on"
            defaultValue={project.due_on ?? ""}
            placeholder="No deadline"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repo URL" htmlFor="project-repo">
          <UrlInput
            id="project-repo"
            name="repo_url"
            defaultValue={project.repo_url ?? ""}
            placeholder="github.com/…"
          />
        </Field>
        <Field label="Production URL" htmlFor="project-prod">
          <UrlInput
            id="project-prod"
            name="prod_url"
            defaultValue={project.prod_url ?? ""}
            placeholder="example.com"
          />
        </Field>
      </div>
      <Field label="Notes" htmlFor="project-notes">
        <Textarea
          id="project-notes"
          name="notes"
          rows={4}
          defaultValue={project.notes ?? ""}
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton size="sm">Save changes</SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}
