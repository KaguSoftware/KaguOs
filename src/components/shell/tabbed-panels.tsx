"use client";

import { useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TabStrip } from "@/components/ui/tab-strip";

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
  text,
}: {
  title: string;
  /** User-written title — keep its case (see PageHeader). */
  text?: boolean;
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
        text={text}
        description={description}
        action={activePanel?.action}
      />

      <TabStrip
        tabs={panels}
        active={active}
        onSelect={select}
        ariaLabel={ariaLabel}
      />

      {/* Every panel stays mounted (their client state survives a switch).
          Going from hidden to shown restarts a CSS animation, so the page-in
          fade plays on each switch without re-keying anything. */}
      {panels.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          hidden={tab.key !== active}
          className="motion-safe:animate-page-in"
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}
