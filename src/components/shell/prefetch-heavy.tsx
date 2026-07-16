"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * After the dashboard paints, quietly warm the client cache for the
 * data-heavy sections (Finance charts, the Debug board) so switching to them
 * is instant. Lighter sections rely on Next's default hover/viewport
 * prefetch. Only routes the user can actually reach are passed in.
 *
 * Runs once, deferred to idle so it never competes with the first paint.
 */
export function PrefetchHeavy({ routes }: { routes: string[] }) {
  const router = useRouter();

  useEffect(() => {
    if (routes.length === 0) return;
    const warm = () => routes.forEach((r) => router.prefetch(r));
    // Defer to idle; fall back to a short timeout where requestIdleCallback
    // isn't available (Safari).
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (ric) {
      const id = ric(warm);
      return () => {
        const cancel = (
          window as unknown as {
            cancelIdleCallback?: (id: number) => void;
          }
        ).cancelIdleCallback;
        cancel?.(id);
      };
    }
    const t = setTimeout(warm, 800);
    return () => clearTimeout(t);
  }, [routes, router]);

  return null;
}
