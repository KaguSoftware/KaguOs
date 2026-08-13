"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockIfReadOnly, requireAdmin, requireSection } from "@/lib/data/session";
import { notifyAdmins, notifySection, notifyUser } from "@/lib/actions/notify";
import { createServiceClient } from "@/lib/supabase/service";
import { addDays, todayInIstanbul } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/account";

function normalizeSprintFields(raw: {
  title?: string | null;
  description?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  join_mode?: string | null;
}) {
  // No required fields (create-flow rule): sensible defaults keep dates valid.
  const today = todayInIstanbul();
  const starts = (raw.starts_on ?? "") || today;
  let ends = (raw.ends_on ?? "") || starts;
  if (ends < starts) ends = starts;
  return {
    title: (raw.title ?? "").trim().slice(0, 120) || "Untitled sprint",
    description: (raw.description ?? "").trim() || null,
    starts_on: starts,
    ends_on: ends,
    // Assigned stays the default: a sprint only becomes browsable-and-joinable
    // when someone says so.
    join_mode: raw.join_mode === "open" ? "open" : "assigned",
  };
}

function sprintFields(formData: FormData) {
  return normalizeSprintFields({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    starts_on: String(formData.get("starts_on") ?? ""),
    ends_on: String(formData.get("ends_on") ?? ""),
    // The checkbox rides alongside a hidden 'assigned' input (an unchecked box
    // submits nothing), so the field arrives twice when it's ticked. `get`
    // would only ever see the hidden one — the tick has to win on presence,
    // not on order.
    join_mode: formData.getAll("join_mode").includes("open") ? "open" : "assigned",
  });
}

export type SprintDraft = {
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  join_mode: "assigned" | "open";
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
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
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
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
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
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const { error } = await ctx.supabase.from("sprints").delete().eq("id", sprintId);
  if (error) return { ok: false, message: error.message };

  // Best effort: sweep what the row cascade can't reach — the sprint's uploads
  // in storage, and everyone's notifications that deep-link to this sprint
  // (question/reply fan-outs); left alone they'd 404 from the bell. The
  // notification sweep needs the service client: other users' rows are outside
  // this admin's RLS. Both run in one wave; failures never block the delete.
  const [{ data: files }, { data: proofOwners }] = await Promise.all([
    ctx.supabase.storage.from("learn").list(sprintId),
    // Proof files live under "proof/<uid>/<sprintId>/…" (the prefix the storage
    // policy gates on), so they're outside the sprint's own folder and the list
    // above never sees them. One extra listing per person who handed anything
    // in — deleting a sprint is rare, and the alternative is files nobody can
    // find still sitting in the bucket.
    ctx.supabase.storage.from("learn").list("proof"),
    createServiceClient()
      .from("notifications")
      .delete()
      .eq("href", `/learn/${sprintId}`),
  ]);
  if (files && files.length > 0) {
    await ctx.supabase.storage
      .from("learn")
      .remove(files.map((f) => `${sprintId}/${f.name}`));
  }
  if (proofOwners && proofOwners.length > 0) {
    const listings = await Promise.all(
      proofOwners.map((owner) =>
        ctx.supabase.storage.from("learn").list(`proof/${owner.name}/${sprintId}`)
      )
    );
    const paths = listings.flatMap((listing, index) =>
      (listing.data ?? []).map(
        (file) => `proof/${proofOwners[index].name}/${sprintId}/${file.name}`
      )
    );
    if (paths.length > 0) await ctx.supabase.storage.from("learn").remove(paths);
  }

  revalidatePath("/learn");
  redirect("/learn");
}

/** Starts today, keeps the duration, copies goals + participants (not files). */
export async function duplicateSprint(sprintId: string): Promise<SprintResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const [{ data: sprint }, { data: goals }, { data: participants }, { data: stages }] =
    await Promise.all([
      ctx.supabase.from("sprints").select("*").eq("id", sprintId).maybeSingle(),
      ctx.supabase
        .from("sprint_goals")
        .select("title, sort_order, stage_id, is_proof")
        .eq("sprint_id", sprintId)
        .order("sort_order")
        .order("created_at"),
      ctx.supabase
        .from("sprint_participants")
        .select("user_id")
        .eq("sprint_id", sprintId),
      ctx.supabase
        .from("sprint_stages")
        .select("*")
        .eq("sprint_id", sprintId)
        .order("sort_order"),
    ]);
  if (!sprint) return { ok: false, message: "Sprint not found." };

  const dayMs = 24 * 60 * 60 * 1000;
  const durationDays = Math.max(
    0,
    Math.round(
      (Date.parse(sprint.ends_on) - Date.parse(sprint.starts_on)) / dayMs
    )
  );
  const today = todayInIstanbul();
  const ends = addDays(today, durationDays);

  const { data: copy, error } = await ctx.supabase
    .from("sprints")
    .insert({
      title: `${sprint.title} (copy)`.slice(0, 120),
      description: sprint.description,
      starts_on: today,
      ends_on: ends,
      join_mode: sprint.join_mode,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !copy) return { ok: false, message: error?.message ?? "Failed." };

  // Stages first: the goals carry stage_id, so the copy needs old id → new id
  // before it can be written. This is the one place a second wave is required.
  const stageIdMap = new Map<string, string>();
  if (stages && stages.length > 0) {
    const { data: newStages, error: stageError } = await ctx.supabase
      .from("sprint_stages")
      .insert(
        stages.map((s, i) => ({
          sprint_id: copy.id,
          title: s.title,
          summary: s.summary,
          proof: s.proof,
          kind: s.kind,
          day_from: s.day_from,
          day_to: s.day_to,
          hours_low: s.hours_low,
          hours_high: s.hours_high,
          sort_order: i,
        }))
      )
      .select("id, sort_order");
    if (stageError) {
      return {
        ok: false,
        id: copy.id,
        message: `Duplicated, but the stages failed: ${stageError.message}`,
      };
    }
    // Insert returns rows in input order, but pair on sort_order rather than
    // trust that — the index is what we just wrote and controlled.
    for (const created of newStages ?? []) {
      const source = stages[created.sort_order];
      if (source) stageIdMap.set(source.id, created.id);
    }
  }

  const results = await Promise.all([
    goals && goals.length > 0
      ? ctx.supabase.from("sprint_goals").insert(
          goals.map((g, i) => ({
            sprint_id: copy.id,
            title: g.title,
            sort_order: i,
            stage_id: g.stage_id ? (stageIdMap.get(g.stage_id) ?? null) : null,
            is_proof: g.is_proof,
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
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
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

/**
 * Self-enrollment on an `open` sprint. RLS is the real gate (open + not ended +
 * your own row); this only translates its refusal into a sentence.
 */
export async function joinSprint(sprintId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");
  if (!sprintId) return { ok: false, message: "Missing sprint id." };

  // DO NOTHING on conflict: joining a sprint you're already in is a no-op, and
  // the merge form is an UPDATE only admins have a policy for.
  const { error } = await ctx.supabase
    .from("sprint_participants")
    .upsert(
      { sprint_id: sprintId, user_id: ctx.userId },
      { onConflict: "sprint_id,user_id", ignoreDuplicates: true }
    );
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "This sprint isn't open to join."
          : error.message,
    };
  }

  revalidatePath("/learn");
  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "You're in." };
}

/** Leaving is only possible before the sprint starts — RLS enforces the window. */
export async function leaveSprint(sprintId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  const { error, count } = await ctx.supabase
    .from("sprint_participants")
    .delete({ count: "exact" })
    .eq("sprint_id", sprintId)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, message: error.message };
  // RLS filters the row out rather than erroring, so a no-op delete is the
  // "sprint already started" case.
  if (count === 0) {
    return { ok: false, message: "The sprint has started — you can't leave now." };
  }

  revalidatePath("/learn");
  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "You left the sprint." };
}

/** Add one or many goals at once (one per line). Batch is the default flow. */
export async function addGoals(
  sprintId: string,
  titles: string[],
  startOrder: number
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
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

/**
 * Rename in place, and optionally reword the line under it. A blank title keeps
 * the old one (no required fields); `detail` left undefined is untouched, while
 * an empty string clears it — the two are different intents.
 */
export async function updateGoal(
  goalId: string,
  sprintId: string,
  title: string,
  detail?: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const next = title.trim().slice(0, 200);
  const fields: { title?: string; detail?: string | null } = {};
  if (next) fields.title = next;
  if (detail !== undefined) fields.detail = detail.trim().slice(0, 600) || null;
  if (Object.keys(fields).length === 0) return { ok: true, message: "Kept the old title." };

  const { error } = await ctx.supabase
    .from("sprint_goals")
    .update(fields)
    .eq("id", goalId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: fields.title ? "Goal renamed." : "Goal saved." };
}

/** Persist a full ordering — parallel updates, one wave. */
export async function reorderGoals(
  sprintId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
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
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const { error } = await ctx.supabase.from("sprint_goals").delete().eq("id", goalId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Goal removed." };
}

/* ---------------------------------------------------------------- stages -- */

export type StageDraft = {
  title: string;
  summary: string;
  /** The paragraphs behind the summary. */
  detail: string;
  proof: string;
  /** The proof at length — what to actually do. */
  proof_brief: string;
  /** What to hand in, in the imperative. */
  proof_submit: string;
  kind: "stage" | "capstone";
  day_from: number | null;
  day_to: number | null;
  hours_low: number | null;
  hours_high: number | null;
};

function stageFields(draft: Partial<StageDraft>) {
  const clampDay = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) || n < 1 ? null : Math.min(365, Math.round(n));
  const clampHours = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) || n < 0 ? null : Math.min(999, Math.round(n));

  const dayFrom = clampDay(draft.day_from);
  let dayTo = clampDay(draft.day_to);
  if (dayFrom !== null && dayTo !== null && dayTo < dayFrom) dayTo = dayFrom;
  const hoursLow = clampHours(draft.hours_low);
  let hoursHigh = clampHours(draft.hours_high);
  if (hoursLow !== null && hoursHigh !== null && hoursHigh < hoursLow) {
    hoursHigh = hoursLow;
  }

  return {
    // No required fields, same as sprints: a blank stage is still a stage.
    title: (draft.title ?? "").trim().slice(0, 120) || "Untitled stage",
    summary: (draft.summary ?? "").trim().slice(0, 600) || null,
    detail: (draft.detail ?? "").trim().slice(0, 4000) || null,
    proof: (draft.proof ?? "").trim().slice(0, 400) || null,
    proof_brief: (draft.proof_brief ?? "").trim().slice(0, 2000) || null,
    proof_submit: (draft.proof_submit ?? "").trim().slice(0, 600) || null,
    kind: draft.kind === "capstone" ? "capstone" : "stage",
    day_from: dayFrom,
    day_to: dayTo,
    hours_low: hoursLow,
    hours_high: hoursHigh,
  };
}

export async function addStage(
  sprintId: string,
  draft: Partial<StageDraft>,
  sortOrder: number
): Promise<SprintResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();
  if (!sprintId) return { ok: false, message: "Missing sprint id." };

  const { data, error } = await ctx.supabase
    .from("sprint_stages")
    .insert({ sprint_id: sprintId, ...stageFields(draft), sort_order: sortOrder })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Failed." };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, id: data.id, message: "Stage added." };
}

export async function updateStage(
  stageId: string,
  sprintId: string,
  draft: Partial<StageDraft>
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const { error } = await ctx.supabase
    .from("sprint_stages")
    .update(stageFields(draft))
    .eq("id", stageId)
    .eq("sprint_id", sprintId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Stage saved." };
}

/** Goals cascade with the stage — the delete confirm says so. */
export async function removeStage(
  stageId: string,
  sprintId: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const { error } = await ctx.supabase
    .from("sprint_stages")
    .delete()
    .eq("id", stageId)
    .eq("sprint_id", sprintId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Stage removed." };
}

export async function reorderStages(
  sprintId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();
  if (orderedIds.length === 0) return { ok: true, message: "Nothing to order." };

  const results = await Promise.all(
    orderedIds.map((id, i) =>
      ctx.supabase
        .from("sprint_stages")
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

/** Move a goal between stages (null = unstaged) and/or flag it as the proof. */
export async function setGoalStage(
  goalId: string,
  sprintId: string,
  stageId: string | null,
  isProof = false
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  // One proof per stage is a unique index — clear the incumbent first so
  // promoting a different goal reads as a move, not an error.
  if (isProof && stageId) {
    const { error: clearError } = await ctx.supabase
      .from("sprint_goals")
      .update({ is_proof: false })
      .eq("stage_id", stageId)
      .eq("is_proof", true)
      .neq("id", goalId);
    if (clearError) return { ok: false, message: clearError.message };
  }

  const { error } = await ctx.supabase
    .from("sprint_goals")
    .update({ stage_id: stageId, is_proof: isProof && stageId !== null })
    .eq("id", goalId)
    .eq("sprint_id", sprintId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Goal moved." };
}

/** Link and/or uploaded file (file is uploaded client-side to the `learn` bucket first). */
export async function addResource(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
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
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
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

/**
 * Q&A: any learn member asks; audience 'everyone' notifies the section,
 * 'admins' stays between the asker and the admins (RLS enforces visibility).
 */
export async function askQuestion(
  sprintId: string,
  body: string,
  audience: "everyone" | "admins"
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, message: "Write a question first." };
  if (!sprintId) return { ok: false, message: "Missing sprint id." };

  const { error } = await ctx.supabase.from("sprint_questions").insert({
    sprint_id: sprintId,
    created_by: ctx.userId,
    body: text,
    audience: audience === "admins" ? "admins" : "everyone",
  });
  if (error) return { ok: false, message: error.message };

  const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  if (audience === "admins") {
    notifyAdmins(ctx, {
      kind: "learn_question",
      title: `Question for admins: “${preview}”`,
      href: `/learn/${sprintId}`,
    });
  } else {
    notifySection(ctx, "learn", {
      kind: "learn_question",
      title: `New question: “${preview}”`,
      href: `/learn/${sprintId}`,
    });
  }

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Question posted." };
}

export async function replyToQuestion(
  questionId: string,
  sprintId: string,
  body: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, message: "Write a reply first." };

  // The asker is looked up before the insert (same wave as nothing — it's the
  // only read) so the notification can target them; RLS hides questions this
  // user may not see, which also blocks replying to them.
  const { data: question } = await ctx.supabase
    .from("sprint_questions")
    .select("created_by, body")
    .eq("id", questionId)
    .maybeSingle();
  if (!question) return { ok: false, message: "Question not found." };

  const { error } = await ctx.supabase.from("sprint_question_replies").insert({
    question_id: questionId,
    created_by: ctx.userId,
    body: text,
  });
  if (error) return { ok: false, message: error.message };

  if (question.created_by) {
    const preview =
      question.body.length > 60 ? `${question.body.slice(0, 60)}…` : question.body;
    notifyUser(ctx, question.created_by, {
      kind: "learn_answer",
      title: `Reply to your question “${preview}”`,
      href: `/learn/${sprintId}`,
    });
  }

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Reply posted." };
}

export async function deleteQuestion(
  questionId: string,
  sprintId: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  // RLS: only the asker or an admin may delete (replies cascade).
  const { error } = await ctx.supabase
    .from("sprint_questions")
    .delete()
    .eq("id", questionId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Question removed." };
}

export async function deleteReply(
  replyId: string,
  sprintId: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  const { error } = await ctx.supabase
    .from("sprint_question_replies")
    .delete()
    .eq("id", replyId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Reply removed." };
}

/** Participants tick their OWN goals; RLS restricts rows to user_id = auth.uid(). */
export async function toggleGoalProgress(
  goalId: string,
  sprintId: string,
  done: boolean
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  // ON CONFLICT DO NOTHING, not merge: ticking an already-ticked goal (a stale
  // tab, a double click) has nothing to write, and the merge form is an UPDATE
  // this table has no policy for — see the note in submitProof.
  const { error } = done
    ? await ctx.supabase
        .from("sprint_goal_progress")
        .upsert(
          { goal_id: goalId, user_id: ctx.userId },
          { onConflict: "goal_id,user_id", ignoreDuplicates: true }
        )
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

/**
 * The playbook's twin of toggleGoalProgress: same participant gate, same
 * per-person store, different noun. Kept separate from the goal toggle because
 * watching a video is not clearing a goal — a stage stays uncleared however
 * much of its reading you've done, and the two counts must not merge.
 */
export async function toggleResourceWatched(
  resourceId: string,
  sprintId: string,
  watched: boolean
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  const { error } = watched
    ? await ctx.supabase
        .from("sprint_resource_progress")
        .upsert(
          { resource_id: resourceId, user_id: ctx.userId },
          { onConflict: "resource_id,user_id", ignoreDuplicates: true }
        )
    : await ctx.supabase
        .from("sprint_resource_progress")
        .delete()
        .eq("resource_id", resourceId)
        .eq("user_id", ctx.userId);
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "You're not a participant of this sprint."
          : error.message,
    };
  }

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: watched ? "Marked watched." : "Unmarked." };
}

/* ------------------------------------------------------------------- proof --
 *
 * A stage's gate is handed in, not ticked (0061). Everything below is that one
 * idea: the learner sends text and/or a file, which clears the stage; an admin
 * reads it afterwards and says whether it holds.
 */

/** Replace a stage's acceptance criteria wholesale — they carry no per-person state. */
export async function setStageCriteria(
  stageId: string,
  sprintId: string,
  lines: string[]
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const rows = lines
    .map((line) => line.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 12)
    .map((body, i) => ({ stage_id: stageId, body, sort_order: i }));

  const { error: wipeError } = await ctx.supabase
    .from("sprint_proof_criteria")
    .delete()
    .eq("stage_id", stageId);
  if (wipeError) return { ok: false, message: wipeError.message };

  if (rows.length > 0) {
    const { error } = await ctx.supabase.from("sprint_proof_criteria").insert(rows);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/learn/${sprintId}`);
  return {
    ok: true,
    message: rows.length === 0 ? "Acceptance cleared." : `${rows.length} conditions saved.`,
  };
}

export type ProofDraft = {
  body: string;
  /** Uploaded client-side to `learn/proof/<uid>/…` before this runs. */
  filePath: string | null;
  fileName: string | null;
};

/**
 * Hand in the proof for a stage — and clear the stage in the same action.
 *
 * The two writes are deliberately one call. If handing in and ticking were
 * separate the two could disagree, and the disagreement everyone would hit is
 * the useless one: a proof goal ticked with nothing behind it. Handing in
 * again (a better answer, a fixed file) edits the same row and puts it back in
 * review — which is what the RLS with_check enforces, so a caller can't quietly
 * keep an old "accepted".
 */
export async function submitProof(
  sprintId: string,
  stageId: string,
  draft: ProofDraft
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  const body = draft.body.trim().slice(0, 8000);
  const filePath = draft.filePath?.trim() || null;
  if (!body && !filePath) {
    return { ok: false, message: "Write your proof or attach a file first." };
  }
  if (!sprintId || !stageId) return { ok: false, message: "Missing stage id." };

  // Both reads in one wave: the file being replaced (to delete after), and the
  // stage's proof goal (to tick). The goal is looked up here rather than passed
  // in — the client shouldn't get to name which goal a hand-in clears.
  const [{ data: existing }, { data: proofGoal }] = await Promise.all([
    ctx.supabase
      .from("sprint_proof_submissions")
      .select("file_path")
      .eq("stage_id", stageId)
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    ctx.supabase
      .from("sprint_goals")
      .select("id")
      .eq("stage_id", stageId)
      .eq("is_proof", true)
      .maybeSingle(),
  ]);

  const { error } = await ctx.supabase.from("sprint_proof_submissions").upsert(
    {
      stage_id: stageId,
      sprint_id: sprintId,
      user_id: ctx.userId,
      body: body || null,
      file_path: filePath,
      file_name: draft.fileName?.trim().slice(0, 200) || null,
      status: "submitted",
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stage_id,user_id" }
  );
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "You're not a participant of this sprint."
          : error.message,
    };
  }

  // The tick. A failure here is reported, but the hand-in stays: the evidence
  // landing matters more than the checkbox, and re-submitting retries it.
  //
  // ignoreDuplicates, i.e. ON CONFLICT DO NOTHING, because the second hand-in
  // for a stage lands on a goal this action already ticked. The merge form
  // would be an UPDATE, and this table grants INSERT/DELETE only (0001, 0053) —
  // a re-submit died on "violates row-level security policy (USING expression)".
  // Nothing to merge anyway: the row is the fact that you cleared the goal, and
  // completed_at should stay the moment you first did.
  if (proofGoal) {
    const { error: tickError } = await ctx.supabase
      .from("sprint_goal_progress")
      .upsert(
        { goal_id: proofGoal.id, user_id: ctx.userId },
        { onConflict: "goal_id,user_id", ignoreDuplicates: true }
      );
    if (tickError) return { ok: false, message: tickError.message };
  }

  // The replaced file, now that the row no longer points at it.
  if (existing?.file_path && existing.file_path !== filePath) {
    await ctx.supabase.storage.from("learn").remove([existing.file_path]);
  }

  const { data: stage } = await ctx.supabase
    .from("sprint_stages")
    .select("title")
    .eq("id", stageId)
    .maybeSingle();

  notifyAdmins(ctx, {
    kind: "learn_proof",
    title: `Proof handed in for “${stage?.title ?? "a stage"}”`,
    href: `/learn/${sprintId}`,
  });

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Handed in — stage cleared." };
}

/**
 * Take a hand-in back. It unticks the proof goal too: the tick was the claim
 * the hand-in made, so it can't outlive it.
 */
export async function withdrawProof(
  sprintId: string,
  stageId: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireSection("learn");

  const [{ data: existing }, { data: proofGoal }] = await Promise.all([
    ctx.supabase
      .from("sprint_proof_submissions")
      .select("file_path")
      .eq("stage_id", stageId)
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    ctx.supabase
      .from("sprint_goals")
      .select("id")
      .eq("stage_id", stageId)
      .eq("is_proof", true)
      .maybeSingle(),
  ]);

  const { error } = await ctx.supabase
    .from("sprint_proof_submissions")
    .delete()
    .eq("stage_id", stageId)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, message: error.message };

  if (proofGoal) {
    await ctx.supabase
      .from("sprint_goal_progress")
      .delete()
      .eq("goal_id", proofGoal.id)
      .eq("user_id", ctx.userId);
  }
  if (existing?.file_path) {
    await ctx.supabase.storage.from("learn").remove([existing.file_path]);
  }

  revalidatePath(`/learn/${sprintId}`);
  return { ok: true, message: "Hand-in withdrawn." };
}

/**
 * An admin's verdict on a hand-in. It changes what the row says, never what
 * the rail shows: the stage was cleared by the hand-in and stays cleared even
 * when changes are asked for, because "you did this on Tuesday" is still true.
 * What changes is that the person is told what's missing.
 */
export async function reviewProof(
  submissionId: string,
  sprintId: string,
  decision: "accepted" | "changes_requested",
  note: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("learn");
  if (stop) return stop;
  const ctx = await requireAdmin();

  const text = note.trim().slice(0, 2000);
  if (decision === "changes_requested" && !text) {
    return { ok: false, message: "Say what's missing — a bare rejection helps nobody." };
  }

  const { data: updated, error } = await ctx.supabase
    .from("sprint_proof_submissions")
    .update({
      status: decision,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      review_note: text || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("sprint_id", sprintId)
    .select("user_id, stage_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!updated) return { ok: false, message: "That hand-in is gone." };

  const { data: stage } = await ctx.supabase
    .from("sprint_stages")
    .select("title")
    .eq("id", updated.stage_id)
    .maybeSingle();

  notifyUser(ctx, updated.user_id, {
    kind: "learn_review",
    title:
      decision === "accepted"
        ? `Proof accepted — ${stage?.title ?? "your stage"}`
        : `Changes asked for — ${stage?.title ?? "your stage"}`,
    href: `/learn/${sprintId}`,
  });

  revalidatePath(`/learn/${sprintId}`);
  return {
    ok: true,
    message: decision === "accepted" ? "Accepted." : "Changes requested.",
  };
}
