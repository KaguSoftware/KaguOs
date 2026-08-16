"use client";

import { useCallback, useState } from "react";
import {
  TEXT_SIZES,
  TEXT_SIZE_COOKIE,
  TEXT_SIZE_COOKIE_MAX_AGE,
  textScale,
  type TextSizeKey,
} from "@/lib/text-size";
import { cn } from "@/lib/utils";

/**
 * How big the interface reads. See lib/text-size.ts for why this is a cookie
 * and why it's per device.
 *
 * NO SERVER ACTION and no router.refresh(), for the same reason the sidebar's
 * collapse writes its own cookie: a pure display preference shouldn't cost a
 * round-trip, and here it also shouldn't cost a re-render — the page is meant
 * to resize under your cursor while you compare the options. So the click does
 * two things that agree: sets --text-scale on the document for right now, and
 * writes the cookie so the next hard load starts there. The inline property
 * outranks the layout's <style> until a reload replaces one with the other.
 *
 * Each option previews ITSELF: --text-scale is inlined into the font-size
 * utilities (globals.css), so overriding it on a button re-sizes that button's
 * label alone. Reading "Aa" at four sizes is the actual decision — a row of
 * equal-sized radio labels would make you guess and then hunt.
 */
export function TextSizeForm({ current }: { current: TextSizeKey }) {
  const [value, setValue] = useState(current);

  // useCallback, like the sidebar's setRail: writing document.cookie from a
  // bare function body is what the compiler's immutability rule is there to
  // catch, and an event handler is the one place it's the right thing to do.
  const choose = useCallback((key: TextSizeKey) => {
    setValue(key);
    document.documentElement.style.setProperty("--text-scale", `${textScale(key)}`);
    document.cookie = `${TEXT_SIZE_COOKIE}=${key}; path=/; max-age=${TEXT_SIZE_COOKIE_MAX_AGE}; SameSite=Lax`;
  }, []);

  return (
    <div className="space-y-3 p-4">
      <div
        role="radiogroup"
        aria-label="Text size"
        className="grid grid-cols-4 gap-1.5"
      >
        {TEXT_SIZES.map((size) => {
          const selected = value === size.key;
          return (
            <button
              key={size.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(size.key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border px-2 py-3",
                "transition-[color,background-color,border-color] duration-150 ease-mac",
                selected
                  ? "border-primary bg-raised text-ink"
                  : "border-line text-muted hover:border-line-strong hover:bg-raised hover:text-ink"
              )}
            >
              {/* The sample, at the size it's selling. Its own --text-scale, so
                  it stays honest whatever the page is currently set to. */}
              <span
                aria-hidden
                style={{ "--text-scale": size.scale } as React.CSSProperties}
                className="flex h-7 items-end text-base font-semibold"
              >
                Aa
              </span>
              {/* Fixed at 1: the four labels are a menu and must line up, even
                  though the samples above them deliberately don't. */}
              <span
                style={{ "--text-scale": 1 } as React.CSSProperties}
                className="text-[calc(11px*var(--text-scale,1))]"
              >
                {size.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
        Applies everywhere in KaguOs, on this browser only — each device you
        sign in on has its own. For bigger than this, your browser&apos;s zoom
        scales the layout too.
      </p>
    </div>
  );
}
