"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "loading";

type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
  /** loading toasts persist until dismissed/updated; others auto-dismiss. */
  duration: number | null;
};

type ToastInput = { tone?: ToastTone; message: string; duration?: number | null };

type ToastHandle = {
  /** Replace this toast's content (e.g. loading → success). Resets its timer. */
  update: (next: ToastInput) => void;
  dismiss: () => void;
};

type ToastApi = {
  toast: (input: ToastInput) => ToastHandle;
  success: (message: string) => ToastHandle;
  error: (message: string) => ToastHandle;
  /**
   * Wrap a promise: shows a loading toast, then success/error on settle.
   * Returns the promise so callers can await it.
   */
  promise: <T>(
    p: Promise<T>,
    msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }
  ) => Promise<T>;
};

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4000;

const TONE_META: Record<
  ToastTone,
  { icon: typeof CheckCircle2; className: string; iconClass: string; live: "polite" | "assertive" }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-primary/30",
    iconClass: "text-primary-dim",
    live: "polite",
  },
  error: {
    icon: TriangleAlert,
    className: "border-danger/40",
    iconClass: "text-danger",
    live: "assertive",
  },
  info: {
    icon: Info,
    className: "border-line-strong",
    iconClass: "text-info",
    live: "polite",
  },
  loading: {
    icon: Loader2,
    className: "border-line-strong",
    iconClass: "text-muted animate-spin",
    live: "polite",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const counter = useRef(0);

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer]
  );

  const arm = useCallback(
    (id: string, duration: number | null) => {
      clearTimer(id);
      if (duration !== null) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        );
      }
    },
    [clearTimer, dismiss]
  );

  const push = useCallback(
    (input: ToastInput): ToastHandle => {
      const tone = input.tone ?? "info";
      const duration =
        input.duration !== undefined
          ? input.duration
          : tone === "loading"
            ? null
            : DEFAULT_DURATION;
      // Deterministic id (no Math.random) — a monotonic counter is enough.
      counter.current += 1;
      const id = `t${counter.current}`;
      const next: Toast = { id, tone, message: input.message, duration };
      setToasts((prev) => [...prev, next]);
      arm(id, duration);

      return {
        update: (u) => {
          const uTone = u.tone ?? "info";
          const uDuration =
            u.duration !== undefined
              ? u.duration
              : uTone === "loading"
                ? null
                : DEFAULT_DURATION;
          setToasts((prev) =>
            prev.map((t) =>
              t.id === id
                ? { ...t, tone: uTone, message: u.message, duration: uDuration }
                : t
            )
          );
          arm(id, uDuration);
        },
        dismiss: () => dismiss(id),
      };
    },
    [arm, dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (message) => push({ tone: "success", message }),
      error: (message) => push({ tone: "error", message }),
      promise: async (p, msgs) => {
        const handle = push({ tone: "loading", message: msgs.loading });
        try {
          const value = await p;
          handle.update({
            tone: "success",
            message:
              typeof msgs.success === "function" ? msgs.success(value) : msgs.success,
          });
          return value;
        } catch (e) {
          handle.update({
            tone: "error",
            message: typeof msgs.error === "function" ? msgs.error(e) : msgs.error,
          });
          throw e;
        }
      },
    }),
    [push]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const meta = TONE_META[t.tone];
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            role="status"
            aria-live={meta.live}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-raised px-3.5 py-3 shadow-lg shadow-black/40",
              "motion-safe:animate-[toast-in_220ms_var(--ease-mac)_both]",
              meta.className
            )}
          >
            <Icon className={cn("mt-px size-4 shrink-0", meta.iconClass)} aria-hidden />
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{t.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 text-faint transition-colors hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
