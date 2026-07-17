"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockIfShowcase, requireAdmin, requireSection } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

function normalizeSprintFields(raw: {
  title?: string | null;
  description?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
}) {
  // No required fields (create-flow rule): sensible defaults keep dates valid.
  const today = new Date().toISOString().slice(0, 10);
  const starts = (raw.starts_on ?? "") || today;
  let ends = (raw.ends_on ?? "") || starts;
  if (ends < starts) ends = starts;
  return {
    title: (raw.title ?? "").trim().slice(0, 120) || "Untitled sprint",
    description: (raw.description ?? "").trim() || null,
    starts_on: starts,
    ends_on: ends,
  };
}

function sprintFields(formData: FormData) {
  return normalizeSprintFields({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    starts_on: String(formData.get("starts_on") ?? ""),
    ends_on: String(formData.get("ends_on") ?? ""),
  });
}

export type SprintDraft = {
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  participantIds: string[];
  goalTitles: string[];
  linkResources: { title: string; url: string }[];
};

export type SprintResult = ActionResult & { id?: string };

/**
 * The composer saves a whole sprint in one go: basics, participants, goals,
 * and link resources. Returns the id (no redirect) so the client can upload
 * staged files under `${id}/…` before navigating. This replaced the old
 * two-step createSprint → configure-on-the-detail-page flow.
 */
export async function createSprintFull(draft: SprintDraft): Promise<SprintResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  const fields = normalizeSprintFields(draft);

  const { data: sprint, error } = await ctx.supabase
    .from("sprints")
    .insert({ ...fields, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !sprint) return { ok: false, message: error?.message ?? "Failed." };

  const goalRows = draft.goalTitles
    .map((t) => t.trim().slice(0, 200))
    .filter(Boolean)
    .map((title, i) => ({ sprint_id: sprint.id, title, sort_order: i }));
  const participantRows = [...new Set(draft.participantIds)].map((user_id) => ({
    sprint_id: sprint.id,
    user_id,
  }));
  const resourceRows = draft.linkResources
    .map((r) => {
      let url = r.url.trim();
      if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;
      return {
        sprint_id: sprint.id,
        title: r.title.trim().slice(0, 200) || "Untitled resource",
        url: url || null,
      };
    })
    .filter((r) => r.url || r.title !== "Untitled resource");

  // One wave for everything the sprint contains.
  const results = await Promise.all([
    goalRows.length
      ? ctx.supabase.from("sprint_goals").insert(goalRows)
      : Promise.resolve({ error: null }),
    participantRows.length
      ? ctx.supabase.from("sprint_participants").insert(participantRows)
      : Promise.resolve({ error: null }),
    resourceRows.length
      ? ctx.supabase.from("sprint_resources").insert(resourceRows)
      : Promise.resolve({ error: null }),
  ]);
  const failed = results.find((r) => r.error);

  revalidatePath("/learn");
  revalidatePath(`/learn/${sprint.id}`);
  if (failed?.error) {
    // The sprint exists — hand back the id so the client still lands on it.
    return {
      ok: false,
      id: sprint.id,
      message: `Sprint created, but part of it failed: ${failed.error.message}`,
    };
  }
  return { ok: true, id: sprint.id, message: "Sprint created." };
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

  // Best effort: sweep the sprint's uploads so storage doesn't collect orphans
  // (the row cascade removes sprint_resources, not the files behind them).
  const { data: files } = await ctx.supabase.storage.from("learn").list(sprintId);
  if (files && files.length > 0) {
    await ctx.supabase.storage
      .from("learn")
      .remove(files.map((f) => `${sprintId}/${f.name}`));
  }

  revalidatePath("/learn");
  redirect("/learn");
}

/** Starts today, keeps the duration, copies goals + participants (not files). */
export async function duplicateSprint(sprintId: string): Promise<SprintResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const [{ data: sprint }, { data: goals }, { data: participants }] =
    await Promise.all([
      ctx.supabase.from("sprints").select("*").eq("id", sprintId).maybeSingle(),
      ctx.supabase
        .from("sprint_goals")
        .select("title, sort_order")
        .eq("sprint_id", sprintId)
        .order("sort_order")
        .order("created_at"),
      ctx.supabase
        .from("sprint_participants")
        .select("user_id")
        .eq("sprint_id", sprintId),
    ]);
  if (!sprint) return { ok: false, message: "Sprint not found." };

  const dayMs = 24 * 60 * 60 * 1000;
  const durationDays = Math.max(
    0,
    Math.round(
      (Date.parse(sprint.ends_on) - Date.parse(sprint.starts_on)) / dayMs
    )
  );
  const today = new Date().toISOString().slice(0, 10);
  const ends = new Date(Date.parse(today) + durationDays * dayMs)
    .toISOString()
    .slice(0, 10);

  const { data: copy, error } = await ctx.supabase
    .from("sprints")
    .insert({
      title: `${sprint.title} (copy)`.slice(0, 120),
      description: sprint.description,
      starts_on: today,
      ends_on: ends,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !copy) return { ok: false, message: error?.message ?? "Failed." };

  const results = await Promise.all([
    goals && goals.length > 0
      ? ctx.supabase.from("sprint_goals").insert(
          goals.map((g, i) => ({
            sprint_id: copy.id,
            title: g.title,
            sort_order: i,
          }))
        )
      : Promise.resolve({ error: null }),
    participants && participants.length > 0
      ? ctx.supabase.from("sprint_participants").insert(
          participants.map((p) => ({ sprint_id: copy.id, user_id: p.user_id }))
        )
      : Promise.resolve({ error: null }),
  ]);
  const failed = results.find((r) => r.error);

  revalidatePath("/learn");
  if (failed?.error) {
    return {
      ok: false,
      id: copy.id,
      message: `Duplicated, but part of it failed: ${failed.error.message}`,
    };
  }
  return { ok: true, id: copy.id, message: "Sprint duplicated." };
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

/** Rename in place. A blank title keeps the old one (no required fields). */
export async function updateGoal(
  goalId: string,
  sprintId: string,
  title: string
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();

  const next = title.trim().slice(0, 200);
  if (!next) return { ok: true, message: "Kept the old title." };

  const { error } = await ctx.supabase
    .from("sprint_goals")
    .update({ title: next })
    .eq("id", goalId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Goal renamed." };
}

/** Persist a full ordering — parallel updates, one wave. */
export async function reorderGoals(
  sprintId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireAdmin();
  if (orderedIds.length === 0) return { ok: true, message: "Nothing to order." };

  const results = await Promise.all(
    orderedIds.map((id, i) =>
      ctx.supabase
        .from("sprint_goals")
        .update({ sort_order: i })
        .eq("id", id)
        .eq("sprint_id", sprintId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: failed.error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Order saved." };
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
