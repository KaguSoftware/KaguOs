"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordResult } from "@/lib/actions/testing";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_TASK,
  MAX_IMAGE_BYTES,
} from "@/lib/debug-images";
import { ENV_LABEL, ENVIRONMENTS } from "@/lib/testing";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import type { DebugPriority, TestCase, TestEnvironment } from "@/lib/types";

const PRIORITIES: { key: DebugPriority; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
];

type Staged = { file: File; preview: string };

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
 * "It doesn't work" → a debug task. Asks for the three things a developer
 * needs and a bare "broken" never carries: what actually happened, where, and a
 * picture. Screenshots are staged locally and uploaded on send, straight into
 * `debug/testing/<caseId>/…`, so the same objects show on the Debug board.
 */
export function FailSheet({
  testCase,
  defaultEnv,
  onClose,
}: {
  testCase: TestCase;
  defaultEnv: TestEnvironment;
  onClose: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [env, setEnv] = useState<TestEnvironment>(defaultEnv);
  const [priority, setPriority] = useState<DebugPriority>("medium");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const linked = Boolean(testCase.debug_task_id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  // Every preview blob ever made, freed when the sheet goes away. Tracked in
  // the handlers, not synced from state during render.
  const previews = useRef<Set<string>>(new Set());
  useEffect(() => {
    const all = previews.current;
    return () => all.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function stage(files: FileList | null) {
    if (!files) return;
    const next = [...staged];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES_PER_TASK) {
        toast.error(`Up to ${MAX_IMAGES_PER_TASK} screenshots.`);
        break;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name} isn't a PNG, JPEG, WebP or GIF.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} is over 5MB.`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      next.push({ file, preview });
    }
    setStaged(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    setBusy(true);
    const supabase = createClient();
    const images: { path: string; width: number | null; height: number | null }[] = [];
    for (const { file } of staged) {
      const size = await measure(file);
      const ext =
        (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "png";
      const path = `testing/${testCase.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("debug").upload(path, file);
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        continue;
      }
      images.push({ path, width: size?.width ?? null, height: size?.height ?? null });
    }

    const res = await recordResult(testCase.id, {
      status: "fail",
      environment: env,
      note,
      priority,
      images,
    });
    setBusy(false);
    if (!res || !res.ok) {
      toast.error(res?.message ?? "Couldn't record that.");
      return;
    }
    toast.success(res.message);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fail-sheet-title"
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-xl border border-line bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-xl"
        onPaste={(e) => {
          const files = e.clipboardData?.files;
          if (!files || files.length === 0) return;
          e.preventDefault();
          stage(files);
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="fail-sheet-title" className="text-base font-semibold text-ink">
              Doesn&apos;t work
            </h2>
            <p className="truncate text-[calc(13px*var(--text-scale,1))] text-muted">
              {testCase.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-md p-1 text-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="What happened?" htmlFor="fail-note">
            <Textarea
              id="fail-note"
              autoFocus
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !busy) send();
              }}
              placeholder="Tapped Continue with Google, spinner forever, no error shown."
            />
          </Field>

          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <div>
              <p className="mb-1.5 text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
                Where
              </p>
              <Segmented
                label="Environment"
                size="sm"
                options={ENVIRONMENTS.map((e) => ({ key: e, label: ENV_LABEL[e] }))}
                value={env}
                onChange={setEnv}
              />
            </div>
            {!linked && (
              <div>
                <p className="mb-1.5 text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
                  Priority
                </p>
                <Segmented
                  label="Priority"
                  size="sm"
                  options={PRIORITIES}
                  value={priority}
                  onChange={setPriority}
                />
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
              Screenshots
            </p>
            {staged.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2">
                {staged.map((s, i) => (
                  <li key={s.preview} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img
                      src={s.preview}
                      alt=""
                      className="h-16 w-auto max-w-32 rounded-md border border-line object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(s.preview);
                        setStaged(staged.filter((_, j) => j !== i));
                      }}
                      aria-label="Remove screenshot"
                      className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-faint hover:text-danger"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => stage(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-faint transition-colors duration-150 hover:text-muted"
            >
              <ImagePlus className="size-3.5" aria-hidden />
              Attach image
            </button>
            <span className="ml-2 text-[calc(11px*var(--text-scale,1))] text-faint">
              or paste a screenshot
            </span>
          </div>

          <p className="text-[calc(12px*var(--text-scale,1))] text-faint">
            {linked
              ? "This check already has a Debug task. The failure is added to it, or reopens it if it was marked done."
              : "Files a fix on this project's Debug board, with the steps and what should happen filled in."}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={send} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Send to Debug
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
