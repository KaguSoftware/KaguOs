"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockIfShowcase, requireAdmin, requireSection } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

function sprintFields(formData: FormData) {
  // No required fields (create-flow rule): sensible defaults keep dates valid.
  const today = new Date().toISOString().slice(0, 10);
  const starts = String(formData.get("starts_on") ?? "") || today;
  let ends = String(formData.get("ends_on") ?? "") || starts;
  if (ends < starts) ends = starts;
  return {
    title:
      String(formData.get("title") ?? "").trim().slice(0, 120) || "Untitled sprint",
    description: String(formData.get("description") ?? "").trim() || null,
    starts_on: starts,
    ends_on: ends,
  };
}

export async function createSprint(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const fields = sprintFields(formData);

  const { data: sprint, error } = await ctx.supabase
    .from("sprints")
    .insert({ ...fields, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !sprint) return { ok: false, message: error?.message ?? "Failed." };

  revalidatePath("/learn");
  redirect(`/learn/${sprint.id}`);
}

export async function updateSprint(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const fields = sprintFields(formData);

  if (!id) return { ok: false, message: "Missing sprint id." };

  const { error } = await ctx.supabase.from("sprints").update(fields).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/learn");
  revalidatePath(`/learn/${id}`);
  return { ok: true, message: "Sprint saved." };
}

export async function deleteSprint(sprintId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const { error } = await ctx.supabase.from("sprints").delete().eq("id", sprintId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/learn");
  redirect("/learn");
}

export async function setParticipants(
  sprintId: string,
  userIds: string[]
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const { data: current, error: readError } = await ctx.supabase
    .from("sprint_participants")
    .select("user_id")
    .eq("sprint_id", sprintId);
  if (readError) return { ok: false, message: readError.message };

  const have = new Set((current ?? []).map((r) => r.user_id));
  const want = new Set(userIds);
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));

  if (toRemove.length > 0) {
    const { error } = await ctx.supabase
      .from("sprint_participants")
      .delete()
      .eq("sprint_id", sprintId)
      .in("user_id", toRemove);
    if (error) return { ok: false, message: error.message };
  }
  if (toAdd.length > 0) {
    const { error } = await ctx.supabase
      .from("sprint_participants")
      .upsert(toAdd.map((user_id) => ({ sprint_id: sprintId, user_id })));
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Participants updated." };
}

/** Add one or many goals at once (one per line). Batch is the default flow. */
export async function addGoals(
  sprintId: string,
  titles: string[],
  startOrder: number
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  if (!sprintId) return { ok: false, message: "Missing sprint id." };

  const rows = titles
    .map((t) => t.trim().slice(0, 200))
    .filter(Boolean)
    .map((title, i) => ({ sprint_id: sprintId, title, sort_order: startOrder + i }));

  if (rows.length === 0) return { ok: false, message: "Write at least one goal." };

  const { error } = await ctx.supabase.from("sprint_goals").insert(rows);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return {
    ok: true,
    message: rows.length === 1 ? "Goal added." : `${rows.length} goals added.`,
  };
}

export async function removeGoal(goalId: string, sprintId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const { error } = await ctx.supabase.from("sprint_goals").delete().eq("id", goalId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Goal removed." };
}

/** Link and/or uploaded file (file is uploaded client-side to the `learn` bucket first). */
export async function addResource(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const sprintId = String(formData.get("sprint_id") ?? "");
  const title =
    String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled resource";
  let url = String(formData.get("url") ?? "").trim();
  const filePath = String(formData.get("file_path") ?? "").trim() || null;

  if (!sprintId) return { ok: false, message: "Missing sprint id." };
  if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;

  const { error } = await ctx.supabase
    .from("sprint_resources")
    .insert({ sprint_id: sprintId, title, url: url || null, file_path: filePath });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Resource added." };
}

export async function removeResource(
  resourceId: string,
  sprintId: string
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const { data: resource } = await ctx.supabase
    .from("sprint_resources")
    .select("file_path")
    .eq("id", resourceId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("sprint_resources")
    .delete()
    .eq("id", resourceId);
  if (error) return { ok: false, message: error.message };

  if (resource?.file_path) {
    await ctx.supabase.storage.from("learn").remove([resource.file_path]);
  }

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Resource removed." };
}

/** Participants tick their OWN goals; RLS restricts rows to user_id = auth.uid(). */
export async function toggleGoalProgress(
  goalId: string,
  sprintId: string,
  done: boolean
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("learn");

  const { error } = done
    ? await ctx.supabase
        .from("sprint_goal_progress")
        .upsert({ goal_id: goalId, user_id: ctx.userId })
    : await ctx.supabase
        .from("sprint_goal_progress")
        .delete()
        .eq("goal_id", goalId)
        .eq("user_id", ctx.userId);
  if (error) {
    return {
      ok: false,
      message: error.code === "42501" ? "You're not a participant of this sprint." : error.message,
    };
  }

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: done ? "Nice — ticked." : "Unticked." };
}
