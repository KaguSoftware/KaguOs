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
 * The three strings this control shows, resolved by whoever renders it.
 *
 * `sizes` is keyed by TextSizeKey rather than being a list, because the ORDER
 * and the SCALES still come from TEXT_SIZES — only the four names are
 * translatable. That constant's `label` field stays English on purpose: the
 * teammate account page reads it as its source of truth, so translating it in
 * place would flip that page to Arabic. The keys sm/md/lg/xl are the join.
 */
export type TextSizeFormLabels = {
  group: string;
  note: string;
  sizes: Record<TextSizeKey, string>;
};

/**
 * Today's English, as the default — this control is shared with the teammate
 * account page, which has no locale and passes nothing.
 */
const TEXT_SIZE_LABELS_EN: TextSizeFormLabels = {
  group: "Text size",
  note: "Applies everywhere in KaguOs, on this browser only — each device you sign in on has its own. For bigger than this, your browser's zoom scales the layout too.",
  sizes: Object.fromEntries(
    TEXT_SIZES.map((s) => [s.key, s.label])
  ) as Record<TextSizeKey, string>,
};

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
export function TextSizeForm({
  current,
  labels = TEXT_SIZE_LABELS_EN,
}: {
  current: TextSizeKey;
  labels?: TextSizeFormLabels;
}) {
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
        aria-label={labels.group}
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
                  it stays honest whatever the page is currently set to. Latin
                  "Aa" in both languages: it's a type specimen, and the sizes it
                  sells are the page's, not this glyph's. */}
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
                {labels.sizes[size.key]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
        {labels.note}
      </p>
    </div>
  );
}
