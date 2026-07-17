"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { addResource, createSprintFull } from "@/lib/actions/learn";
import { createClient } from "@/lib/supabase/client";
import { Button, SubmitButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { UrlInput } from "@/components/ui/typed-inputs";
import { useToast } from "@/components/ui/toast";
import { GoalListEditor, type GoalItem } from "@/components/learn/goal-list-editor";

type Member = { id: string; name: string };
type StagedResource = { key: string; title: string; url: string; file: File | null };

function durationHint(starts: string, ends: string): string | null {
  if (!starts || !ends || ends < starts) return null;
  const days =
    Math.round((Date.parse(ends) - Date.parse(starts)) / (24 * 60 * 60 * 1000)) + 1;
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-t border-line pt-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Build the whole sprint in one place: basics, participants, goals (with
 * ordering), and resources — a single submit creates everything and lands on
 * the finished sprint. Nothing is required; empties get the confirm bar.
 */
export function SprintComposer({ members }: { members: Member[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalText, setGoalText] = useState("");
  const [resources, setResources] = useState<StagedResource[]>([]);
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resFile, setResFile] = useState<File | null>(null);
  const resFileRef = useRef<HTMLInputElement>(null);
  const [emptyWarning, setEmptyWarning] = useState<string[] | null>(null);

  const duration = durationHint(starts, ends);
  const everyone = selected.size === members.length && members.length > 0;

  const draftGoalCount = goalText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  function addGoalsFromText() {
    const titles = goalText
      .split("\n")
      .map((l) => l.trim().slice(0, 200))
      .filter(Boolean);
    if (titles.length === 0) return;
    setGoals((prev) => [
      ...prev,
      ...titles.map((title) => ({ id: crypto.randomUUID(), title })),
    ]);
    setGoalText("");
  }

  function stageResource() {
    if (!resTitle.trim() && !resUrl.trim() && !resFile) return;
    setResources((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        title: resTitle.trim(),
        url: resUrl.trim(),
        file: resFile,
      },
    ]);
    setResTitle("");
    setResUrl("");
    setResFile(null);
    if (resFileRef.current) resFileRef.current.value = "";
  }

  function submit(confirmed: boolean) {
    const form = formRef.current;
    if (!form || pending) return;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();

    if (!confirmed) {
      const empties = [
        !title && "Title",
        !description && "Description",
        selected.size === 0 && "Participants",
        goals.length === 0 && "Goals",
      ].filter((v): v is string => Boolean(v));
      if (empties.length > 0) {
        setEmptyWarning(empties);
        return;
      }
    }
    setEmptyWarning(null);

    startTransition(async () => {
      const result = await createSprintFull({
        title,
        description,
        starts_on: String(data.get("starts_on") ?? ""),
        ends_on: String(data.get("ends_on") ?? ""),
        participantIds: [...selected],
        goalTitles: goals.map((g) => g.title),
        linkResources: resources
          .filter((r) => !r.file)
          .map((r) => ({ title: r.title, url: r.url })),
      });
      if (!result?.ok && !result?.id) {
        toast.error(result?.message ?? "Failed to create the sprint.");
        return;
      }
      const id = result.id as string;

      // Files upload browser → private `learn` bucket, then a row per file.
      let uploadFailed = false;
      const staged = resources.filter((r) => r.file);
      if (staged.length > 0) {
        const supabase = createClient();
        await Promise.all(
          staged.map(async (r) => {
            const file = r.file as File;
            const safeName = file.name.replace(/[^\w.\-]+/g, "_");
            const path = `${id}/${crypto.randomUUID()}-${safeName}`;
            const { error } = await supabase.storage.from("learn").upload(path, file);
            if (error) {
              uploadFailed = true;
              return;
            }
            const fd = new FormData();
            fd.set("sprint_id", id);
            fd.set("title", r.title || file.name);
            fd.set("url", r.url);
            fd.set("file_path", path);
            const saved = await addResource(null, fd);
            if (saved && !saved.ok) uploadFailed = true;
          })
        );
      }

      if (!result.ok) toast.error(result.message);
      else if (uploadFailed)
        toast.error("Sprint created, but a file didn't upload — retry from Edit.");
      else toast.success("Sprint created.");
      router.push(!result.ok || uploadFailed ? `/learn/${id}/edit` : `/learn/${id}`);
    });
  }

  const warningText =
    emptyWarning && emptyWarning.length > 0
      ? `${emptyWarning.join(", ").replace(/, ([^,]*)$/, " and $1")} ${
          emptyWarning.length === 1 ? "is" : "are"
        } empty — are you sure you want to create the sprint?`
      : null;

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="space-y-6"
    >
      {/* Basics */}
      <Field label="Title" htmlFor="sprint-title">
        <Input
          id="sprint-title"
          name="title"
          maxLength={120}
          autoFocus
          placeholder="e.g. Python fundamentals"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="sprint-starts">
          <DatePicker id="sprint-starts" name="starts_on" onChange={setStarts} />
        </Field>
        <Field label="Ends" htmlFor="sprint-ends">
          <DatePicker id="sprint-ends" name="ends_on" onChange={setEnds} />
        </Field>
      </div>
      {duration && (
        <p className="-mt-3 font-mono text-xs text-faint" role="status">
          {duration}
        </p>
      )}
      <Field label="Description" htmlFor="sprint-description">
        <Textarea
          id="sprint-description"
          name="description"
          rows={3}
          placeholder="What this sprint is about, and what done looks like."
        />
      </Field>

      {/* Participants */}
      <SectionHeading title="Participants" hint="Who this sprint is planned for." />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {members.map((member) => (
            <Checkbox
              key={member.id}
              label={member.name}
              checked={selected.has(member.id)}
              onChange={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(member.id)) next.delete(member.id);
                  else next.add(member.id);
                  return next;
                });
              }}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setSelected(everyone ? new Set() : new Set(members.map((m) => m.id)))
          }
        >
          {everyone ? "Clear all" : "Everyone"}
        </Button>
      </div>

      {/* Goals */}
      <SectionHeading
        title="Goals"
        hint="The shared checklist everyone ticks. Drag to set the order."
      />
      <div className="space-y-3">
        <GoalListEditor
          goals={goals}
          onReorder={(ids) =>
            setGoals((prev) =>
              ids
                .map((id) => prev.find((g) => g.id === id))
                .filter((g): g is GoalItem => Boolean(g))
            )
          }
          onRename={(id, title) =>
            setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, title } : g)))
          }
          onRemove={(id) => setGoals((prev) => prev.filter((g) => g.id !== id))}
        />
        <div className="space-y-2 rounded-md border border-line bg-surface p-3">
          <Textarea
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            rows={3}
            placeholder={"One goal per line:\nFinish chapters 1–3\nBuild the demo project"}
            aria-label="New goals, one per line"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                addGoalsFromText();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-faint">
              {draftGoalCount > 0
                ? `${draftGoalCount} goal${draftGoalCount === 1 ? "" : "s"} — one per line`
                : "One goal per line"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draftGoalCount === 0}
              onClick={addGoalsFromText}
            >
              <Plus className="size-3.5" aria-hidden />
              Add {draftGoalCount > 1 ? `${draftGoalCount} goals` : "goal"}
            </Button>
          </div>
        </div>
      </div>

      {/* Resources */}
      <SectionHeading
        title="Resources"
        hint="Links and files people will learn from — added with the sprint."
      />
      <div className="space-y-3">
        {resources.length > 0 && (
          <ul className="space-y-1.5">
            {resources.map((resource) => (
              <li
                key={resource.key}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  {resource.file ? (
                    <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
                  ) : (
                    <Link2 className="size-3.5 shrink-0 text-faint" aria-hidden />
                  )}
                  <span className="truncate">
                    {resource.title || resource.file?.name || resource.url}
                  </span>
                  {resource.file && resource.title && (
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-faint">
                      {resource.file.name}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setResources((prev) => prev.filter((r) => r.key !== resource.key))
                  }
                  title="Remove resource"
                  aria-label={`Remove resource ${resource.title || resource.url}`}
                  className="text-faint hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-3 rounded-md border border-line bg-surface p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
              maxLength={200}
              placeholder="Title — e.g. Python for Everybody"
              aria-label="Resource title"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  stageResource();
                }
              }}
            />
            <UrlInput
              value={resUrl}
              onChange={(e) => setResUrl(e.target.value)}
              aria-label="Resource link"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  stageResource();
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <input
                ref={resFileRef}
                type="file"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => setResFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resFileRef.current?.click()}
              >
                <Paperclip className="size-3.5" aria-hidden />
                {resFile ? "Change file" : "Choose file"}
              </Button>
              {resFile && (
                <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  <span className="truncate">{resFile.name}</span>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => {
                      setResFile(null);
                      if (resFileRef.current) resFileRef.current.value = "";
                    }}
                    className="text-faint hover:text-danger"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!resTitle.trim() && !resUrl.trim() && !resFile}
              onClick={stageResource}
            >
              <Plus className="size-3.5" aria-hidden />
              Add resource
            </Button>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="border-t border-line pt-6">
        {warningText ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber/30 bg-amber/10 px-3 py-2.5">
            <p className="text-[13px] text-amber">{warningText}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() => submit(true)}
              >
                Create anyway
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEmptyWarning(null)}
              >
                Keep editing
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <SubmitButton disabled={pending}>
              {pending ? "Creating…" : "Create sprint"}
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
