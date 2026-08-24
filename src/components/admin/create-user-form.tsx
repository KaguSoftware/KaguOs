"use client";

import { useActionState, useState } from "react";
import { createUser } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/account";
import { SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailInput } from "@/components/ui/typed-inputs";
import type { AdminProject } from "@/components/admin/user-row";
import {
  PROFILE_KINDS,
  PROFILE_KIND_LABELS,
  SECTIONS,
  SECTION_LABELS,
  type ProfileKind,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function ResultNote({ result }: { result: ActionResult }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={cn("text-[calc(13px*var(--text-scale,1))]", result.ok ? "text-primary-dim" : "text-danger")}
    >
      {result.message}
    </p>
  );
}

export function CreateUserForm({ projects }: { projects: AdminProject[] }) {
  const [result, action] = useActionState(createUser, null);
  // The one piece of state this form needs: which half of it to show. Both
  // halves post their own names, and the server reads only the ones belonging
  // to the chosen role — so an unmounted section can't leak a grant.
  const [kind, setKind] = useState<ProfileKind>("member");

  return (
    <form action={action} className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="new-email">
          <EmailInput id="new-email" name="email" required placeholder="teammate@kagusoftware.com" />
        </Field>
        <Field label="Full name" htmlFor="new-name">
          <Input id="new-name" name="full_name" required maxLength={80} />
        </Field>
      </div>
      <Field
        label="Temp password"
        htmlFor="new-password"
        hint="Share it with them privately — they change it in Account after first sign-in."
      >
        <Input id="new-password" name="password" type="text" minLength={8} required />
      </Field>

      {/* ---- Role, first, because it decides what the rest of the form asks. */}
      <fieldset>
        <legend className="mb-1.5 block text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
          Role
        </legend>
        <input type="hidden" name="kind" value={kind} />
        <div
          role="group"
          aria-label="Account role"
          className="flex w-fit overflow-hidden rounded-md border border-line"
        >
          {PROFILE_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
              className={cn(
                "px-3 py-1.5 text-[calc(13px*var(--text-scale,1))] transition-colors duration-150",
                kind === option ? "bg-raised text-ink" : "text-faint hover:text-muted"
              )}
            >
              {PROFILE_KIND_LABELS[option]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] text-faint">
          {kind === "client"
            ? "Someone at a business you're building for. They get their project's input pack and nothing else — no sections, no chat, no team roster."
            : "Someone at Kagu. They belong to sections."}
        </p>
      </fieldset>

      {kind === "member" ? (
        <>
          <fieldset>
            <legend className="mb-1.5 block text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
              Sections
            </legend>
            {/* Checked = they get the section; the View box next to it downgrades
                that grant to read-only. Both post plainly, so this stays a normal
                uncontrolled form — parseAccess in actions/admin.ts reads the pair. */}
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SECTIONS.map((section) => (
                <div key={section} className="flex items-center justify-between gap-3">
                  <Checkbox
                    label={SECTION_LABELS[section]}
                    name="sections"
                    value={section}
                    defaultChecked={section === "debug" || section === "learn"}
                  />
                  <Checkbox
                    size="sm"
                    className="shrink-0 text-[calc(12px*var(--text-scale,1))] text-faint"
                    label="View only"
                    name={`access:${section}`}
                    value="read"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[calc(13px*var(--text-scale,1))] text-faint">
              Sections are independent — tick exactly what they should see. &ldquo;View
              only&rdquo; lets them read the section without changing anything in it.
            </p>
          </fieldset>
          <Checkbox name="is_admin" label="Admin (manages users and sprints)" />
        </>
      ) : (
        <fieldset>
          <legend className="mb-1.5 block text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
            Projects to share with them
          </legend>
          {projects.length === 0 ? (
            <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
              No projects exist yet. Create the project in Work first, then come
              back — you can also share it later from the row above.
            </p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {projects.map((project) => (
                <Checkbox
                  key={project.id}
                  name="projects"
                  value={project.id}
                  label={
                    <span className="min-w-0">
                      <span className="text-ink">{project.name}</span>
                      {project.client && (
                        <span className="text-faint"> · {project.client}</span>
                      )}
                    </span>
                  }
                />
              ))}
            </div>
          )}
          <p className="mt-1.5 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] text-faint">
            Leave them all unticked if you&rsquo;re setting the account up ahead
            of time — an unassigned client sees an empty portal, not somebody
            else&rsquo;s project.
          </p>
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton>
          {kind === "client" ? "Create client account" : "Create user"}
        </SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}
