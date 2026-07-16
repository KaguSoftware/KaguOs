"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type Reminder = { id: string; text: string; done: boolean };

const KEY = "kagu:reminders:v1";

/**
 * Personal reminders, stored per-browser in localStorage — a lightweight
 * scratchpad that needs no table or server round-trip. Scoped by user id so
 * two people sharing a machine don't see each other's notes.
 */
export function Reminders({ userId }: { userId: string }) {
  const storageKey = `${KEY}:${userId}`;
  const [items, setItems] = useState<Reminder[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw) as Reminder[]);
    } catch {
      /* corrupt or unavailable storage — start empty */
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready, storageKey]);

  function add() {
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => [
      { id: crypto.randomUUID(), text, done: false },
      ...prev,
    ]);
    setDraft("");
  }

  const openCount = items.filter((i) => !i.done).length;

  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">Reminders</h2>
        <span className="font-mono text-xs text-faint">
          {openCount} open
        </span>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex items-center gap-2 border-b border-line px-4 py-2.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Note to self…"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex size-6 items-center justify-center rounded-md border border-line-strong text-muted transition-colors duration-150 hover:border-primary hover:text-primary-dim disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-muted"
          aria-label="Add reminder"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </form>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-faint">
          Nothing to remember yet — jot a quick note above.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2.5 px-4 py-2"
            >
              <Checkbox
                size="sm"
                checked={item.done}
                onChange={() =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === item.id ? { ...i, done: !i.done } : i
                    )
                  )
                }
              />
              <span
                className={
                  item.done
                    ? "flex-1 text-[13px] text-faint line-through"
                    : "flex-1 text-[13px] text-muted"
                }
              >
                {item.text}
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => prev.filter((i) => i.id !== item.id))
                }
                className="text-faint opacity-0 transition-opacity duration-150 hover:text-danger group-hover:opacity-100"
                aria-label="Remove reminder"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {openCount === 0 && items.length > 0 && (
        <p className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-xs text-primary-dim">
          <Check className="size-3.5" aria-hidden />
          All clear.
        </p>
      )}
    </section>
  );
}
