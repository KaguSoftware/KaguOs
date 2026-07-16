import Link from "next/link";
import { cn } from "@/lib/utils";

export function SectionTabs({
  tabs,
  active,
}: {
  tabs: { href: string; label: string; key: string }[];
  active: string;
}) {
  return (
    <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Subsections">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-150",
            tab.key === active
              ? "border-primary-dim font-medium text-ink"
              : "border-transparent text-muted hover:border-line-strong hover:text-ink"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
