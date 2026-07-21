"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addTaskImage, deleteTaskImage } from "@/lib/actions/debug";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_TASK,
  MAX_IMAGE_BYTES,
} from "@/lib/debug-images";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { DebugTaskImage, DebugTaskImageView } from "@/lib/types";

/** Natural size of a picked file, so a thumbnail can reserve its box. */
function measure(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    // A measurement failure must not block the upload — the columns are
    // nullable precisely so a thumbnail can fall back to a default box.
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Screenshots on a debug task: upload, thumbnails, delete.
 *
 * Bytes go browser → private `debug` bucket directly (never through a server
 * action — a 5MB POST body would be slow and pointless), then a server action
 * writes the index row. The bucket is private, so rendering needs short-lived
 * signed URLs, minted here in ONE batched call rather than one per image.
 */
export function TaskImages({
  taskId,
  images,
  canEdit,
  onChange,
}: {
  taskId: string;
  images: DebugTaskImage[];
  canEdit: boolean;
  onChange: (next: DebugTaskImage[]) => void;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [views, setViews] = useState<DebugTaskImageView[]>([]);
  const [lightbox, setLightbox] = useState<DebugTaskImageView | null>(null);

  // Mint signed URLs for the current set. Re-runs when the set changes (an
  // upload or a delete), not on every render.
  const key = images.map((i) => i.file_path).join("|");

  // Drop stale signed URLs DURING RENDER, not in the effect. Clearing them in
  // the effect would paint the previous task's thumbnails for a frame after a
  // delete; resetting here lets React discard that pass before it's seen.
  // Same rule the board follows for prop adoption.
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setViews([]);
  }

  useEffect(() => {
    let cancelled = false;
    if (images.length === 0) return;
    const supabase = createClient();
    supabase.storage
      .from("debug")
      .createSignedUrls(
        images.map((i) => i.file_path),
        60 * 60
      )
      .then(({ data }) => {
        if (cancelled || !data) return;
        setViews(
          images
            .map((img, idx) => ({ ...img, url: data[idx]?.signedUrl ?? "" }))
            .filter((v) => v.url)
        );
      });
    return () => {
      cancelled = true;
    };
    // `key` is the content identity of `images`; depending on the array itself
    // would re-sign on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Escape closes the lightbox — a full-screen overlay with no keyboard exit
  // is a trap for anyone not using a mouse.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES_PER_TASK - images.length;
    if (room <= 0) {
      toastError(`A task can hold ${MAX_IMAGES_PER_TASK} images.`);
      return;
    }
    // Say what was dropped rather than silently truncating — the board already
    // has one silent cap and it reads as a bug every time someone hits it.
    const picked = Array.from(files);
    if (picked.length > room) {
      toastError(
        `Only ${room} more image${room === 1 ? "" : "s"} fit — the rest were skipped.`
      );
    }

    setBusy(true);
    const supabase = createClient();
    const added: DebugTaskImage[] = [];

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
      const ext = (file.name.split(".").pop() ?? "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const path = `${taskId}/${crypto.randomUUID()}.${ext || "png"}`;

      const { error } = await supabase.storage.from("debug").upload(path, file);
      if (error) {
        toastError(`Upload failed: ${error.message}`);
        continue;
      }

      const res = await addTaskImage({
        taskId,
        filePath: path,
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
      if (res && !res.ok) {
        toastError(res.message);
        continue;
      }

      added.push({
        id: crypto.randomUUID(),
        task_id: taskId,
        file_path: path,
        width: size?.width ?? null,
        height: size?.height ?? null,
        is_demo: false,
        created_by: null,
        created_at: new Date().toISOString(),
      });
    }

    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (added.length > 0) {
      onChange([...images, ...added]);
      toastSuccess(`Attached ${added.length} image${added.length === 1 ? "" : "s"}.`);
    }
  }

  function remove(image: DebugTaskImage) {
    const before = images;
    onChange(images.filter((i) => i.id !== image.id));
    deleteTaskImage(image.id).then((res) => {
      if (res && !res.ok) {
        onChange(before);
        toastError(res.message);
      }
    });
  }

  if (images.length === 0 && !canEdit) return null;

  return (
    <div
      className="mt-2.5"
      // Ctrl+V a screenshot straight onto the task. `Win+Shift+S` → paste is
      // how a screenshot actually reaches a bug report; the alternative is
      // save-to-disk, browse, pick.
      //
      // ⚠️ Scoped to this container, NOT `document`. A global paste listener
      // would hijack Ctrl+V app-wide — including the board's search box and
      // every text field — and start uploading when someone meant to paste text.
      // A paste carrying no files falls through untouched for the same reason.
      onPaste={
        canEdit
          ? (e) => {
              const files = e.clipboardData?.files;
              if (!files || files.length === 0) return;
              e.preventDefault();
              upload(files);
            }
          : undefined
      }
    >
      {views.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {views.map((image) => (
            <li key={image.id} className="group relative">
              <button
                type="button"
                onClick={() => setLightbox(image)}
                className="block overflow-hidden rounded-md border border-line transition-colors duration-150 hover:border-line-strong"
                aria-label="View image full size"
              >
                <Image
                  src={image.url}
                  alt=""
                  width={image.width ?? 160}
                  height={image.height ?? 100}
                  unoptimized
                  className="h-20 w-auto max-w-40 object-cover"
                />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(image)}
                  aria-label="Remove image"
                  className={cn(
                    "absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full",
                    "border border-line bg-surface text-faint opacity-0 transition-opacity duration-150",
                    "hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                  )}
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && images.length < MAX_IMAGES_PER_TASK && (
        <>
          {/* `form=""` detaches it from any enclosing form. This component now
              renders inside the row EDITOR too, and a file input caught by a
              form gets its bytes serialized into that form's action payload. */}
          <input
            ref={fileRef}
            type="file"
            form=""
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 text-[13px] text-faint",
              "transition-colors duration-150 hover:text-muted disabled:opacity-50"
            )}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-3.5" aria-hidden />
            )}
            {busy ? "Uploading…" : "Attach image"}
          </button>
          {/* Paste is invisible unless it's named. The hint sits on the same
              line as the button so the two read as one affordance. */}
          <span className="ml-2 text-[11px] text-faint">or paste a screenshot</span>
        </>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 grid animate-overlay-in place-items-center bg-black/80 p-6"
        >
          <Image
            src={lightbox.url}
            alt=""
            width={lightbox.width ?? 1200}
            height={lightbox.height ?? 800}
            unoptimized
            className="max-h-full w-auto max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
