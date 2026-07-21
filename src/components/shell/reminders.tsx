"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, User, Users, X } from "lucide-react";
import {
  addReminder,
  deleteReminder,
  toggleReminder,
} from "@/lib/actions/reminders";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useAction } from "@/lib/use-action";
import { cn, formatDate, todayInIstanbul } from "@/lib/utils";
import type { MembersMap, Reminder } from "@/lib/types";

/**
 * Personal + team reminders in one place. Personal ones are yours alone;
 * "Share" posts a team reminder everyone can see, tick, and clear.
 *
 * All mutations are OPTIMISTIC against local state — the checkbox flips (or a
 * row disappears) instantly and the server reconciles in the background. No
 * full-page refresh on every tick, so it stays snappy.
 */
export function Reminders({
  reminders,
  members,
  meId,
}: {
  reminders: Reminder[];
  members: MembersMap;
  meId: string;
}) {
  const router = useRouter();
  const { run } = useAction();
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<Reminder[]>(reminders);

  // Reconcile if the server sends a fresh list (e.g. another tab added one).
  // Adjusted during render rather than in an effect: an effect would commit the
  // stale list first and re-render, flashing a just-ticked reminder back to
  // un-ticked for a frame. See board.tsx for the same pattern.
  const [seen, setSeen] = useState(reminders);
  if (seen !== reminders) {
    setSeen(reminders);
    setItems(reminders);
  }

  const pending = false;
  const openCount = items.filter((r) => !r.done).length;

  /**
   * Dated first, soonest first; undated keep their existing order at the end.
   *
   * `todayInIstanbul()` (not the device clock) decides overdue — two people
   * looking at the same team reminder must agree on whether it has slipped.
   */
  const today = todayInIstanbul();
  const sorted = [...items].sort((a, b) => {
    if (a.due_on && b.due_on) return a.due_on.localeCompare(b.due_on);
    if (a.due_on) return -1;
    if (b.due_on) return 1;
    return 0;
  });

  /**
   * Who the next reminder is for, chosen BEFORE typing.
   *
   * It used to be inferred from which button you pressed — same input, two
   * buttons, and Enter silently meant "personal". So the difference between a
   * private note and pinging all 8 people was a button you might not have
   * noticed, with no undo. Now the scope is a visible, deliberate state and the
   * submit button says what it will do.
   */
  const [scope, setScope] = useState<"personal" | "team">("personal");

  /** Optional deadline for the reminder being composed. "" = undated. */
  const [due, setDue] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setDue("");
    setDateOpen(false);
    // Adds still refresh (we need the server-generated id), but the input is
    // already cleared so it doesn't feel blocking.
    run(() => addReminder(text, scope, due || null), {
      success: scope === "team" ? "Shared with the team." : undefined,
      onSuccess: () => router.refresh(),
    });
  }

  function toggle(r: Reminder) {
    const next = !r.done;
    setItems((prev) =>
      prev.map((i) => (i.id === r.id ? { ...i, done: next } : i))
    );
    run(() => toggleReminder(r.id, next), {
      rollback: () =>
        setItems((prev) =>
          prev.map((i) => (i.id === r.id ? { ...i, done: r.done } : i))
        ),
    });
  }

  function remove(r: Reminder) {
    setItems((prev) => prev.filter((i) => i.id !== r.id));
    run(() => deleteReminder(r.id), {
      rollback: () => setItems((prev) => [r, ...prev]),
    });
  }

  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">Reminders</h2>
        <span className="font-mono text-xs text-faint">{openCount} open</span>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2 border-b border-line px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={scope === "team" ? "Tell the whole team…" : "Note to self…"}
          maxLength={300}
          aria-label="New reminder"
          className="h-8 w-full min-w-0 sm:w-auto sm:flex-1"
        />
        {/* On a phone the field gets its own row and the controls share the one
            below it — at 375px a flex-1 input squeezed beside both collapsed to
            a sliver. `sm:contents` DISSOLVES this wrapper from `sm` up, so the
            desktop row is byte-identical to what it was: same flex parent, same
            children, same widths. That matters more than it looks — the whole
            row was tuned to not shift by a pixel when you toggle scope. */}
        <div className="flex w-full items-center gap-2 sm:contents">
        {/* Scope is picked here, before submit — so Enter can't surprise you. */}
        <div
          className="flex flex-1 shrink-0 overflow-hidden rounded-md border border-line sm:flex-none"
          role="group"
          aria-label="Who this reminder is for"
        >
          {/* The icon renders on BOTH chips, selected or not — showing it only
              on the active one changed the group's width on every toggle, and
              the input beside it is flex-1, so the whole row shifted. */}
          {(["personal", "team"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              // Fixed width per chip: "Just me" and "Team" are different
              // lengths, so letting them size to content moved the group (and
              // with it the flex-1 input) on every toggle.
              className={cn(
                // flex-1 on phones so the pair fills its row; the fixed w-19
                // returns at `sm` — see the comment below on why it's fixed.
                "inline-flex flex-1 items-center justify-center gap-1 py-1 text-xs transition-colors duration-150 sm:w-19 sm:flex-none",
                scope === s
                  ? "bg-raised text-ink"
                  : "text-faint hover:bg-raised/60 hover:text-muted"
              )}
            >
              {s === "team" ? (
                <Users className="size-3 shrink-0" aria-hidden />
              ) : (
                <User className="size-3 shrink-0" aria-hidden />
              )}
              {s === "team" ? "Team" : "Just me"}
            </button>
          ))}
        </div>
        {/* Label stays "Add", and the variant stays `outline`, in both modes.
            Swapping the label resized the button; swapping the variant to
            `primary` ALSO resized it, because outline carries a 1px border and
            primary doesn't — 2px of shift on every toggle, passed straight to
            the flex-1 input. The chip beside it already says who it's for. */}
        {/* Optional deadline. A FIXED-WIDTH trigger showing either the date or
            a calendar glyph — the same anti-shift rule as the scope chips above:
            a control that resizes when it gains a value would move the flex-1
            input beside it. Most reminders stay undated; this is a shortcut, not
            a required field. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setDateOpen((v) => !v)}
            aria-expanded={dateOpen}
            aria-label={due ? `Due ${due}` : "Set a due date"}
            title={due ? `Due ${due}` : "Set a due date"}
            className={cn(
              "inline-flex h-8 w-19 items-center justify-center gap-1 rounded-md border text-xs transition-colors duration-150",
              due
                ? "border-primary/40 bg-primary/10 text-ink"
                : "border-line text-faint hover:border-line-strong hover:text-muted"
            )}
          >
            <CalendarDays className="size-3 shrink-0" aria-hidden />
            {due ? formatDate(due) : "No date"}
          </button>
          {dateOpen && (
            <div className="absolute right-0 top-full z-20 mt-1">
              <DatePicker
                key={due || "empty"}
                name="reminder_due"
                defaultValue={due}
                placeholder="Pick a date"
                onChange={(iso) => {
                  setDue(iso);
                  setDateOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={!draft.trim() || pending}
          title={
            scope === "team"
              ? "Share with the whole team"
              : "Add a private reminder"
          }
        >
          <Plus className="size-3.5" aria-hidden />
          Add
        </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-faint">
          Nothing to remember yet — jot a note, or Share one with the team.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((item) => {
            const sharer =
              item.scope === "team" && item.created_by
                ? members[item.created_by]
                : null;
            // A done reminder can't be late — closing it is the point.
            const overdue = !item.done && !!item.due_on && item.due_on < today;
            return (
              <li key={item.id} className="group flex items-center gap-2.5 px-4 py-2">
                <Checkbox
                  size="sm"
                  checked={item.done}
                  onChange={() => toggle(item)}
                />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px]",
                      item.done ? "text-faint line-through" : "text-muted"
                    )}
                  >
                    {item.text}
                  </span>
                  {/* Due date. `danger` once past — the same state vocabulary
                      the debug board uses for an overdue task, not a new one. */}
                  {item.due_on && (
                    <span
                      title={overdue ? `Was due ${item.due_on}` : `Due ${item.due_on}`}
                      className={cn(
                        "shrink-0 whitespace-nowrap font-mono text-[10px]",
                        item.done
                          ? "text-faint"
                          : overdue
                            ? "text-danger"
                            : "text-faint"
                      )}
                    >
                      {formatDate(item.due_on)}
                    </span>
                  )}
                  {item.scope === "team" && (
                    <span
                      title={sharer ? `Shared by ${sharer.name}` : "Team reminder"}
                      style={
                        sharer
                          ? {
                              color: sharer.color,
                              borderColor: `color-mix(in oklch, ${sharer.color} 30%, transparent)`,
                              backgroundColor: `color-mix(in oklch, ${sharer.color} 12%, transparent)`,
                            }
                          : undefined
                      }
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[11px]",
                        !sharer && "border-primary/25 bg-primary/10 text-primary-dim"
                      )}
                    >
                      <Users className="size-2.5" aria-hidden />
                      {item.created_by === meId ? "you" : (sharer?.name?.split(" ")[0] ?? "team")}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="text-faint opacity-0 transition-opacity duration-150 hover:text-danger group-hover:opacity-100"
                  aria-label="Remove reminder"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
