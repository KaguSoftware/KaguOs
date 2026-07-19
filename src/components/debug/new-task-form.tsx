"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { ImagePlus, X } from "lucide-react";
import { addTaskImage, createTask } from "@/lib/actions/debug";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_TASK,
  MAX_IMAGE_BYTES,
} from "@/lib/debug-images";
import { createClient } from "@/lib/supabase/client";
import { CreateForm } from "@/components/ui/create";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/account";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", hint: "Whenever someone gets to it" },
  { value: "medium", label: "Medium", hint: "Normal flow" },
  { value: "high", label: "High", hint: "Should be picked up soon" },
  { value: "urgent", label: "Urgent", hint: "Drop other things" },
];

const KIND_OPTIONS = [
  { value: "fix", label: "Fix", hint: "Something's broken" },
  { value: "feature", label: "Feature", hint: "Something new to build" },
  {
    value: "audit",
    label: "Audit",
    hint: "Go find what needs fixing — files its findings as tasks",
  },
];

export function NewTaskForm({
  projects,
  memberOptions,
}: {
  projects: { id: string; name: string }[];
  /** People an admin can suggest for the task. Empty for non-admins. */
  memberOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  // Screenshots picked BEFORE the task exists. They can't be uploaded yet —
  // storage paths and the index row both key off a task_id — so they're held
  // here with a local preview URL and flushed the moment createTask returns one.
  const [staged, setStaged] = useState<{ file: File; preview: string }[]>([]);

  function stage(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES_PER_TASK - staged.length;
    if (room <= 0) {
      toast.error(`A task can hold ${MAX_IMAGES_PER_TASK} images.`);
      return;
    }
    const next: { file: File; preview: string }[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name} isn't a PNG, JPEG, WebP or GIF.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} is over 5MB.`);
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setStaged((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function unstage(index: number) {
    setStaged((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  /**
   * Create the task, then upload whatever was staged against its new id.
   *
   * Wrapping the action (rather than teaching CreateForm about files) keeps the
   * shared create surface generic — this is the only form with something to do
   * between "row inserted" and "navigate away".
   */
  async function actionWithImages(
    prev: ActionResult,
    formData: FormData
  ): Promise<ActionResult> {
    // Belt and braces with `form=""` on the input below: never let a File reach
    // the server action. Serializing staged screenshots into the action payload
    // is what hung "Post task" — the action doesn't read them, and the files go
    // browser → bucket separately once the task has an id.
    for (const [key, value] of Array.from(formData.entries())) {
      if (value instanceof File) formData.delete(key);
    }

    const result = await createTask(prev, formData);
    if (!result?.ok || !result.id || staged.length === 0) return result;

    const supabase = createClient();
    let failed = 0;
    for (const { file } of staged) {
      const ext = (file.name.split(".").pop() ?? "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const path = `${result.id}/${crypto.randomUUID()}.${ext || "png"}`;
      const { error } = await supabase.storage.from("debug").upload(path, file);
      if (error) {
        failed += 1;
        continue;
      }
      const saved = await addTaskImage({
        taskId: result.id,
        filePath: path,
        width: null,
        height: null,
        // We navigate to /debug right after this loop, which refetches anyway.
        skipRevalidate: true,
      });
      if (saved && !saved.ok) failed += 1;
    }

    // Release the previews whatever happened — they're object URLs, which the
    // browser holds until the document unloads. Runs on the partial-failure
    // path too: the task is posted either way, so this form is done with them.
    for (const { preview } of staged) URL.revokeObjectURL(preview);
    setStaged([]);

    // The TASK is posted regardless — say so honestly rather than reporting a
    // clean success when a screenshot didn't make it.
    if (failed > 0) {
      return {
        ok: true,
        message: `Task posted, but ${failed} image${failed === 1 ? "" : "s"} didn't upload.`,
      };
    }
    return { ...result, message: "Task posted with images." };
  }

  return (
    <CreateForm
      action={actionWithImages}
      fieldLabels={{ title: "Title", description: "Details" }}
      submitLabel="Post task"
      onCancel={() => router.back()}
      onDone={() => router.push("/debug")}
    >
      <Field label="Title" htmlFor="task-title">
        <Input
          id="task-title"
          name="title"
          maxLength={200}
          autoFocus
          placeholder="What needs doing?"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Board" htmlFor="task-project" hint="Which project's board it belongs to.">
          <Dropdown
            id="task-project"
            name="project_id"
            defaultValue=""
            options={[
              { value: "", label: "General", hint: "Not tied to a project" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </Field>
        <Field label="Kind" htmlFor="task-kind" hint="Repairing something, or building something new.">
          <Dropdown
            id="task-kind"
            name="kind"
            defaultValue="fix"
            options={KIND_OPTIONS}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" htmlFor="task-priority">
          <Dropdown
            id="task-priority"
            name="priority"
            defaultValue="medium"
            options={PRIORITY_OPTIONS}
          />
        </Field>
        <Field
          label="Deadline"
          htmlFor="task-due"
          hint="Optional — when this should be done by."
        >
          <DatePicker id="task-due" name="due_on" placeholder="No deadline" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {memberOptions.length > 0 && (
          <Field
            label="Suggest for"
            htmlFor="task-suggested"
            hint="A nudge, not a claim — anyone can still pick it up."
          >
            <Dropdown
              id="task-suggested"
              name="suggested_for"
              defaultValue=""
              placeholder="No suggestion"
              options={[
                { value: "", label: "No suggestion" },
                ...memberOptions,
              ]}
            />
          </Field>
        )}
      </div>
      <Field
        label="Details"
        htmlFor="task-description"
        hint="Steps to reproduce, links, context — whatever helps the person who claims it."
      >
        <Textarea id="task-description" name="description" rows={6} />
      </Field>
      <Field
        label="Screenshots"
        hint="Optional — a picture of the bug says more than the description will."
      >
        <div>
          {staged.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {staged.map((item, i) => (
                <li key={item.preview} className="group relative">
                  <NextImage
                    src={item.preview}
                    alt=""
                    width={160}
                    height={80}
                    unoptimized
                    className="h-20 w-auto max-w-40 rounded-md border border-line object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => unstage(i)}
                    aria-label="Remove image"
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-faint opacity-0 transition-opacity duration-150 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {staged.length < MAX_IMAGES_PER_TASK && (
            <>
              {/* NO `name`, and `form=""` to detach it from the surrounding
                  form. A named (or merely enclosed) file input gets serialized
                  into the server action payload — megabytes of binary the
                  action never reads, which hung "Post task" outright. The files
                  travel browser → bucket separately, after the task exists. */}
              <input
                ref={fileRef}
                type="file"
                form=""
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                multiple
                className="hidden"
                onChange={(e) => stage(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-[13px] text-faint transition-colors duration-150 hover:text-muted"
              >
                <ImagePlus className="size-3.5" aria-hidden />
                {staged.length > 0 ? "Add another" : "Attach image"}
              </button>
            </>
          )}
        </div>
      </Field>
    </CreateForm>
  );
}
