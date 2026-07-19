"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pin, Plus, StickyNote, Trash2, X } from "lucide-react";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  addNote,
  deleteMeeting,
  deleteNote,
  setNotePinned,
} from "@/lib/actions/comms";
import { useAction } from "@/lib/use-action";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import type { CommsMeeting, CommsNote, MembersMap } from "@/lib/types";

/**
 * Meetings — the RECORD half of internal comms. What happened, when, who was
 * there, what came of it. Reading one should not require opening it, so the
 * summary sits on the row and only the long notes are behind the expander.
 */
export function MeetingList({
  meetings,
  members,
}: {
  meetings: CommsMeeting[];
  members: MembersMap;
}) {
  const { run } = useAction();
  const [items, setItems] = useState(meetings);
  const [open, setOpen] = useState<string | null>(null);

  // Adopt server refreshes during render — see board.tsx for why not an effect.
  const [seen, setSeen] = useState(meetings);
  if (seen !== meetings) {
    setSeen(meetings);
    setItems(meetings);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        <EmptyState
          icon={CalendarDays}
          title="No meetings recorded"
          hint="Write down what was discussed and decided, so the next person asking doesn't have to reconstruct it."
          action={
            <LinkButton href="/comms/meetings/new">
              <Plus className="size-3.5" aria-hidden />
              Record a meeting
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <ul className="divide-y divide-line">
        {items.map((m) => {
          const expanded = open === m.id;
          const people = m.attendees
            .map((id) => members[id])
            .filter(Boolean)
            .map((p) => p.name.split(" ")[0]);
          return (
            <li key={m.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : m.id)}
                  aria-expanded={expanded}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-ink">
                    {m.title}
                  </p>
                  {m.summary && (
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">
                      {m.summary}
                    </p>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  {people.length > 0 && (
                    <span className="hidden text-xs text-faint sm:inline">
                      {people.slice(0, 3).join(", ")}
                      {people.length > 3 && ` +${people.length - 3}`}
                    </span>
                  )}
                  <span className="font-mono text-xs text-faint">
                    {formatDate(m.held_on)}
                  </span>
                </div>
              </div>

              {expanded && (
                <div className="mt-2 flex items-start justify-between gap-4">
                  <p className="max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
                    {m.notes || "No notes."}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <LinkButton
                      href={`/comms/meetings/${m.id}`}
                      variant="ghost"
                      size="sm"
                    >
                      Edit
                    </LinkButton>
                    <ConfirmButton
                      size="sm"
                      confirmLabel="Really delete?"
                      onConfirm={() => {
                        const before = items;
                        setItems((prev) => prev.filter((i) => i.id !== m.id));
                        run(() => deleteMeeting(m.id), {
                          rollback: () => setItems(before),
                          success: "Meeting removed.",
                        });
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </ConfirmButton>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Notes — the SCRATCHPAD half. One field, one pin, nothing else.
 *
 * This is Kemal's "things to write down in case they come up later", and the
 * design constraint is that adding one must be cheaper than not bothering.
 * That's why it's an inline row rather than a create page: a title, a category
 * and a Save button would each be a reason to skip it.
 */
export function NoteList({
  notes,
  members,
  meId,
}: {
  notes: CommsNote[];
  members: MembersMap;
  meId: string;
}) {
  const router = useRouter();
  const { run } = useAction();
  const [items, setItems] = useState(notes);
  const [draft, setDraft] = useState("");

  const [seen, setSeen] = useState(notes);
  if (seen !== notes) {
    setSeen(notes);
    setItems(notes);
  }

  // Pinned first, then newest. Sorted here rather than in SQL so an optimistic
  // pin re-orders instantly instead of waiting for a round-trip.
  const sorted = [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    run(() => addNote(text), { onSuccess: () => router.refresh() });
  }

  function togglePin(note: CommsNote) {
    const next = !note.pinned;
    setItems((prev) =>
      prev.map((i) => (i.id === note.id ? { ...i, pinned: next } : i))
    );
    run(() => setNotePinned(note.id, next), {
      rollback: () =>
        setItems((prev) =>
          prev.map((i) => (i.id === note.id ? { ...i, pinned: note.pinned } : i))
        ),
    });
  }

  function remove(note: CommsNote) {
    setItems((prev) => prev.filter((i) => i.id !== note.id));
    run(() => deleteNote(note.id), {
      rollback: () => setItems((prev) => [note, ...prev]),
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2 border-b border-line px-4 py-2.5 sm:flex-row sm:items-center"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Something worth remembering later…"
          maxLength={2000}
          aria-label="New note"
          className="h-8 w-full min-w-0 sm:w-auto sm:flex-1"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={!draft.trim()}
        >
          <Plus className="size-3.5" aria-hidden />
          Note it
        </Button>
      </form>

      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-faint">
          Nothing noted yet. Anything here is visible to everyone in Comms.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((note) => {
            const author = note.created_by ? members[note.created_by] : null;
            return (
              <li key={note.id} className="group flex items-start gap-2.5 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => togglePin(note)}
                  aria-pressed={note.pinned}
                  aria-label={note.pinned ? "Unpin note" : "Pin note"}
                  className={cn(
                    "mt-0.5 shrink-0 transition-colors duration-150",
                    note.pinned
                      ? "text-primary-dim"
                      : "text-faint/50 hover:text-muted"
                  )}
                >
                  <Pin
                    className={cn("size-3.5", note.pinned && "fill-current")}
                    aria-hidden
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
                    {note.body}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {author
                      ? note.created_by === meId
                        ? "you"
                        : author.name.split(" ")[0]
                      : "someone"}{" "}
                    · {formatRelative(note.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(note)}
                  aria-label="Remove note"
                  className="text-faint opacity-0 transition-opacity duration-150 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Shared icon for the Notes tab's empty affordance. */
export const NotesIcon = StickyNote;
