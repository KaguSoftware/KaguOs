"use client";

import { useEffect, useRef, useState } from "react";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn } from "@/lib/utils";

/**
 * A small, CURATED emoji grid — not a full picker.
 *
 * The status emoji used to be a bare 4-character text input, the last un-typed
 * control in an app whose rule is that every control is custom and typed. It was
 * also the worst possible field to type into on a phone, where reaching an emoji
 * means opening a separate keyboard.
 *
 * Deliberately ~40 work-relevant emoji rather than the full Unicode set: the
 * whole table would be a large payload and a search box to maintain, for a field
 * that holds one character in a sidebar. The grid is a SHORTCUT, not a
 * restriction — the caller keeps a text input alongside it for anything not
 * here, exactly as STATUS_PRESETS are shortcuts rather than a fixed vocabulary.
 *
 * ⚠️ The first row mirrors STATUS_PRESETS (types.ts). If a preset's emoji
 * changes, change it here too, or the picker and the chips will disagree about
 * what "Working" looks like.
 */
const GROUPS: { label: string; emoji: string[] }[] = [
  {
    // Every preset's emoji, so picking a preset's look never needs typing.
    label: "Statuses",
    emoji: ["🛠️", "🧠", "📅", "☕", "🍜", "🚶", "🛋️", "😴", "🌙", "💬"],
  },
  {
    label: "Working",
    emoji: ["💻", "📝", "🔍", "🐛", "🚀", "📊", "🎯", "🔥", "📞", "✅"],
  },
  {
    label: "Away",
    emoji: ["🏠", "✈️", "🚗", "🏥", "🤒", "🎓", "🍽️", "🏃", "💤", "🌴"],
  },
  {
    label: "Mood",
    emoji: ["🙂", "😅", "🤯", "🎧", "👀", "🤝", "🎉", "☠️", "🧊", "⚡"],
  },
];

export function EmojiPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const side = usePopoverSide(rootRef, open);

  // Same dismissal contract as every other popover in the app.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Status emoji: ${value}` : "Pick a status emoji"}
        className={cn(
          "flex size-9 items-center justify-center rounded-md border border-line bg-raised text-base",
          "transition-colors duration-150 hover:border-line-strong",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        {value || <span className="text-[13px] text-faint">🙂</span>}
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-20 w-max animate-pop-in rounded-md border border-line bg-raised/90 p-2 shadow-lg shadow-black/40 backdrop-blur-md",
            side === "top" ? "bottom-full mb-1 origin-bottom" : "top-full mt-1 origin-top"
          )}
        >
          <div className="space-y-2">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
                  {group.label}
                </p>
                <div className="grid grid-cols-10 gap-0.5">
                  {group.emoji.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={emoji}
                      aria-pressed={value === emoji}
                      onClick={() => {
                        onChange(emoji);
                        setOpen(false);
                      }}
                      className={cn(
                        "grid size-7 place-items-center rounded text-base",
                        "transition-[background-color,transform] duration-150 ease-mac active:scale-90",
                        value === emoji ? "bg-primary/15" : "hover:bg-surface"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Clearing is a real intent — a status can be text-only. */}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full border-t border-line pt-1.5 text-left text-[11px] text-muted transition-colors duration-150 hover:text-ink"
            >
              No emoji
            </button>
          )}
        </div>
      )}
    </div>
  );
}
