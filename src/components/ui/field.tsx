import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[calc(13px*var(--text-scale,1))] text-faint">{hint}</p>}
      {error && <p className="text-[calc(13px*var(--text-scale,1))] text-danger">{error}</p>}
    </div>
  );
}
