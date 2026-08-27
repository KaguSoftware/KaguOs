"use client";

import { useActionState } from "react";
import { updateName, updatePassword, type ActionResult } from "@/lib/actions/account";
import { SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Both forms are rendered by two pages: the teammate account page, which has
 * no locale and never will, and the client portal's, which does. So `labels`
 * is OPTIONAL and defaults to the English these forms have always shown —
 * the teammate page keeps compiling untouched and renders byte-identically,
 * and the portal page passes a bundle of already-resolved strings. A client
 * component can't take the Dict itself (it's a server-only object), which is
 * the same reason PortalNavLabels exists.
 */
export type NameFormLabels = {
  fullName: string;
  placeholder: string;
  save: string;
};

export type PasswordFormLabels = {
  newPassword: string;
  repeat: string;
  submit: string;
};

const NAME_LABELS_EN: NameFormLabels = {
  fullName: "Full name",
  placeholder: "Your name",
  save: "Save name",
};

const PASSWORD_LABELS_EN: PasswordFormLabels = {
  newPassword: "New password",
  repeat: "Repeat new password",
  submit: "Change password",
};

/**
 * `result.message` arrives already in the reader's language: the server action
 * reads the locale cookie itself (lib/actions/account.ts), so there is nothing
 * to translate on this side.
 */
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

export function NameForm({
  currentName,
  labels = NAME_LABELS_EN,
}: {
  currentName: string | null;
  labels?: NameFormLabels;
}) {
  const [result, action] = useActionState(updateName, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <Field label={labels.fullName} htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          defaultValue={currentName ?? ""}
          maxLength={80}
          required
          placeholder={labels.placeholder}
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton>{labels.save}</SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}

export function PasswordForm({
  labels = PASSWORD_LABELS_EN,
}: {
  labels?: PasswordFormLabels;
}) {
  const [result, action] = useActionState(updatePassword, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <Field label={labels.newPassword} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <Field label={labels.repeat} htmlFor="confirm">
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
        <SubmitButton>{labels.submit}</SubmitButton>
        <ResultNote result={result} />
      </div>
    </form>
  );
}
