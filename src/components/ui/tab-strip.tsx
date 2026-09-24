"use client";

import { useLayoutEffect, useRef } from "react";
import { CURRENT_ACCENT } from "@/lib/section-accent";
import { cn } from "@/lib/utils";

export type Tab<K extends string> = { key: K; label: string };

/**
 * The section sub-navigation under a PageHeader: UPPERCASE labels (fixed words
 * — DESIGN.md's casing rule) and ONE underline in the section's accent that
 * slides to the selected tab instead of each tab carrying its own border.
 *
 * The underline is positioned from the DOM, not from state: measuring into
 * state from a layout effect would be a second render per switch. A
 * ResizeObserver re-measures when the strip reflows (fonts landing, a label
 * changing), and the first placement skips the transition so it doesn't sweep
 * in from the left edge on load. Reduced motion: it simply jumps.
 */
export function TabStrip<K extends string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
  className,
}: {
  tabs: Tab<K>[];
  active: K;
  onSelect: (key: K) => void;
  ariaLabel: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    if (!list || !bar) return;
    const place = () => {
      const el = list.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
      if (!el) return;
      bar.style.transform = `translateX(${el.offsetLeft}px)`;
      bar.style.width = `${el.offsetWidth}px`;
      bar.style.opacity = "1";
      if (!bar.dataset.ready) {
        void bar.offsetWidth; // commit the first position before enabling the slide
        bar.dataset.ready = "1";
      }
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [active, tabs]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn("relative mb-5 flex gap-1 border-b border-line", className)}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            data-tab={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "cursor-pointer px-3 py-2.5 text-[calc(12px*var(--text-scale,1))] font-medium uppercase tracking-wide transition-colors duration-150",
              selected ? "text-ink" : "text-muted hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        );
      })}
      <span
        ref={barRef}
        aria-hidden
        className="pointer-events-none absolute -bottom-px left-0 h-0.5 w-0 rounded-full opacity-0 data-[ready]:transition-[transform,width] data-[ready]:duration-300 data-[ready]:ease-mac motion-reduce:transition-none"
        style={{ backgroundColor: CURRENT_ACCENT }}
      />
    </div>
  );
}
