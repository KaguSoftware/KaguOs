"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { EmailInput } from "@/components/ui/typed-inputs";

/**
 * /login is the one route teammates and clients share, so this form has to be
 * able to speak either language — but it stays a plain English component and
 * takes the words as a prop. The locale decision lives entirely in the page,
 * which is a server component and can read the cookie; a `"use client"` file
 * can't take the Dict. Defaulting to today's English means a caller that
 * passes nothing renders exactly what it always did.
 */
export type LoginFormLabels = {
  email: string;
  emailPlaceholder: string;
  password: string;
  submit: string;
  wrongCredentials: string;
};

const LOGIN_LABELS_EN: LoginFormLabels = {
  email: "Email",
  emailPlaceholder: "you@kagusoftware.com",
  password: "Password",
  submit: "Sign in",
  wrongCredentials: "Wrong email or password.",
};

export function LoginForm({ labels = LOGIN_LABELS_EN }: { labels?: LoginFormLabels }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (signInError) {
      setError(labels.wrongCredentials);
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label={labels.email} htmlFor="email">
        <EmailInput
          id="email"
          name="email"
          required
          autoFocus
          placeholder={labels.emailPlaceholder}
        />
      </Field>
      <Field label={labels.password} htmlFor="password" error={error}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {labels.submit}
      </Button>
    </form>
  );
}
