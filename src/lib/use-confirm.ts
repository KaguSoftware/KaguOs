"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Two-step confirm without a modal: the first press arms the control, the
 * second fires it. The arming disappears on its own after `timeoutMs` so a
 * misclick never leaves a live destructive trigger sitting under the cursor.
 *
 * The control decides how "armed" looks (a changed label, a changed tone) —
 * this hook only owns the state and the timer.
 */
export function useConfirm(onConfirm: () => void, timeoutMs = 3000) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const trigger = useCallback(() => {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), timeoutMs);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    onConfirm();
  }, [armed, onConfirm, timeoutMs]);

  return { armed, trigger };
}
