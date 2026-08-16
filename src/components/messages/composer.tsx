"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { ImagePlus, SendHorizontal, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  ReplyRefBody,
  replySnippet,
  TaskRefBody,
} from "@/components/messages/message-refs";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LEN,
} from "@/lib/messages-shared";
import { cn } from "@/lib/utils";
import type { MessageReplyRef, MessageTaskRef } from "@/lib/types";

export type Attachment = {
  file: File;
  previewUrl: string;
  width: number | null;
  height: number | null;
};

/** The reply being composed: the ref the server needs + the name the chip
 *  shows (the composer has no members map of its own). */
export type ReplyDraft = MessageReplyRef & { senderName: string };

/** What a send carries besides words and images. */
export type SendRefs = {
  replyTo: ReplyDraft | null;
  task: MessageTaskRef | null;
};

export type ComposerHandle = {
  /** Hand words, files and refs back after a failed send. */
  restore: (text: string, files: Attachment[], refs?: SendRefs) => void;
  /** Pin the message being replied to above the box and focus it. */
  reply: (draft: ReplyDraft) => void;
  focus: () => void;
};

/** A JSON value persisted beside the text draft (reply target, task card). */
function readStored<T>(key: string | null): T | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

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
    onSend: (
      text: string,
      files: Attachment[],
      mentions: string[],
      refs: SendRefs
    ) => void;
    /** Focus on mount — opening a chat should put the cursor where you type. */
    autoFocus?: boolean;
    /**
     * Stable per-thread key for draft persistence. Half-typed messages used to
     * be destroyed by switching threads (or by a reload), which is punishing
     * when you left mid-sentence to go and check something.
     */
    draftKey?: string;
    /**
     * People who can be named with @. Group chat only — a DM's recipient is
     * already notified, so mentioning them would just double it. Absent = the
     * `@` key is ordinary text.
     */
    mentionable?: { id: string; name: string }[];
  }
>(function Composer(
  { onSend, autoFocus = false, draftKey, mentionable },
  ref
) {
  // Seeded from storage on mount, so the words are already there on first paint
  // rather than appearing a frame later.
  const [draft, setDraft] = useState(() => {
    if (!draftKey || typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(draftKey) ?? "";
    } catch {
      // Private mode / storage disabled — a lost draft is not worth an error.
      return "";
    }
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  /**
   * Pinned refs, persisted beside the text under `${draftKey}:reply` /
   * `:task` — the task card HAS to survive a navigation, because it is
   * attached from the debug board (task-row's messageAuthor writes the key,
   * then routes here), and a reply should survive a reload for the same
   * reason the words do.
   */
  const [replyTo, setReplyTo] = useState<ReplyDraft | null>(() =>
    readStored<ReplyDraft>(draftKey ? `${draftKey}:reply` : null)
  );
  const [task, setTask] = useState<MessageTaskRef | null>(() =>
    readStored<MessageTaskRef>(draftKey ? `${draftKey}:task` : null)
  );
  /** Everyone picked from the @ menu this draft — filtered again on submit. */
  const [named, setNamed] = useState<{ id: string; name: string }[]>([]);
  /** Caret position, so the @ picker can tell which token it is inside. */
  const [caretAt, setCaretAt] = useState<number | null>(null);
  const [pick, setPick] = useState(0);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { error: toastError } = useToast();

  useImperativeHandle(ref, () => ({
    restore: (text, files, refs) => {
      // Never overwrite words typed since the failure.
      setDraft((d) => (d.trim() ? d : text));
      setAttachments(files);
      // Same restraint for the refs: don't clobber ones pinned since.
      if (refs?.replyTo) setReplyTo((r) => r ?? refs.replyTo);
      if (refs?.task) setTask((t) => t ?? refs.task);
    },
    reply: (draft) => {
      // Pinned ABOVE the draft, never written into it — the words the user
      // has half-typed stay theirs, and the quote stays a live reference
      // rather than pasted text. Replying to a second message just retargets.
      setReplyTo(draft);
      // After React has committed, like choose() below.
      requestAnimationFrame(() => {
        const el = boxRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
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
    const full = el.scrollHeight;
    el.style.height = `${Math.min(full, MAX_HEIGHT_PX)}px`;
    // Overflow is toggled here rather than being a static class: a permanent
    // `overflow-y-auto` shows the (custom, always-visible) scrollbar track down
    // the side of a one-line box, which reads as a bug. It appears only once the
    // text genuinely exceeds the cap.
    el.style.overflowY = full > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [draft]);

  // Keep the stored draft in step. Writing on every keystroke is fine —
  // localStorage is synchronous and this is a few hundred bytes — but an empty
  // draft is REMOVED rather than stored, so switching threads doesn't leave a
  // trail of empty keys behind.
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (draft) window.localStorage.setItem(draftKey, draft);
      else window.localStorage.removeItem(draftKey);
    } catch {
      // Storage unavailable; the draft simply isn't persisted.
    }
  }, [draft, draftKey]);

  // The pinned refs persist the same way the words do — removed when cleared,
  // so cancelling a reply doesn't leave a stale key that re-pins it on reload.
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (replyTo)
        window.localStorage.setItem(
          `${draftKey}:reply`,
          JSON.stringify(replyTo)
        );
      else window.localStorage.removeItem(`${draftKey}:reply`);
    } catch {
      // Storage unavailable; the pin simply isn't persisted.
    }
  }, [replyTo, draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (task)
        window.localStorage.setItem(`${draftKey}:task`, JSON.stringify(task));
      else window.localStorage.removeItem(`${draftKey}:task`);
    } catch {
      // Storage unavailable; the pin simply isn't persisted.
    }
  }, [task, draftKey]);

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

  /**
   * The `@…` word directly before the caret, if the caret is inside one. Null
   * closes the picker — including when the caret moves away from a token that is
   * still in the text, which is what makes the picker feel attached to the caret
   * rather than to the message.
   */
  const query = useMemo(() => {
    if (!mentionable) return null;
    const caret = caretAt;
    if (caret === null) return null;
    const before = draft.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1) return null;
    // Must start a word — an email address should not open a picker.
    if (at > 0 && !/\s/.test(before[at - 1]!)) return null;
    const word = before.slice(at + 1);
    // A space ends the token. Names are matched on their first word.
    if (/\s/.test(word)) return null;
    return { at, word };
  }, [draft, caretAt, mentionable]);

  const matches = useMemo(() => {
    if (!query || !mentionable) return [];
    const needle = query.word.toLowerCase();
    return mentionable
      .filter((p) => p.name.toLowerCase().includes(needle))
      .slice(0, 5);
  }, [query, mentionable]);

  // Reset the highlighted row whenever the candidate set changes, or the
  // selection can point past the end of a narrowed list.
  useEffect(() => {
    setPick(0);
  }, [query?.word]);

  /** Replace the `@token` under the caret with `@FirstName ` and record the id. */
  function choose(person: { id: string; name: string }) {
    if (!query) return;
    const token = person.name.split(" ")[0]!;
    const next =
      draft.slice(0, query.at) +
      `@${token} ` +
      draft.slice(query.at + 1 + query.word.length);
    setDraft(next);
    setNamed((prev) =>
      prev.some((p) => p.id === person.id) ? prev : [...prev, person]
    );
    const caret = query.at + token.length + 2;
    // Restore the caret after React has written the new value.
    requestAnimationFrame(() => {
      boxRef.current?.focus();
      boxRef.current?.setSelectionRange(caret, caret);
      setCaretAt(caret);
    });
  }

  function submit() {
    const clean = draft.trim();
    // A task card can go alone (it says something by itself); a bare reply
    // pin cannot — a quote with no answer is nothing.
    if (!clean && attachments.length === 0 && !task) return;
    // Only ids whose token SURVIVED in the final text are sent — deleting the
    // "@Kemal" you typed must un-mention Kemal, not leave a silent bell behind.
    const ids = named
      .filter((p) =>
        new RegExp(`@${p.name.split(" ")[0]!}\\b`, "i").test(clean)
      )
      .map((p) => p.id);
    // Cleared here, not by the parent: the send pipelines, so the box must be
    // ready for the next line immediately.
    setDraft("");
    setAttachments([]);
    setNamed([]);
    setReplyTo(null);
    setTask(null);
    if (fileRef.current) fileRef.current.value = "";
    onSend(clean, attachments, ids, { replyTo, task });
  }

  const overrun = draft.length >= COUNTER_AT;

  return (
    <div className="relative border-t border-line pt-3">
      {/* The @ menu. Sits above the composer because there is nothing below it —
          the composer is already at the bottom of the pane. Frosted like every
          other transient surface in the app. */}
      {matches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mention someone"
          className="absolute bottom-full left-0 z-10 mb-2 w-64 animate-pop-in overflow-hidden rounded-md border border-line-strong bg-raised/90 py-1 backdrop-blur-md"
        >
          {matches.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === pick}
                // The textarea keeps focus, so this fires on mousedown —
                // a click would blur first and close the menu.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setPick(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[calc(13px*var(--text-scale,1))]",
                  i === pick ? "bg-line-strong/40 text-ink" : "text-muted"
                )}
              >
                <span className="truncate">{p.name}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-faint">
                  @{p.name.split(" ")[0]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* The pinned refs: what this message replies to, the task it shares.
          Live previews of the referenced rows — not text pasted into the
          draft — so what you see above the box is exactly the card the
          message will carry. */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-raised px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <ReplyRefBody
              name={`Replying to ${replyTo.senderName}`}
              snippet={replySnippet(replyTo)}
              hasImage={replyTo.has_image}
            />
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label={`Cancel reply to ${replyTo.senderName}`}
            className="grid size-6 shrink-0 place-items-center rounded-md text-faint transition-colors duration-150 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
      {task && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-raised px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <TaskRefBody task={task} />
          </div>
          <button
            type="button"
            onClick={() => setTask(null)}
            aria-label={`Remove task ${task.title}`}
            className="grid size-6 shrink-0 place-items-center rounded-md text-faint transition-colors duration-150 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
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
          onChange={(e) => {
            setDraft(e.target.value);
            setCaretAt(e.target.selectionStart);
          }}
          // The caret can move without the text changing, which has to close or
          // reopen the picker.
          onSelect={(e) => setCaretAt(e.currentTarget.selectionStart)}
          onBlur={() => setCaretAt(null)}
          onKeyDown={(e) => {
            // While the @ menu is open it owns the arrows, Enter/Tab and Escape.
            if (matches.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setPick((p) => (p + 1) % matches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setPick((p) => (p - 1 + matches.length) % matches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                choose(matches[pick] ?? matches[0]!);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setCaretAt(null);
                return;
              }
            }
            // With the @ menu closed, Escape unpins the reply — the same key
            // that dismisses every other transient surface in the app.
            if (e.key === "Escape" && replyTo) {
              e.preventDefault();
              setReplyTo(null);
              return;
            }
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
            "min-h-9 flex-1 resize-none overflow-y-hidden rounded-md border bg-raised px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong",
            overrun ? "border-amber" : "border-line"
          )}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() && attachments.length === 0 && !task}
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
