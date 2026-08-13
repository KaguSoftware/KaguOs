"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Flag, Plus, Trash2 } from "lucide-react";
import {
  addStage,
  removeStage,
  reorderStages,
  setGoalStage,
  updateStage,
  type StageDraft,
} from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import type { SprintGoal, SprintStage } from "@/lib/types";

const num = (value: string) => {
  const n = Number(value);
  return value.trim() === "" || !Number.isFinite(n) ? null : n;
};

/**
 * Stage authoring: create the legs of a sprint, set their day range and proof
 * text, then file each goal into one. Goals stay owned by the Goals panel —
 * this only decides which stage they sit in and which one is the proof.
 *
 * Reordering is up/down buttons rather than drag: there are rarely more than
 * six stages, and a button is keyboard-operable for free.
 */
export function StagesEditor({
  sprintId,
  stages,
  goals,
}: {
  sprintId: string;
  stages: SprintStage[];
  goals: SprintGoal[];
}) {
  const { pending, run } = useAction();
  const [openId, setOpenId] = useState<string | null>(null);

  function move(index: number, delta: number) {
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderStages(sprintId, next.map((s) => s.id)));
  }

  const unstaged = goals.filter((g) => !g.stage_id);

  return (
    <div className="grid gap-3 p-4">
      {stages.length === 0 && (
        <p className="text-[13px] text-faint">
          No stages yet. Without them the sprint stays one flat checklist, which
          is still fine for a short one.
        </p>
      )}

      <ol className="grid gap-2">
        {stages.map((stage, index) => {
          const isOpen = openId === stage.id;
          const stageGoals = goals.filter((g) => g.stage_id === stage.id);
          return (
            <li key={stage.id} className="rounded-md border border-line bg-raised/30">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="font-mono text-xs text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : stage.id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] text-ink"
                >
                  {stage.kind === "capstone" && (
                    <Flag className="size-3.5 shrink-0 text-primary-dim" aria-hidden />
                  )}
                  <span className="truncate">{stage.title}</span>
                  <span className="shrink-0 font-mono text-xs text-faint">
                    {stageGoals.length}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Move ${stage.title} up`}
                  disabled={index === 0 || pending}
                  onClick={() => move(index, -1)}
                  className="rounded p-1 text-faint transition-colors duration-150 hover:text-ink disabled:opacity-40"
                >
                  <ChevronUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${stage.title} down`}
                  disabled={index === stages.length - 1 || pending}
                  onClick={() => move(index, 1)}
                  className="rounded p-1 text-faint transition-colors duration-150 hover:text-ink disabled:opacity-40"
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
                <ConfirmButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${stage.title}`}
                  confirmLabel="Removes its goals too"
                  onConfirm={() =>
                    run(() => removeStage(stage.id, sprintId), {
                      success: "Stage removed.",
                    })
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </ConfirmButton>
              </div>

              {isOpen && (
                <StageFields
                  stage={stage}
                  onSave={(draft) =>
                    run(() => updateStage(stage.id, sprintId, draft), {
                      success: "Stage saved.",
                    })
                  }
                  pending={pending}
                />
              )}
            </li>
          );
        })}
      </ol>

      <NewStage
        onCreate={(draft) =>
          run(() => addStage(sprintId, draft, stages.length), {
            success: "Stage added.",
          })
        }
        pending={pending}
      />

      {/* Filing goals into stages. One select per goal is plain, and plain is
          what an admin screen wants. */}
      {goals.length > 0 && stages.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-faint">
            Goals by stage
          </p>
          <ul className="grid gap-1.5">
            {goals.map((goal) => (
              <li key={goal.id} className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px]",
                    goal.stage_id ? "text-ink" : "text-muted"
                  )}
                >
                  {goal.title}
                </span>
                <Dropdown
                  id={`goal-stage-${goal.id}`}
                  value={goal.stage_id ?? ""}
                  disabled={pending}
                  className="w-40 shrink-0"
                  options={[
                    { value: "", label: "Unstaged" },
                    ...stages.map((s) => ({ value: s.id, label: s.title })),
                  ]}
                  onChange={(value) =>
                    run(() =>
                      setGoalStage(goal.id, sprintId, value || null, goal.is_proof)
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant={goal.is_proof ? "primary" : "ghost"}
                  disabled={pending || !goal.stage_id}
                  title={
                    goal.stage_id
                      ? "Mark this goal as the stage's proof"
                      : "File it into a stage first"
                  }
                  onClick={() =>
                    run(() =>
                      setGoalStage(goal.id, sprintId, goal.stage_id, !goal.is_proof)
                    )
                  }
                >
                  Proof
                </Button>
              </li>
            ))}
          </ul>
          {unstaged.length > 0 && (
            <p className="mt-2 text-xs text-faint">
              {unstaged.length} unstaged goal{unstaged.length === 1 ? "" : "s"} render
              in one block above the stages.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StageFields({
  stage,
  onSave,
  pending,
}: {
  stage: SprintStage;
  onSave: (draft: Partial<StageDraft>) => void;
  pending: boolean;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          title: String(data.get("title") ?? ""),
          summary: String(data.get("summary") ?? ""),
          proof: String(data.get("proof") ?? ""),
          kind: data.get("kind") === "capstone" ? "capstone" : "stage",
          day_from: num(String(data.get("day_from") ?? "")),
          day_to: num(String(data.get("day_to") ?? "")),
          hours_low: num(String(data.get("hours_low") ?? "")),
          hours_high: num(String(data.get("hours_high") ?? "")),
        });
      }}
      className="grid gap-3 border-t border-line px-3 py-3"
    >
      <Field label="Title" htmlFor={`stage-title-${stage.id}`}>
        <Input
          id={`stage-title-${stage.id}`}
          name="title"
          maxLength={120}
          defaultValue={stage.title}
        />
      </Field>
      <Field label="Summary" htmlFor={`stage-summary-${stage.id}`}>
        <Textarea
          id={`stage-summary-${stage.id}`}
          name="summary"
          rows={2}
          maxLength={600}
          defaultValue={stage.summary ?? ""}
        />
      </Field>
      <Field
        label="Proof"
        htmlFor={`stage-proof-${stage.id}`}
        hint="What clearing this stage looks like."
      >
        <Textarea
          id={`stage-proof-${stage.id}`}
          name="proof"
          rows={2}
          maxLength={400}
          defaultValue={stage.proof ?? ""}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Day from" htmlFor={`stage-df-${stage.id}`}>
          <Input
            id={`stage-df-${stage.id}`}
            name="day_from"
            type="number"
            min={1}
            defaultValue={stage.day_from ?? ""}
          />
        </Field>
        <Field label="Day to" htmlFor={`stage-dt-${stage.id}`}>
          <Input
            id={`stage-dt-${stage.id}`}
            name="day_to"
            type="number"
            min={1}
            defaultValue={stage.day_to ?? ""}
          />
        </Field>
        <Field label="Hours low" htmlFor={`stage-hl-${stage.id}`}>
          <Input
            id={`stage-hl-${stage.id}`}
            name="hours_low"
            type="number"
            min={0}
            defaultValue={stage.hours_low ?? ""}
          />
        </Field>
        <Field label="Hours high" htmlFor={`stage-hh-${stage.id}`}>
          <Input
            id={`stage-hh-${stage.id}`}
            name="hours_high"
            type="number"
            min={0}
            defaultValue={stage.hours_high ?? ""}
          />
        </Field>
      </div>
      <Field label="Kind" htmlFor={`stage-kind-${stage.id}`}>
        <Dropdown
          id={`stage-kind-${stage.id}`}
          name="kind"
          defaultValue={stage.kind}
          searchThreshold={0}
          options={[
            { value: "stage", label: "Stage" },
            { value: "capstone", label: "Capstone", hint: "The finishing project" },
          ]}
        />
      </Field>
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        Save stage
      </Button>
    </form>
  );
}

function NewStage({
  onCreate,
  pending,
}: {
  onCreate: (draft: Partial<StageDraft>) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onCreate({ title });
        setTitle("");
      }}
      className="flex items-center gap-2 border-t border-line pt-3"
    >
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={120}
        placeholder="New stage title"
        aria-label="New stage title"
      />
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        <Plus className="size-3.5" aria-hidden />
        Add
      </Button>
    </form>
  );
}
