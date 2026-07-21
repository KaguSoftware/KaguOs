"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Section-level error boundary.
 *
 * The counterpart to `selectOrThrow`: queries now throw instead of rendering a
 * fake empty state, and this is what the throw lands on. Before this existed a
 * thrown error hit Next's unstyled default screen, which is why "throw" wasn't
 * a safe strategy on its own.
 *
 * ⚠️ In production Next redacts the real message server-side and gives the
 * client only `digest` — so this deliberately shows the DIGEST rather than
 * `error.message`, which would be an empty string in prod and read as a bug in
 * the error page itself. The digest is the key to find the real error in the
 * server logs. In dev the message survives, so it's shown when present.
 */
export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfacing it in the browser console too — during a dev drive this is
    // usually the fastest place to read the full stack.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 space-y-2">
            <h1 className="text-base font-semibold text-ink">
              This section didn&apos;t load
            </h1>
            {/* Says what to do, without apologising or guessing at a cause. */}
            <p className="text-sm text-muted">
              Something went wrong fetching the data — not an empty section. Try
              again; if it keeps happening, send the reference below to Parsa.
            </p>
          </div>
        </div>

        {/* The reference. Mono + break-all because a digest is an opaque hash
            and a long dev message can be a full Postgres error. */}
        {(error.digest || error.message) && (
          <p className="mt-4 break-all rounded-md border border-line bg-raised px-3 py-2 font-mono text-[11px] text-faint">
            {error.digest ?? error.message}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={reset}>
            <RotateCw className="size-3.5" aria-hidden />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
