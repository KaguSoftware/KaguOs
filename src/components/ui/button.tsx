"use client";

import { forwardRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useConfirm } from "@/lib/use-confirm";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "outline", size = "md", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={buttonClasses(variant, size, className)}
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
  const { armed, trigger } = useConfirm(onConfirm);

  return (
    <Button variant="danger" onClick={trigger} {...props}>
      {armed ? confirmLabel : children}
    </Button>
  );
}
