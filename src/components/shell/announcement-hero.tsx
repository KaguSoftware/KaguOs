"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, X } from "lucide-react";
import {
  dismissAnnouncement,
  postAnnouncement,
} from "@/lib/actions/announcements";
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

  function post() {
    const text = body.trim();
    if (!text) return;
    run(() => postAnnouncement(text, tone), {
      success: "Announcement posted.",
      onSuccess: () => {
        setBody("");
        setComposing(false);
        router.refresh();
      },
    });
  }

  // Nothing to show and no reason to offer composing → render nothing.
  if (!announcement && !isAdmin) return null;

  if (composing) {
    return (
      <div className="mb-6 rounded-lg border border-line bg-surface p-3">
        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Announce something to the whole team…"
          maxLength={500}
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
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
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="rounded-md px-2.5 py-1 text-xs text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={post}
              disabled={!body.trim() || pending}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-ink transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Post
            </button>
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
        onClick={() => setComposing(true)}
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
            onClick={() => setComposing(true)}
            title="Replace"
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
            className="rounded p-1 text-faint transition-colors hover:text-danger"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
