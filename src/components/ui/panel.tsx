import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // min-w-0: panels are laid out as grid/flex items, whose automatic minimum
    // is their content. Without it a single long unbreakable line inside — a
    // truncating status, a URL, a wide table — widens the panel past its column
    // and takes the page's whole layout with it, which reads as a phone bug
    // rather than as the one long word that caused it.
    <section
      className={cn("min-w-0 rounded-lg border border-line bg-surface", className)}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
        className
      )}
    >
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {action}
    </header>
  );
}
