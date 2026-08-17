"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Pin, Plus, X } from "lucide-react";
import { pinNote, unpinNote, updateNote } from "@/lib/actions/pinboard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";
import {
  AUDIENCE_OPTIONS,
  DEFAULT_NOTE_COLOR,
  NOTE_COLORS,
  audienceSummary,
  nextNoteColor,
  noteColorCss,
  type AudienceToken,
} from "@/lib/pinboard";
import { cn } from "@/lib/utils";
import type { MembersMap, PinboardNote } from "@/lib/types";

const MAX_BODY = 280;
/** Show the counter only once it's close enough to matter. */
const COUNTER_FROM = 40;

/**
 * The dashboard pinboard: short standing notes — "keep this in mind" — pinned
 * by admins and addressed to a slice of the company.
 *
 * It is NOT the announcement banner and not the reminders list. An announcement
 * is one thing the company is told right now; a reminder is a task someone
 * ticks off. A pinned note is context that stays up and is never "done" — so it
 * has no state to complete, and the only lifecycle it has is being unpinned.
 *
 * Who sees which note is decided by RLS (0065), not here. This component simply
 * renders what came back, and shows the audience on each note so an admin — who
 * reads every note whatever its audience — can tell which ones are addressed to
 * someone else.
 */
export function Pinboard({
  notes,
  members,
  isAdmin,
}: {
  notes: PinboardNote[];
  members: MembersMap;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [items, setItems] = useState<PinboardNote[]>(notes);

  // Reconcile during render, not in an effect — an effect commits the stale
  // list first and re-renders, flashing an unpinned note back onto the board
  // for a frame. Same pattern as reminders.tsx and board.tsx.
  const [seen, setSeen] = useState(notes);
  if (seen !== notes) {
    setSeen(notes);
    setItems(notes);
  }

  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [color, setColor] = useState(DEFAULT_NOTE_COLOR);
  const [audiences, setAudiences] = useState<AudienceToken[]>(["everyone"]);

  function openComposer(target: PinboardNote | null) {
    setEditingId(target?.id ?? null);
    setBody(target?.body ?? "");
    // A new note starts on the color after the most recent one, so two notes
    // pinned back to back don't come out the same shade.
    setColor(target?.color ?? nextNoteColor(items[0]?.color));
    setAudiences(
      (target?.audiences as AudienceToken[] | undefined)?.length
        ? (target!.audiences as AudienceToken[])
        : ["everyone"]
    );
    setComposing(true);
  }

  function closeComposer() {
    setComposing(false);
    setEditingId(null);
    setBody("");
  }

  /**
   * Toggle one audience.
   *
   * "Everyone" is EXCLUSIVE in both directions: picking it clears the narrower
   * audiences, and picking a narrower one clears it. They can technically
   * coexist in the column, but the combination is incoherent — a narrower
   * audience cannot subtract anyone from "everyone", so a note tagged both
   * would claim to be for the trainees while going to the whole company.
   */
  function toggleAudience(token: AudienceToken) {
    setAudiences((prev) => {
      if (token === "everyone") return ["everyone"];
      const without = prev.filter((t) => t !== "everyone");
      return without.includes(token)
        ? // Never empty it — the action refuses an audience-less note, and an
          // empty picker gives no hint why the button went dead.
          without.length === 1
          ? without
          : without.filter((t) => t !== token)
        : [...without, token];
    });
  }

  function save() {
    const text = body.trim();
    if (!text) return;
    run(
      () =>
        editingId
          ? updateNote(editingId, text, color, audiences)
          : pinNote(text, color, audiences),
      {
        success: editingId ? "Note updated." : "Note pinned.",
        onSuccess: () => {
          closeComposer();
          router.refresh();
        },
      }
    );
  }

  function unpin(note: PinboardNote) {
    setItems((prev) => prev.filter((n) => n.id !== note.id));
    run(() => unpinNote(note.id), {
      rollback: () =>
        setItems((prev) =>
          // Back where it was, not at the front — the board is ordered newest
          // first, and a failed unpin that reorders the board looks like a
          // second bug on top of the first.
          [...prev, note].sort((a, b) =>
            b.created_at.localeCompare(a.created_at)
          )
        ),
    });
  }

  // Nothing pinned and no way to pin → the panel is furniture. Render nothing.
  if (items.length === 0 && !isAdmin && !composing) return null;

  const remaining = MAX_BODY - body.trim().length;

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Pin className="size-3.5 text-faint" aria-hidden />
          Pinboard
        </h2>
        {isAdmin && !composing && items.length > 0 && (
          <button
            type="button"
            onClick={() => openComposer(null)}
            className="inline-flex items-center gap-1 text-[calc(12px*var(--text-scale,1))] text-faint transition-colors duration-150 hover:text-ink"
          >
            <Plus className="size-3.5" aria-hidden />
            Pin a note
          </button>
        )}
      </header>

      {composing && (
        <div className="border-b border-line px-4 py-3">
          <Textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Something to keep in mind…"
            maxLength={MAX_BODY}
            rows={2}
            aria-label={editingId ? "Edit note" : "New note"}
          />

          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[calc(11px*var(--text-scale,1))] uppercase tracking-wide text-faint">
                Color
              </span>
              <div
                role="radiogroup"
                aria-label="Note color"
                className="flex flex-wrap gap-1.5"
              >
                {NOTE_COLORS.map((c) => {
                  const selected = color === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={c.label}
                      title={c.label}
                      onClick={() => setColor(c.key)}
                      style={{ backgroundColor: c.css }}
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full transition-transform duration-150 ease-mac hover:scale-110",
                        selected &&
                          "ring-2 ring-ink ring-offset-2 ring-offset-surface"
                      )}
                    >
                      {selected && (
                        <Check className="size-2.5 text-primary-ink" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[calc(11px*var(--text-scale,1))] uppercase tracking-wide text-faint">
                Shows to
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCE_OPTIONS.map((a) => {
                  const on = audiences.includes(a.token);
                  return (
                    <button
                      key={a.token}
                      type="button"
                      aria-pressed={on}
                      title={a.hint}
                      onClick={() => toggleAudience(a.token)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[calc(12px*var(--text-scale,1))] transition-colors duration-150",
                        on
                          ? "border-primary/40 bg-primary/10 text-primary-dim"
                          : "border-line text-muted hover:border-line-strong hover:text-ink"
                      )}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
              {/* The one combination worth spelling out. Work membership
                  auto-grants Learn (0026), so "Kagu Learn" is very nearly the
                  whole company — an admin picking it to reach the trainees
                  would be picking the opposite of what they meant. */}
              {audiences.includes("learn") && (
                <p className="text-[calc(11px*var(--text-scale,1))] text-amber">
                  Heads up: everyone in Work is also in Learn, so this reaches
                  almost everyone. Use “Learn only” for the trainees.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  "font-mono text-[calc(11px*var(--text-scale,1))]",
                  remaining < 0 ? "text-danger" : "text-faint"
                )}
              >
                {remaining <= COUNTER_FROM ? `${remaining} left` : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeComposer}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={save}
                  disabled={!body.trim() || pending}
                >
                  {editingId ? "Save" : "Pin it"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        composing ? null : (
          // Admin, empty board → a quiet way in, matching the announcement
          // hero's dashed prompt rather than inventing a second empty style.
          <button
            type="button"
            onClick={() => openComposer(null)}
            className="flex w-full items-center justify-center gap-2 px-4 py-6 text-[calc(13px*var(--text-scale,1))] text-faint transition-colors duration-150 hover:text-muted"
          >
            <Plus className="size-3.5" aria-hidden />
            Pin a note the team shouldn’t forget
          </button>
        )
      ) : (
        <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((note) => {
            const css = noteColorCss(note.color);
            const audience = audienceSummary(note.audiences);
            const author = note.created_by ? members[note.created_by] : null;
            return (
              <li
                key={note.id}
                style={{
                  borderColor: `color-mix(in oklch, ${css} 30%, transparent)`,
                  backgroundColor: `color-mix(in oklch, ${css} 12%, transparent)`,
                }}
                className="group relative flex min-w-0 flex-col gap-2 rounded-lg border p-3"
              >
                <p className="min-w-0 whitespace-pre-wrap break-words text-[calc(13px*var(--text-scale,1))] text-ink">
                  {note.body}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1">
                  {/* The pin dot carries the note's color at full strength —
                      the tinted fill behind it is deliberately too weak to
                      identify a hue on its own. */}
                  <span
                    aria-hidden
                    style={{ backgroundColor: css }}
                    className="size-1.5 shrink-0 rounded-full"
                  />
                  {audience && (
                    <span
                      style={{
                        color: css,
                        borderColor: `color-mix(in oklch, ${css} 35%, transparent)`,
                      }}
                      className="inline-flex min-w-0 items-center rounded-full border px-1.5 py-px text-[calc(10px*var(--text-scale,1))]"
                    >
                      <span className="truncate">{audience}</span>
                    </span>
                  )}
                  {author && (
                    <span className="truncate text-[calc(10px*var(--text-scale,1))] text-faint">
                      {author.name.split(" ")[0]}
                    </span>
                  )}
                </div>

                {isAdmin && (
                  // Controls sit in the corner and fade in on hover — on touch,
                  // where there is no hover, focus-within still reveals them and
                  // they are always in the tab order.
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openComposer(note)}
                      title="Edit note"
                      aria-label="Edit note"
                      className="rounded p-1 text-faint transition-colors hover:text-ink"
                    >
                      <Pencil className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => unpin(note)}
                      title="Unpin note"
                      aria-label="Unpin note"
                      className="rounded p-1 text-faint transition-colors hover:text-danger"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
