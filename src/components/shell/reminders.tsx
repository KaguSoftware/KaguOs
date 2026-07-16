"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, X } from "lucide-react";
import {
  addReminder,
  deleteReminder,
  toggleReminder,
} from "@/lib/actions/reminders";
import { Checkbox } from "@/components/ui/checkbox";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { MembersMap, Reminder } from "@/lib/types";

/**
 * Personal + team reminders in one place. Personal ones are yours alone;
 * "Share" posts a team reminder everyone can see, tick, and clear. Backed by
 * the reminders table (RLS-gated), optimistic-refreshed after each change.
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
  const { pending, run } = useAction();
  const [draft, setDraft] = useState("");

  const openCount = reminders.filter((r) => !r.done).length;

  function submit(scope: "personal" | "team") {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    run(() => addReminder(text, scope), {
      success: scope === "team" ? "Shared with the team." : undefined,
      onSuccess: () => router.refresh(),
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
          submit("personal");
        }}
        className="flex items-center gap-1.5 border-b border-line px-4 py-2.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Note to self…"
          maxLength={300}
          disabled={pending}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => submit("team")}
          disabled={!draft.trim() || pending}
          title="Share with the whole team"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-line-strong px-1.5 text-xs text-muted transition-colors duration-150 hover:border-primary hover:text-primary-dim disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-muted"
        >
          <Users className="size-3" aria-hidden />
          Share
        </button>
        <button
          type="submit"
          disabled={!draft.trim() || pending}
          title="Add a personal reminder"
          aria-label="Add reminder"
          className="inline-flex size-6 items-center justify-center rounded-md border border-line-strong text-muted transition-colors duration-150 hover:border-primary hover:text-primary-dim disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-muted"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </form>

      {reminders.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-faint">
          Nothing to remember yet — jot a note, or Share one with the team.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {reminders.map((item) => {
            const sharer =
              item.scope === "team" && item.created_by
                ? members[item.created_by]
                : null;
            return (
              <li key={item.id} className="group flex items-center gap-2.5 px-4 py-2">
                <Checkbox
                  size="sm"
                  checked={item.done}
                  disabled={pending}
                  onChange={() =>
                    run(() => toggleReminder(item.id, !item.done), {
                      onSuccess: () => router.refresh(),
                    })
                  }
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
                  {item.scope === "team" && (
                    <span
                      title={sharer ? `Shared by ${sharer.name}` : "Team reminder"}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-px text-[11px] text-primary-dim"
                    >
                      <Users className="size-2.5" aria-hidden />
                      {item.created_by === meId ? "you" : (sharer?.name?.split(" ")[0] ?? "team")}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => deleteReminder(item.id), {
                      onSuccess: () => router.refresh(),
                    })
                  }
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
