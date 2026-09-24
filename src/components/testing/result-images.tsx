"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { THUMB_TRANSFORM } from "@/lib/debug-images";
import { Lightbox } from "@/components/ui/lightbox";
import type { TestResultImage } from "@/lib/types";

type View = TestResultImage & { url: string; thumbUrl: string };

/**
 * Read-only thumbnails for one result. Signs only when mounted, and it's only
 * mounted inside an expanded row, so a closed board costs no storage calls.
 * Transforms are baked into the token (see THUMB_TRANSFORM), so thumbnails
 * are signed one by one, like the Debug board's.
 */
export function ResultImages({ images }: { images: TestResultImage[] }) {
  const [views, setViews] = useState<View[]>([]);
  const [open, setOpen] = useState<View | null>(null);
  const key = images.map((i) => i.file_path).join("|");

  useEffect(() => {
    if (images.length === 0) return;
    let cancelled = false;
    const supabase = createClient();
    const paths = images.map((i) => i.file_path);
    Promise.all([
      supabase.storage.from("debug").createSignedUrls(paths, 60 * 60),
      Promise.all(
        paths.map((p) =>
          supabase.storage
            .from("debug")
            .createSignedUrl(p, 60 * 60, { transform: THUMB_TRANSFORM })
        )
      ),
    ]).then(([full, thumbs]) => {
      if (cancelled || !full.data) return;
      setViews(
        images
          .map((img, i) => {
            const url = full.data?.[i]?.signedUrl ?? "";
            return { ...img, url, thumbUrl: thumbs[i]?.data?.signedUrl ?? url };
          })
          // A task deleted on the Debug side takes its objects with it; those
          // simply don't sign, and vanish here rather than render broken.
          .filter((v) => v.url)
      );
    });
    return () => {
      cancelled = true;
    };
    // `key` is the content identity of `images`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (views.length === 0) return null;

  return (
    <>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {views.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => setOpen(v)}
              aria-label="View screenshot full size"
              className="block overflow-hidden rounded-md border border-line transition-colors duration-150 hover:border-line-strong"
            >
              <Image
                src={v.thumbUrl}
                alt=""
                width={v.width ?? 160}
                height={v.height ?? 100}
                unoptimized
                className="h-16 w-auto max-w-32 object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <Lightbox
          url={open.url}
          width={open.width}
          height={open.height}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
