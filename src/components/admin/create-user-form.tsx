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
      className={cn("text-[13px]", result.ok ? "text-primary-dim" : "text-danger")}
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
        <legend className="mb-1.5 block text-[13px] font-medium text-muted">
          Sections
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {SECTIONS.map((section) => (
            <Checkbox
              key={section}
              label={SECTION_LABELS[section]}
              name="sections"
              value={section}
              defaultChecked={section === "debug" || section === "learn"}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[13px] text-faint">
          Everyone in Work is automatically also in Learn.
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
