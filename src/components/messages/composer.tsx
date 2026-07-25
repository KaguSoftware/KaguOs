"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { ImagePlus, SendHorizontal, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LEN,
} from "@/lib/messages-shared";
import { cn } from "@/lib/utils";

export type Attachment = {
  file: File;
  previewUrl: string;
  width: number | null;
  height: number | null;
};

export type ComposerHandle = {
  /** Hand words and files back after a failed send. */
  restore: (text: string, files: Attachment[]) => void;
  focus: () => void;
};

/** Tallest the box grows before it starts scrolling instead. */
const MAX_HEIGHT_PX = 160;
/** Only warn about the length limit once it is actually in reach. */
const COUNTER_AT = MAX_MESSAGE_LEN * 0.9;

/** Natural size of a picked file, so a thumbnail can reserve its box. */
function measure(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * The chat composer, owning its own draft and attachments.
 *
 * WHY IT IS ITS OWN COMPONENT. `draft` used to be state on `MessageThread`,
 * whose render body also maps the entire message list inline with no memo
 * boundary. So every character typed re-rendered every bubble — and the per-row
 * work is not free: several `new Date()` plus a handful of `Intl` format calls
 * each. Measured, the Intl portion alone of one full pass over a page of history
 * costs milliseconds, on top of React reconciling thousands of elements with
 * zero bailouts. Typing now re-renders this subtree and nothing else.
 *
 * It also fixes the box itself, which never grew: `rows={1}` with a `min-h-9`
 * that exactly equalled one line box, and no `scrollHeight` logic anywhere, so
 * `max-h-40` was dead code and a second line scrolled the first out of a 36px
 * window while `resize-none` removed the manual escape hatch.
 */
export const Composer = forwardRef<
  ComposerHandle,
  {
    onSend: (text: string, files: Attachment[]) => void;
    /** Focus on mount — opening a chat should put the cursor where you type. */
    autoFocus?: boolean;
  }
>(function Composer({ onSend, autoFocus = false }, ref) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { error: toastError } = useToast();

  useImperativeHandle(ref, () => ({
    restore: (text, files) => {
      // Never overwrite words typed since the failure.
      setDraft((d) => (d.trim() ? d : text));
      setAttachments(files);
    },
    focus: () => boxRef.current?.focus(),
  }));

  useEffect(() => {
    if (autoFocus && document.visibilityState === "visible")
      boxRef.current?.focus();
  }, [autoFocus]);

  // Grow to fit, up to a cap, then scroll. Height is reset to `auto` first or
  // scrollHeight would only ever report the current (larger) box.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft]);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES_PER_MESSAGE - attachments.length;
    if (room <= 0) {
      toastError(`A message can carry ${MAX_IMAGES_PER_MESSAGE} images.`);
      return;
    }
    const picked = Array.from(files);
    if (picked.length > room) {
      toastError(
        `Only ${room} more image${room === 1 ? "" : "s"} fit — the rest were skipped.`
      );
    }
    const added: Attachment[] = [];
    for (const file of picked.slice(0, room)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toastError(`${file.name} isn't a PNG, JPEG, WebP or GIF.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toastError(`${file.name} is over 5MB.`);
        continue;
      }
      const size = await measure(file);
      added.push({
        file,
        previewUrl: URL.createObjectURL(file),
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
    }
    if (added.length > 0) setAttachments((prev) => [...prev, ...added]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function submit() {
    const clean = draft.trim();
    if (!clean && attachments.length === 0) return;
    // Cleared here, not by the parent: the send pipelines, so the box must be
    // ready for the next line immediately.
    setDraft("");
    setAttachments([]);
    if (fileRef.current) fileRef.current.value = "";
    onSend(clean, attachments);
  }

  const overrun = draft.length >= COUNTER_AT;

  return (
    <div className="border-t border-line pt-3">
      {attachments.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <li key={a.previewUrl} className="group relative">
              <Image
                src={a.previewUrl}
                alt={`Attached image ${i + 1}, ${a.file.name}`}
                width={a.width ?? 160}
                height={a.height ?? 100}
                unoptimized
                className="h-16 w-auto max-w-32 rounded-md border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                aria-label={`Remove ${a.file.name}`}
                // size-6 not size-5: a 20px control was under the 24px minimum,
                // and it overlaps the image it sits on.
                className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-line bg-surface text-faint transition-colors duration-150 hover:border-line-strong hover:text-danger"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className="flex items-end gap-2"
        // Ctrl+V a screenshot straight into the composer — scoped to this
        // container so it never hijacks a paste meant for the textarea's
        // text (a paste carrying no files falls through untouched).
        onPaste={(e) => {
          const files = e.clipboardData?.files;
          if (!files || files.length === 0) return;
          e.preventDefault();
          void addFiles(files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={attachments.length >= MAX_IMAGES_PER_MESSAGE}
          aria-label="Attach image"
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line text-faint transition-colors duration-150 hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          <ImagePlus className="size-4" aria-hidden />
        </button>
        <textarea
          ref={boxRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — scoped to this
            // textarea only, nothing global.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LEN}
          placeholder="Write a message…"
          aria-label="Write a message"
          aria-describedby="composer-hint"
          // Matches ui/input.tsx's controlClasses rather than hand-rolling them.
          // In particular NO `outline-none`: buttonClasses ships no focus ring of
          // its own, so the UA outline is this design system's focus indicator,
          // and killing it here made the composer the one input in the app with
          // no visible focus at all.
          className={cn(
            "min-h-9 flex-1 resize-none overflow-y-auto rounded-md border bg-raised px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong",
            overrun ? "border-amber" : "border-line"
          )}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() && attachments.length === 0}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
        >
          <SendHorizontal className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex items-baseline justify-between gap-3 px-1 pt-1.5">
        <p id="composer-hint" className="hidden text-xs text-faint md:block">
          Enter to send · Shift+Enter for a new line
        </p>
        {/* Silent until the limit is in reach — maxLength truncates a long paste
            with no explanation otherwise. */}
        {overrun && (
          <p className="ml-auto font-mono text-xs text-amber" aria-live="polite">
            {draft.length} / {MAX_MESSAGE_LEN}
          </p>
        )}
      </div>
    </div>
  );
});
