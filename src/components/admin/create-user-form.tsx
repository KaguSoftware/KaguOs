"use client";

import { useActionState } from "react";
import { createUser } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/account";
import { SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailInput } from "@/components/ui/typed-inputs";
import { SECTIONS, SECTION_LABELS } from "@/lib/types";
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

export function CreateUserForm() {
  const [result, action] = useActionState(createUser, null);

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
      <div className="flex items-center gap-3">
        <SubmitButton>Create user</SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}
