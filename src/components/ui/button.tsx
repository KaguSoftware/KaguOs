"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-ink font-medium hover:bg-primary-dim active:bg-primary-dim",
  outline:
    "border border-line-strong text-ink hover:bg-raised active:bg-raised",
  ghost: "text-muted hover:text-ink hover:bg-raised",
  danger:
    "border border-danger/40 text-danger hover:bg-danger/15 active:bg-danger/15",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 gap-1.5 rounded-md px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-md px-3.5 text-sm",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "outline", size = "md", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors duration-150",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

/** Submit button for server-action forms — shows pending state automatically. */
export function SubmitButton({
  children,
  disabled,
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending || disabled}
      aria-busy={pending}
      {...props}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Destructive action with an inline two-step confirm (no modal). */
export function ConfirmButton({
  children,
  confirmLabel = "Click again to confirm",
  onConfirm,
  ...props
}: ButtonProps & { confirmLabel?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <Button
      variant="danger"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setArmed(false);
        onConfirm();
      }}
      {...props}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
