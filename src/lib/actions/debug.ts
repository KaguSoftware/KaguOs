"use server";

import { revalidatePath } from "next/cache";
import {
  blockIfShowcase,
  requireAdmin,
  requireSection,
  type SessionContext,
} from "@/lib/data/session";
import { notifySection, notifyUser } from "@/lib/actions/notify";
import { MAX_IMAGES_PER_TASK } from "@/lib/debug-images";
import type { ActionResult } from "@/lib/actions/account";
import type { DebugKind, DebugPriority, DebugState, DebugTask } from "@/lib/types";

const STATES: DebugState[] = ["open", "in_progress", "done"];
const PRIORITIES: DebugPriority[] = ["low", "medium", "high", "urgent"];
const KINDS: DebugKind[] = ["fix", "feature", "audit"];

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
  const rawKind = String(formData.get("kind") ?? "fix") as DebugKind;
  const kind = KINDS.includes(rawKind) ? rawKind : "fix";
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  // The soft suggestion is admin-only — gate it server-side, never trust the form.
  const suggestedFor = ctx.isAdmin
    ? String(formData.get("suggested_for") ?? "").trim() || null
    : null;

  const { data: created, error } = await ctx.supabase
    .from("debug_tasks")
    .insert({
      title,
      description: description || null,
      priority,
      kind,
      project_id: projectId,
      due_on: dueOn,
      suggested_for: suggestedFor,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  // The new id rides back on the result so the create form can attach the
  // screenshots that were staged before the task existed. `ActionResult` carries
  // it as an optional field, so every other caller is unaffected.
  const newTaskId = created?.id as string | undefined;

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
  return { ok: true, message: "Task posted.", id: newTaskId };
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
 * File what an audit turned up: N new tasks, each pointing back at the audit
 * that found them.
 *
 * This is the payoff of the `audit` kind — the sweep's whole output is a list,
 * so recording it must be one action, not N trips through the create form.
 * The found tasks inherit the audit's board (they're about the same thing) and
 * default to 'fix'; priorities get set afterwards on the board like any task.
 */
export async function logAuditFindings(
  auditId: string,
  titles: string[]
): Promise<{ ok: boolean; message: string; tasks?: DebugTask[] }> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  const clean = titles
    .map((t) => t.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 50); // same sanity cap as quickAddTasks — a sweep, not an import
  if (clean.length === 0) return { ok: false, message: "Nothing to file." };

  // Inherit the audit's board so findings land beside the thing audited.
  const { data: audit } = await ctx.supabase
    .from("debug_tasks")
    .select("project_id, title")
    .eq("id", auditId)
    .single();

  const { data, error } = await ctx.supabase
    .from("debug_tasks")
    .insert(
      clean.map((title) => ({
        title,
        kind: "fix" as const,
        project_id: audit?.project_id ?? null,
        found_by: auditId,
        created_by: ctx.userId,
      }))
    )
    .select("*");
  if (error) return { ok: false, message: error.message };

  // One collapsed notification for the whole sweep, never one per finding.
  notifySection(ctx, "debug", {
    kind: "debug_task_new",
    title: `Audit found ${clean.length} thing${clean.length === 1 ? "" : "s"}${
      audit?.title ? `: ${audit.title}` : ""
    }`,
    href: "/debug",
  });

  revalidatePath("/debug");
  return {
    ok: true,
    message: `Filed ${clean.length}.`,
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
    kind?: DebugKind;
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
      ...(fields.kind !== undefined && KINDS.includes(fields.kind)
        ? { kind: fields.kind }
        : {}),
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

/**
 * Release a claim. Yours only — admins may release anyone's.
 *
 * `claimTask` has always been careful (`.is("assignee_id", null)`, first click
 * wins); this was not, so any Debug member could free up a teammate's task.
 * Guarded on the ROW here, matching migration 0035's RLS policy: the query only
 * matches when the caller is the assignee, so a mismatch returns no rows rather
 * than silently succeeding.
 */
export async function unclaimTask(taskId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  const query = ctx.supabase
    .from("debug_tasks")
    .update({ assignee_id: null })
    .eq("id", taskId);
  if (!ctx.isAdmin) query.eq("assignee_id", ctx.userId);

  const { data, error } = await query.select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return { ok: false, message: "That task isn't yours to unclaim." };
  }

  revalidatePath("/debug");
  return { ok: true, message: "Unclaimed." };
}

/**
 * Remove the stored screenshots for these tasks.
 *
 * `debug_task_images.task_id` cascades, so deleting a task drops the ROWS — but
 * a cascade knows nothing about storage, so the OBJECTS would sit in the bucket
 * forever, unreferenced and unbilled-for by anyone watching. Call this BEFORE
 * deleting the tasks, while the paths are still readable. Same shape as the
 * contract-file cleanup in `management.ts`.
 *
 * Best-effort: a storage failure must not block the delete, or a task becomes
 * undeletable because of a leftover file.
 */
async function purgeTaskImages(
  supabase: SessionContext["supabase"],
  taskIds: string[]
): Promise<void> {
  if (taskIds.length === 0) return;
  const { data } = await supabase
    .from("debug_task_images")
    .select("file_path")
    .in("task_id", taskIds);
  const paths = (data ?? []).map((r) => r.file_path).filter(Boolean);
  if (paths.length > 0) await supabase.storage.from("debug").remove(paths);
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  await purgeTaskImages(ctx.supabase, [taskId]);
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

  await purgeTaskImages(ctx.supabase, ids);
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

// ---- Screenshots -----------------------------------------------------------

/**
 * Record an already-uploaded screenshot. The BYTES go browser → private bucket
 * (same path as learn's sprint files); this only writes the index row, so a
 * large upload never travels through a server action.
 *
 * The cap is enforced here rather than only in the UI: the client already
 * counts, but a second tab could push a seventh past it.
 */
export async function addTaskImage(input: {
  taskId: string;
  filePath: string;
  width: number | null;
  height: number | null;
  /**
   * Skip the path revalidation. The create form attaches images in a loop and
   * then navigates to /debug, so revalidating once per image would do the same
   * work up to six times for a page that's about to be refetched anyway.
   */
  skipRevalidate?: boolean;
}): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  const { count } = await ctx.supabase
    .from("debug_task_images")
    .select("id", { count: "exact", head: true })
    .eq("task_id", input.taskId);
  if ((count ?? 0) >= MAX_IMAGES_PER_TASK) {
    // Undo the upload — otherwise the bytes sit in the bucket with no row
    // pointing at them, which nothing would ever clean up.
    await ctx.supabase.storage.from("debug").remove([input.filePath]);
    return {
      ok: false,
      message: `That task already has ${MAX_IMAGES_PER_TASK} images.`,
    };
  }

  const { error } = await ctx.supabase.from("debug_task_images").insert({
    task_id: input.taskId,
    file_path: input.filePath,
    width: input.width,
    height: input.height,
    is_demo: ctx.showcase,
    created_by: ctx.userId,
  });
  if (error) {
    await ctx.supabase.storage.from("debug").remove([input.filePath]);
    return { ok: false, message: error.message };
  }

  if (!input.skipRevalidate) revalidatePath("/debug");
  return { ok: true, message: "Image attached." };
}

/** Delete one screenshot — the row AND the stored object, never just one. */
export async function deleteTaskImage(imageId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("debug");

  // Read the path first: after the row is gone there's no way back to the object.
  const { data: image } = await ctx.supabase
    .from("debug_task_images")
    .select("file_path")
    .eq("id", imageId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("debug_task_images")
    .delete()
    .eq("id", imageId)
    .select("id");
  if (error) return { ok: false, message: error.message };

  if (image?.file_path) {
    await ctx.supabase.storage.from("debug").remove([image.file_path]);
  }

  revalidatePath("/debug");
  return { ok: true, message: "Image removed." };
}
