"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * A link to a file in a private bucket that mints its signed URL AT CLICK TIME.
 *
 * ⚠️ NEVER bake a signed URL into server-rendered HTML. That was the bug this
 * component exists to kill: the Learn sprint page signed every attachment during
 * render with a 1-hour TTL and wrote the URL straight into the markup. The page
 * then sat in the router cache / an open tab, so any click made more than an
 * hour after that render carried a dead token and Supabase answered
 *
 *   {"statusCode":"400","error":"InvalidJWT","message":"\"exp\" claim timestamp
 *    check failed"}
 *
 * — which reads to the user as "the PDF button does nothing". The TTL can't be
 * raised out of the problem; a render-time URL is stale by construction. Signing
 * on demand means the token is always seconds old, so the TTL can be SHORT
 * (60s — long enough to redirect, short enough to be useless if the URL leaks).
 * Same pattern the debug board already uses for task screenshots.
 *
 * Opening happens via `window.location.assign` on the current tab rather than
 * `window.open`, because the async signing round-trip severs the click from its
 * user gesture and popup blockers eat the resulting `open()`.
 */
export function SignedFileLink({
  bucket,
  path,
  className,
  pendingClassName,
  children,
  ariaLabel,
  title,
}: {
  bucket: string;
  /** Storage path inside `bucket`. Signed fresh on every click. */
  path: string;
  className?: string;
  /** Extra classes while the URL is being minted. */
  pendingClassName?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  title?: string;
}) {
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function open() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60);
      if (error || !data?.signedUrl) {
        // Say what failed. A silent no-op is what made the original bug so hard
        // to report — the click looked like it simply didn't register.
        toast.error("Couldn't open that file. Try again.");
        return;
      }
      window.location.assign(data.signedUrl);
    } catch {
      toast.error("Couldn't open that file. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      aria-label={ariaLabel}
      aria-busy={pending}
      title={title}
      className={cn(className, pending && (pendingClassName ?? "opacity-70"))}
    >
      {pending && <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
