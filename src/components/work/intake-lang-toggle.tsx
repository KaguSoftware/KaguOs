"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import {
  INTAKE_LANG_COOKIE,
  INTAKE_LANG_COOKIE_MAX_AGE,
  INTAKE_LANGS,
  type IntakeLang,
} from "@/lib/intake-lang";

/**
 * Which language the team reads the pack in.
 *
 * The client's toggle (components/portal/language-toggle.tsx) also rewrites
 * `dir` on the document. This one deliberately does NOT: it changes the words
 * inside one document, and the app around it stays English and left-to-right.
 * See lib/intake-lang.ts for why that separation is the whole point.
 */
export function IntakeLangToggle({ current }: { current: IntakeLang }) {
  const router = useRouter();
  const [value, setValue] = useState<IntakeLang>(current);
  const [pending, startTransition] = useTransition();

  const choose = useCallback(
    (next: IntakeLang) => {
      setValue(next);
      document.cookie = `${INTAKE_LANG_COOKIE}=${next}; path=/; max-age=${INTAKE_LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
      startTransition(() => router.refresh());
    },
    [router]
  );

  return (
    <Segmented
      options={INTAKE_LANGS.map((l) => ({
        key: l.key,
        label: l.label,
        short: l.short,
        title: `Show labels in ${l.label}`,
      }))}
      value={value}
      onChange={choose}
      label="Pack language"
      size="sm"
      disabled={pending}
    />
  );
}
