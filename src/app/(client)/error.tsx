"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dict, type PortalDict } from "@/lib/i18n";

/**
 * The portal's error boundary — the counterpart to `(app)/error.tsx`.
 *
 * Until this file existed the `(client)` group had none, so a failed query fell
 * all the way to Next's default screen: English, unstyled, outside the shell,
 * and carrying the string `rowsOrThrow`/`selectOrThrow` throws — which names
 * the table and the Postgres error code (`project_invoices: 42703 column …`).
 * That is a schema detail an outsider with a login should never see, so the
 * message is logged and never rendered; only `digest` reaches the page, and it
 * is the key to the real error in the server log.
 *
 * ── Why both languages are in the markup ───────────────────────────────────
 *
 * Every other portal surface reads `kagu-locale` in a Server Component and
 * hands resolved strings down. An error boundary cannot: Next requires it to be
 * a Client Component, and a Client Component has no request context, so
 * `cookies()` is unavailable. The alternatives all lose the first paint —
 * reading `document.cookie` or `documentElement.lang` at render time throws
 * during SSR, and reading it in an effect renders the English, then swaps to
 * Arabic and flips direction a frame later. That is the exact flicker
 * `lib/locale.ts` chose a server-read cookie to avoid, and it would land on the
 * one screen where the reader is already confused.
 *
 * So the card is rendered twice and one copy is hidden by direction. `<html
 * dir>` is already correct on the first byte (set by the root layout from the
 * cookie), and Tailwind's `rtl:`/`ltr:` variants resolve against it in plain
 * CSS — no JavaScript, no hydration step, nothing to flash. The hidden copy is
 * `display:none`, so screen readers skip it.
 *
 * The cost is honest and small: importing `dict` pulls the dictionary into this
 * route's client bundle, which the `labels`-prop convention otherwise avoids.
 * Four strings duplicated in this file instead would be four strings that drift
 * from the dictionary the moment someone rewords them.
 *
 * ── Why `unstable_retry` and not `reset` ───────────────────────────────────
 *
 * `reset()` only clears the boundary and re-renders the same children; every
 * error that lands here is a failed fetch, so re-rendering without re-fetching
 * would show the same failure again. `unstable_retry()` (Next 16.2) re-fetches
 * the segment first, which is the only thing that can actually make "Try again"
 * do something. `(app)/error.tsx` still uses `reset` and is left alone.
 */
export default function PortalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The whole message, in the browser console only. This is the one place it
    // is allowed to exist client-side; it must not reach the page.
    console.error(error);
  }, [error]);

  return (
    <>
      <ErrorCard
        t={dict("en")}
        lang="en"
        digest={error.digest}
        onRetry={unstable_retry}
        className="rtl:hidden"
      />
      <ErrorCard
        t={dict("ar")}
        lang="ar"
        digest={error.digest}
        onRetry={unstable_retry}
        className="ltr:hidden"
      />
    </>
  );
}

/**
 * One language's copy of the card. No `dir` attribute of its own: the visible
 * copy inherits the right direction from `<html>`, and putting one here would
 * fight the `rtl:`/`ltr:` gate that decides which copy is visible in the first
 * place.
 */
function ErrorCard({
  t,
  lang,
  digest,
  onRetry,
  className,
}: {
  t: PortalDict;
  lang: "en" | "ar";
  digest?: string;
  onRetry: () => void;
  className: string;
}) {
  return (
    <div
      lang={lang}
      className={`flex min-h-[60vh] items-center justify-center px-4 ${className}`}
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 space-y-2">
            <h1 className="text-base font-semibold text-ink">{t.errorTitle}</h1>
            {/* Says what to do, and says it wasn't their doing — a client who
                cannot see the cause will otherwise assume they caused it. */}
            <p className="text-sm text-muted">{t.errorBlurb}</p>
          </div>
        </div>

        {/* The digest only, never `error.message`. In production Next redacts
            the message client-side anyway; in dev it survives and would be the
            raw Postgres error, which is exactly what must not be shown here. */}
        {digest && (
          <div className="mt-4 rounded-md border border-line bg-raised px-3 py-2">
            <p className="text-[calc(11px*var(--text-scale,1))] text-faint">
              {t.errorReference}
            </p>
            {/* An opaque hash: always left-to-right, always mono, and allowed
                to break mid-string because it has no words to break between. */}
            <p
              dir="ltr"
              className="mt-0.5 break-all font-mono text-[calc(11px*var(--text-scale,1))] text-faint"
            >
              {digest}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => onRetry()}>
            <RotateCw className="size-3.5" aria-hidden />
            {t.errorRetry}
          </Button>
        </div>
      </div>
    </div>
  );
}
