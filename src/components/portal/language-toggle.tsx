"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALES,
  dirFor,
  type Locale,
} from "@/lib/locale";

/**
 * The portal's language switch.
 *
 * ── Why it refreshes the route instead of swapping strings on the client ────
 *
 * The pack's questions are chosen on the SERVER (the layout and the page read
 * the cookie and pass a locale down), so the new language has to come from a
 * server render. `router.refresh()` re-runs those components with the new
 * cookie and keeps the form's local state — the answers being typed — intact,
 * which a full navigation would throw away.
 *
 * ── Why `<html dir>` is written from an effect ─────────────────────────────
 *
 * ⚠️ Measured, not assumed: **`router.refresh()` does not patch attributes on
 * `<html>`.** The refreshed RSC payload delivers the Arabic text, but `dir` and
 * `lang` keep whatever the last full document load set — so a portal that
 * relied on the root layout alone would show Arabic text in a left-to-right
 * page until something forced a hard navigation. Something has to write the
 * attribute from the client.
 *
 * Doing it in the click handler is the obvious version and is wrong: the
 * attribute lands immediately while the text arrives a round-trip later, so the
 * page spends that window mirrored but still in English — which looks like a
 * bug rather than like loading. Keying the write to `current` instead means the
 * direction turns at exactly the moment the new words commit, because `current`
 * is the SERVER's locale and only changes when the refreshed render lands.
 *
 * It also self-heals: on first mount it reconciles `<html>` with the cookie the
 * server actually read, whatever any previous page left behind.
 *
 * `useTransition` keeps the toggle responsive and disables it while the refresh
 * is in flight, so a double-click can't queue two renders.
 */
export function LanguageToggle({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // What the user just pressed, shown only while the refresh is in flight so
  // the segment highlights on click rather than one round-trip later. Once the
  // server answers, `current` is the truth again — deriving the displayed value
  // this way means there is no second copy of the locale to fall out of sync.
  const [choice, setChoice] = useState<Locale | null>(null);
  const value = pending && choice ? choice : current;

  useEffect(() => {
    const root = document.documentElement;
    const dir = dirFor(current);
    if (root.getAttribute("dir") !== dir) root.setAttribute("dir", dir);
    if (root.getAttribute("lang") !== current) root.setAttribute("lang", current);
  }, [current]);

  const choose = useCallback(
    (next: Locale) => {
      setChoice(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
      startTransition(() => router.refresh());
    },
    [router]
  );

  return (
    <Segmented
      options={LOCALES.map((l) => ({ key: l.key, label: l.label, short: l.short }))}
      value={value}
      onChange={choose}
      label={label}
      size="sm"
      disabled={pending}
    />
  );
}
