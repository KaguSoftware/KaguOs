"use client";

import { useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/utils";

export type TabPanel = {
  key: string;
  label: string;
  /** Header action for this tab (e.g. a "New …" button). Optional. */
  action?: React.ReactNode;
  /** Pre-rendered (usually server) content for this tab. */
  content: React.ReactNode;
};

/**
 * Client-side tab switcher that owns the page header. Panels — and their
 * per-tab header actions — are rendered up front (on the server) and passed
 * in; switching is pure local state, so it's instant with no navigation or
 * refetch. The URL reflects the active tab (`?tab=…`) for refresh / deep-links,
 * but changing tabs never hits the router.
 *
 * The first tab's key is the default and omits the query param.
 */
export function TabbedPanels({
  title,
  description,
  panels,
  ariaLabel,
}: {
  title: string;
  description?: string;
  panels: TabPanel[];
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const defaultKey = panels[0]?.key;

  const raw = params.get("tab");
  const initial = panels.some((p) => p.key === raw) ? (raw as string) : defaultKey;
  const [active, setActive] = useState<string>(initial);

  const select = useCallback(
    (key: string) => {
      setActive(key);
      const query = key === defaultKey ? "" : `?tab=${key}`;
      window.history.replaceState(null, "", `${pathname}${query}`);
    },
    [pathname, defaultKey]
  );

  const activePanel = panels.find((p) => p.key === active) ?? panels[0];

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={activePanel?.action}
      />

      <div
        role="tablist"
        aria-label={ariaLabel}
        className="mb-5 flex gap-1 border-b border-line"
      >
        {panels.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(tab.key)}
              className={cn(
                "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors duration-150",
                selected
                  ? "border-primary-dim font-medium text-ink"
                  : "border-transparent text-muted hover:border-line-strong hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {panels.map((tab) => (
        <div key={tab.key} role="tabpanel" hidden={tab.key !== active}>
          {tab.content}
        </div>
      ))}
    </>
  );
}
