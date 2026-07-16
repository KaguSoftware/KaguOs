"use client";

import { useActionState } from "react";
import { updateName, updatePassword, type ActionResult } from "@/lib/actions/account";
import { SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
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

export function NameForm({ currentName }: { currentName: string | null }) {
  const [result, action] = useActionState(updateName, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <Field label="Full name" htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          defaultValue={currentName ?? ""}
          maxLength={80}
          required
          placeholder="Your name"
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>Save name</SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [result, action] = useActionState(updatePassword, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <Field label="New password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <Field label="Repeat new password" htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>Change password</SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}
