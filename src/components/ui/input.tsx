import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full rounded-md border border-line bg-raised text-sm text-ink placeholder:text-muted transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong disabled:pointer-events-none disabled:opacity-50";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input ref={ref} className={cn(controlClasses, "h-9 px-3", className)} {...props} />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(controlClasses, "min-h-20 px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlClasses, "h-9 px-2.5", className)} {...props} />
  );
});
