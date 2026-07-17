"use server";

import { revalidatePath } from "next/cache";
import { blockIfShowcase, requireSection } from "@/lib/data/session";
import { notifySection } from "@/lib/actions/notify";
import type { ActionResult } from "@/lib/actions/account";
import type { DebugPriority, DebugState } from "@/lib/types";

const STATES: DebugState[] = ["open", "in_progress", "done"];
const PRIORITIES: DebugPriority[] = ["low", "medium", "high", "urgent"];

export async function createTask(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  // No required fields (create-flow rule) — fall back so NOT NULL columns stay valid.
  const title =
    String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled task";
  const description = String(formData.get("description") ?? "").trim();
  const rawPriority = String(formData.get("priority") ?? "medium") as DebugPriority;
  const priority = PRIORITIES.includes(rawPriority) ? rawPriority : "medium";
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  // The soft suggestion is admin-only — gate it server-side, never trust the form.
  const suggestedFor = ctx.isAdmin
    ? String(formData.get("suggested_for") ?? "").trim() || null
    : null;

  const { error } = await ctx.supabase.from("debug_tasks").insert({
    title,
    description: description || null,
    priority,
    project_id: projectId,
    due_on: dueOn,
    suggested_for: suggestedFor,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  notifySection(ctx, "debug", {
    kind: "debug_task_new",
    title: `New task: ${title}`,
    href: "/debug",
  });

  revalidatePath("/debug");
  return { ok: true, message: "Task posted." };
}

export async function setTaskState(
  taskId: string,
  state: DebugState
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");
  if (!STATES.includes(state)) return { ok: false, message: "Invalid state." };

  const { error } = await ctx.supabase
    .from("debug_tasks")
    .update({ state })
    .eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return { ok: true, message: "State updated." };
}

/** Edit a task's title / description / priority (RLS restricts who can). */
export async function updateTask(
  taskId: string,
  fields: {
    title: string;
    description: string;
    priority: DebugPriority;
    due_on?: string | null;
  }
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");
  const title = fields.title.trim().slice(0, 200);
  if (!title) return { ok: false, message: "A task needs a title." };
  const priority = PRIORITIES.includes(fields.priority) ? fields.priority : "medium";

  const { error } = await ctx.supabase
    .from("debug_tasks")
    .update({
      title,
      description: fields.description.trim() || null,
      priority,
      // Only touch due_on when the caller included it — undefined leaves it as is.
      ...(fields.due_on !== undefined ? { due_on: fields.due_on || null } : {}),
    })
    .eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return { ok: true, message: "Task updated." };
}

/** Claim for YOURSELF only — and only if still unclaimed (first click wins). */
export async function claimTask(taskId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  const { data, error } = await ctx.supabase
    .from("debug_tasks")
    .update({ assignee_id: ctx.userId })
    .eq("id", taskId)
    .is("assignee_id", null)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return { ok: false, message: "Someone claimed it first." };
  }

  revalidatePath("/debug");
  return { ok: true, message: "Claimed." };
}

export async function unclaimTask(taskId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  // UI offers this on your own tasks (admins: on any); DB culture allows unclaim generally.
  const { error } = await ctx.supabase
    .from("debug_tasks")
    .update({ assignee_id: null })
    .eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return { ok: true, message: "Unclaimed." };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  const { error } = await ctx.supabase.from("debug_tasks").delete().eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return { ok: true, message: "Task deleted." };
}
