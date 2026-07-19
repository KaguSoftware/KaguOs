"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Pencil, Plus, X } from "lucide-react";
import {
  dismissAnnouncement,
  postAnnouncement,
  updateAnnouncement,
} from "@/lib/actions/announcements";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/lib/types";

type Tone = "info" | "primary" | "warning";

const TONE: Record<Tone, string> = {
  info: "border-info/30 bg-info/10",
  primary: "border-primary/30 bg-primary/10",
  warning: "border-amber/30 bg-amber/10",
};

const ICON_TONE: Record<Tone, string> = {
  info: "text-info",
  primary: "text-primary-dim",
  warning: "text-amber",
};

const TONE_OPTIONS: { key: Tone; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "primary", label: "Highlight" },
  { key: "warning", label: "Heads-up" },
];

export function AnnouncementHero({
  announcement,
  isAdmin,
}: {
  announcement: Announcement | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<Tone>("info");
  // The id being edited, or null when composing a new one. This is what makes
  // "edit" a real edit rather than a replace — see editingId use in save().
  const [editingId, setEditingId] = useState<string | null>(null);

  function save() {
    const text = body.trim();
    if (!text) return;
    run(
      () =>
        editingId
          ? updateAnnouncement(editingId, text, tone)
          : postAnnouncement(text, tone),
      {
        success: editingId ? "Announcement updated." : "Announcement posted.",
        onSuccess: () => {
          setBody("");
          setEditingId(null);
          setComposing(false);
          router.refresh();
        },
      }
    );
  }

  /**
   * Open the composer on an existing announcement (edit) or blank (new).
   *
   * Editing used to be "compose with a head start": it posted, and posting
   * retires the active row and inserts a new one. So correcting a typo reset
   * created_at and reassigned created_by. Now the id is carried through and the
   * row is updated in place.
   */
  function openComposer(target: Announcement | null) {
    setEditingId(target?.id ?? null);
    setBody(target?.body ?? "");
    setTone(target?.tone ?? "info");
    setComposing(true);
  }

  // Nothing to show and no reason to offer composing → render nothing.
  if (!announcement && !isAdmin) return null;

  if (composing) {
    return (
      <div className="mb-6 rounded-lg border border-line bg-surface p-3">
        <Textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Announce something to the whole team…"
          maxLength={500}
          rows={2}
          aria-label={editingId ? "Edit announcement" : "New announcement"}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTone(t.key)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors duration-150",
                  tone === t.key
                    ? "border-primary/40 bg-primary/10 text-primary-dim"
                    : "border-line text-muted hover:border-line-strong hover:text-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setComposing(false);
                setEditingId(null);
              }}
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
              {editingId ? "Save" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!announcement) {
    // Admin, nothing posted → a quiet way in.
    return (
      <button
        type="button"
        onClick={() => openComposer(null)}
        className="mb-6 flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-4 py-2.5 text-[13px] text-faint transition-colors duration-150 hover:border-line-strong hover:text-muted"
      >
        <Plus className="size-3.5" aria-hidden />
        Post an announcement to the team
      </button>
    );
  }

  return (
    <div
      className={cn(
        "mb-6 flex items-start gap-3 rounded-lg border px-4 py-3",
        TONE[announcement.tone]
      )}
    >
      <Megaphone
        className={cn("mt-0.5 size-4 shrink-0", ICON_TONE[announcement.tone])}
        aria-hidden
      />
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-ink">
        {announcement.body}
      </p>
      {isAdmin && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => openComposer(announcement)}
            title="Edit"
            aria-label="Edit announcement"
            className="rounded p-1 text-faint transition-colors hover:text-ink"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => openComposer(null)}
            title="New announcement"
            aria-label="New announcement"
            className="rounded p-1 text-faint transition-colors hover:text-ink"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => dismissAnnouncement(announcement.id), {
                success: "Announcement retired.",
                onSuccess: () => router.refresh(),
              })
            }
            title="Retire"
            aria-label="Retire announcement"
            className="rounded p-1 text-faint transition-colors hover:text-danger"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
