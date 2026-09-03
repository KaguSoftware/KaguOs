"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { accentForPath, accentVar } from "@/lib/section-accent";

/**
 * Publishes the current route's accent as `--section-accent` on the content
 * column, so anything rendered inside can colour itself by PLACE without being
 * handed a section prop.
 *
 * A wrapper rather than a `useEffect` on <html>: the variable has to be right
 * in the first paint, or every surface that uses it flashes the fallback on
 * each navigation. This renders during SSR like any client component, so the
 * markup arrives already carrying the colour.
 *
 * On a route with no section (/account) the property is simply not set, and
 * the :root fallback in globals.css takes over.
 */
export function SectionAccentScope({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const key = accentForPath(usePathname());
  return (
    <div
      className={className}
      style={key ? ({ "--section-accent": accentVar(key) } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
