import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Icon className="size-5 text-faint" aria-hidden />
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="max-w-sm text-[13px] text-faint">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
