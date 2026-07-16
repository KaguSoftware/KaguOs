"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/account";

type RunOptions = {
  /** Toast on success. Omit for silent success (optimistic UI already shows it). */
  success?: string;
  /** Optimistic mutation applied immediately, before the server responds. */
  optimistic?: () => void;
  /** Undo the optimistic mutation if the server rejects or throws. */
  rollback?: () => void;
  /** Called after a successful result (e.g. close an overlay). */
  onSuccess?: () => void;
};

/**
 * One consistent way to fire a server action from a client component:
 * optimistic apply → run → on failure roll back and surface the reason as an
 * error toast. Every action in the app talks to the user the same way.
 *
 * Errors are ALWAYS toasted (assertive, unmissable). Success is toasted only
 * when a `success` message is given — optimistic flows usually stay quiet.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function run(fn: () => Promise<ActionResult>, opts: RunOptions = {}) {
    opts.optimistic?.();
    startTransition(async () => {
      try {
        const result = await fn();
        if (result && !result.ok) {
          opts.rollback?.();
          toast.error(result.message);
          return;
        }
        if (opts.success) toast.success(opts.success);
        opts.onSuccess?.();
      } catch {
        opts.rollback?.();
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return { pending, run, toast };
}
