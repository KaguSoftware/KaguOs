"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";

/**
 * Full-screen image preview.
 *
 * This exists because there were TWO of it — `debug/task-images.tsx` and
 * `messages/thread.tsx` carried near-identical copies, so both carried the same
 * four defects:
 *
 *  - `aria-modal="true"` with no focus ever moved into the dialog, so a keyboard
 *    user's focus stayed behind it on the page underneath.
 *  - No focus trap, and no focus restored to the thumbnail on close.
 *  - No close button — Escape was the only exit, undiscoverable and unavailable
 *    to anyone driving by touch.
 *  - The dismiss handler sat on the same element as the image, so clicking the
 *    picture you had just opened closed it again.
 *
 * `url` must be signed at CLICK by the caller, never during render — see
 * `ui/signed-file-link.tsx` for why.
 */
export function Lightbox({
  url,
  width,
  height,
  alt = "",
  onClose,
}: {
  url: string;
  width: number | null;
  height: number | null;
  /** Empty is right for an image with no caption; pass one when it's known. */
  alt?: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // Move focus in on open, and hand it back to whatever opened us on close —
  // otherwise the thumbnail's place in the tab order is lost.
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // The close button is the only focusable thing in here, so trapping is
      // just "keep it there" — but it does have to be trapped, or Tab walks
      // into the page behind an aria-modal dialog.
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      // Backdrop only. The image below stops its own clicks, so opening a
      // picture and then looking at it no longer dismisses it.
      onClick={onClose}
      className="fixed inset-0 z-50 grid animate-overlay-in place-items-center bg-black/80 p-6"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close image preview"
        className="absolute right-4 top-4 grid size-9 place-items-center rounded-md border border-line-strong bg-surface/90 text-muted backdrop-blur-md transition-colors duration-150 hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
      <Image
        src={url}
        alt={alt}
        width={width ?? 1200}
        height={height ?? 800}
        unoptimized
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-auto max-w-full rounded-lg object-contain"
      />
    </div>
  );
}
