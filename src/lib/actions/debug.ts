"use server";

import { revalidatePath } from "next/cache";
import { blockIfShowcase, requireAdmin, requireSection } from "@/lib/data/session";
import { notifySection, notifyUser } from "@/lib/actions/notify";
import type { ActionResult } from "@/lib/actions/account";
import type { DebugPriority, DebugState, DebugTask } from "@/lib/types";

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

  // Tell the suggested person directly. notifyUser excludes the actor, so an
  // admin suggesting a task to themselves won't ping themselves.
  if (suggestedFor) {
    notifyUser(ctx, suggestedFor, {
      kind: "debug_suggested",
      title: `You were suggested for a task: ${title}`,
      href: "/debug",
    });
  }

  revalidatePath("/debug");
  return { ok: true, message: "Task posted." };
}

/**
 * Rapid batch insert for brainstorm dumps — N titles in ONE trip, default
 * priority, no per-task notifications. The batch-add bar fires a single
 * collapsed notification on session close via notifyDebugBatch, so a
 * 15-task brainstorm pings the team once, not 15 times.
 */
export async function quickAddTasks(
  titles: string[],
  projectId: string | null
): Promise<{ ok: boolean; message: string; tasks?: DebugTask[] }> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  const clean = titles
    .map((t) => t.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 50); // sanity cap per call — a paste, not an import pipeline
  if (clean.length === 0) return { ok: false, message: "Nothing to add." };

  const { data, error } = await ctx.supabase
    .from("debug_tasks")
    .insert(
      clean.map((title) => ({
        title,
        project_id: projectId || null,
        created_by: ctx.userId,
      }))
    )
    .select("*");
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return {
    ok: true,
    message: `Added ${clean.length}.`,
    tasks: (data ?? []) as DebugTask[],
  };
}

/**
 * The one collapsed notification for a batch-add session ("14 new tasks on
 * Pet App"). Called by the bar when it closes, with however many landed since
 * the last notify — never per task.
 */
export async function notifyDebugBatch(
  count: number,
  projectName?: string | null
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  const n = Math.floor(count);
  if (!Number.isFinite(n) || n < 1) return null;

  notifySection(ctx, "debug", {
    kind: "debug_task_new",
    title: `${Math.min(n, 500)} new task${n === 1 ? "" : "s"}${
      projectName ? ` on ${projectName}` : ""
    }`,
    href: "/debug",
  });
  return null;
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

/** Edit a task's title / description / priority / board (RLS restricts who can). */
export async function updateTask(
  taskId: string,
  fields: {
    title: string;
    description: string;
    priority: DebugPriority;
    due_on?: string | null;
    project_id?: string | null;
    /** Admin-only soft suggestion; silently ignored for everyone else. */
    suggested_for?: string | null;
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
      // Only touch due_on / project_id when the caller included them —
      // undefined leaves them as they are ("" means clear → null).
      ...(fields.due_on !== undefined ? { due_on: fields.due_on || null } : {}),
      ...(fields.project_id !== undefined
        ? { project_id: fields.project_id || null }
        : {}),
      // The suggestion nudge is admin-only — same server-side gate as createTask.
      ...(fields.suggested_for !== undefined && ctx.isAdmin
        ? { suggested_for: fields.suggested_for || null }
        : {}),
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

/**
 * Admin-only bulk hard-delete — the escape valve for archived tasks so they
 * don't pile up invisibly forever. requireAdmin (not just section) because it
 * removes tasks created by anyone. RLS already permits admin deletes; the guard
 * is the app-level gate.
 */
export async function deleteTasks(taskIds: string[]): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const ids = taskIds.filter(Boolean);
  if (ids.length === 0) return { ok: false, message: "Nothing selected." };

  const { error } = await ctx.supabase
    .from("debug_tasks")
    .delete()
    .in("id", ids);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return {
    ok: true,
    message: `Deleted ${ids.length} task${ids.length === 1 ? "" : "s"}.`,
  };
}
