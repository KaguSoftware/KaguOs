"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { ActionResult } from "@/lib/actions/account";
import { Button, SubmitButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one way to add things in KaguOs: a spacious, focused create surface.
 * No required fields — on submit, empty fields are listed in a confirm step
 * ("Title and Details are empty — submit anyway?").
 */
export function CreateForm({
  action,
  fieldLabels,
  submitLabel,
  onCancel,
  onDone,
  children,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  /** name → human label; these are checked for emptiness on submit */
  fieldLabels: Record<string, string>;
  submitLabel: string;
  onCancel?: () => void;
  onDone?: () => void;
  children: React.ReactNode;
}) {
  const [result, formAction] = useActionState(action, null);
  const [emptyWarning, setEmptyWarning] = useState<string[] | null>(null);
  const confirmedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result?.ok) {
      formRef.current?.reset();
      confirmedRef.current = false;
      setEmptyWarning(null);
      onDone?.();
    }
  }, [result, onDone]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return; // proceed with the server action
    }
    const data = new FormData(event.currentTarget);
    const empties = Object.entries(fieldLabels)
      .filter(([name]) => {
        const value = data.get(name);
        if (value instanceof File) return value.size === 0;
        return !String(value ?? "").trim();
      })
      .map(([, label]) => label);
    if (empties.length > 0) {
      event.preventDefault();
      setEmptyWarning(empties);
    }
  }

  const warningText =
    emptyWarning && emptyWarning.length > 0
      ? `${emptyWarning.join(" and ")} ${emptyWarning.length === 1 ? "is" : "are"} empty — are you sure you want to submit?`
      : null;

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-5">
      {children}

      {warningText ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber/30 bg-amber/10 px-3 py-2.5">
          <p className="text-[13px] text-amber">{warningText}</p>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              onClick={() => {
                confirmedRef.current = true;
                setEmptyWarning(null);
              }}
            >
              Submit anyway
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEmptyWarning(null)}
            >
              Keep editing
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <SubmitButton>{submitLabel}</SubmitButton>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {result && !result.ok && (
            <p role="status" className="text-[13px] text-danger">
              {result.message}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

/** Full-page create surface for routes: back affordance + generous column. */
export function CreatePage({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          aria-label="Close"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Fullscreen overlay create surface for sub-items (goals, resources, …). */
export function CreateOverlay({
  title,
  hint,
  open,
  onClose,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn("fixed inset-0 z-40 overflow-y-auto bg-bg")}
    >
      <div className="mx-auto max-w-xl px-6 py-10 md:py-16">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
            {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
