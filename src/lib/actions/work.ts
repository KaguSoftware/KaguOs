"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { blockIfShowcase, requireSection, type SessionContext } from "@/lib/data/session";
import { notifySection, notifyUser } from "@/lib/actions/notify";
import type { ActionResult } from "@/lib/actions/account";
import type { ProjectStatus } from "@/lib/types";

/**
 * After the response, look up an idea's author and notify them a comment
 * landed. The SELECT is deferred so the comment save never waits on it.
 */
function notifyIdeaAuthor(ctx: SessionContext, ideaId: string) {
  after(async () => {
    const { data: idea } = await ctx.supabase
      .from("ideas")
      .select("title, created_by")
      .eq("id", ideaId)
      .single();
    if (idea?.created_by) {
      notifyUser(ctx, idea.created_by, {
        kind: "idea_comment",
        title: `New comment on "${idea.title}"`,
        href: `/work/ideas/${ideaId}`,
      });
    }
  });
}

const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "paused", "done"];

function cleanUrl(value: FormDataEntryValue | null): string | null {
  const url = String(value ?? "").trim();
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

function projectFields(formData: FormData) {
  // No required fields (create-flow rule) — fallbacks keep NOT NULL columns valid.
  const name =
    String(formData.get("name") ?? "").trim().slice(0, 120) || "Untitled project";
  const status = String(formData.get("status") ?? "planning") as ProjectStatus;
  return {
    name,
    client: String(formData.get("client") ?? "").trim() || null,
    status: PROJECT_STATUSES.includes(status) ? status : "planning",
    sector: String(formData.get("sector") ?? "").trim() || null,
    type: String(formData.get("type") ?? "").trim() || null,
    repo_url: cleanUrl(formData.get("repo_url")),
    prod_url: cleanUrl(formData.get("prod_url")),
    notes: String(formData.get("notes") ?? "").trim() || null,
    due_on: String(formData.get("due_on") ?? "").trim() || null,
  };
}

export async function createProject(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");
  const fields = projectFields(formData);

  const { error } = await ctx.supabase
    .from("projects")
    .insert({ ...fields, created_by: ctx.userId });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/work");
  return { ok: true, message: "Project created." };
}

export async function updateProject(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");
  const id = String(formData.get("id") ?? "");
  const fields = projectFields(formData);
  if (!id) return { ok: false, message: "Missing project id." };

  const { error } = await ctx.supabase.from("projects").update(fields).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/work");
  revalidatePath(`/work/projects/${id}`);
  return { ok: true, message: "Saved." };
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { error } = await ctx.supabase.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/work");
  redirect("/work");
}

export async function createIdea(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");
  const title =
    String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled idea";
  const body = String(formData.get("body") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "").trim() || null;

  // Snapshot how many people must unanimously upvote this to auto-promote, at
  // the moment it's posted. Freezing it here means a teammate who joins Work
  // later can't retroactively "un-pass" an idea that already cleared the bar.
  const { data: requiredCount } = await ctx.supabase.rpc("work_access_count");

  const { error } = await ctx.supabase.from("ideas").insert({
    title,
    body: body || null,
    sector,
    type,
    created_by: ctx.userId,
    required_count: requiredCount ?? null,
  });
  if (error) return { ok: false, message: error.message };

  notifySection(ctx, "work", {
    kind: "idea_new",
    title: `New idea: ${title}`,
    href: "/work?tab=ideas",
  });

  revalidatePath("/work");
  return { ok: true, message: "Idea posted." };
}

export async function updateIdea(
  ideaId: string,
  fields: { title: string; body: string }
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");
  const title = fields.title.trim().slice(0, 200);
  if (!title) return { ok: false, message: "An idea needs a title." };

  const { error } = await ctx.supabase
    .from("ideas")
    .update({ title, body: fields.body.trim() || null })
    .eq("id", ideaId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/work");
  revalidatePath(`/work/ideas/${ideaId}`);
  return { ok: true, message: "Idea updated." };
}

/**
 * Cast, change, or clear this user's vote on an idea.
 *   value  1 → upvote, -1 → downvote, 0 → remove my vote entirely
 * After the write, if the idea just reached a unanimous upvote it auto-promotes
 * to a project (see maybeAutoPromote). Returns { promotedProjectId } on that path
 * so the client can route to the new project.
 */
export async function setVote(
  ideaId: string,
  value: -1 | 0 | 1
): Promise<ActionResult & { promotedProjectId?: string }> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { error } =
    value === 0
      ? await ctx.supabase
          .from("idea_votes")
          .delete()
          .eq("idea_id", ideaId)
          .eq("user_id", ctx.userId)
      : await ctx.supabase
          .from("idea_votes")
          .upsert({ idea_id: ideaId, user_id: ctx.userId, value });
  if (error) return { ok: false, message: error.message };

  // A fresh upvote is the only thing that can push an idea over the unanimous
  // line — a downvote or a removal never promotes, so only check on value === 1.
  let promotedProjectId: string | undefined;
  if (value === 1) {
    const promoted = await maybeAutoPromote(ctx, ideaId);
    if (promoted) promotedProjectId = promoted;
  }

  revalidatePath("/work");
  revalidatePath(`/work/ideas/${ideaId}`);
  const message =
    value === 0 ? "Vote removed." : value === 1 ? "Upvoted." : "Downvoted.";
  return { ok: true, message, promotedProjectId };
}

export async function addComment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");
  const ideaId = String(formData.get("idea_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!ideaId) return { ok: false, message: "Missing idea id." };
  if (body.length < 1) return { ok: false, message: "Write something first." };

  const { error } = await ctx.supabase
    .from("idea_comments")
    .insert({ idea_id: ideaId, body, created_by: ctx.userId });
  if (error) return { ok: false, message: error.message };

  // Let the idea's author know someone weighed in — off the critical path.
  // The author lookup + notify run after the response (inside notifyIdeaAuthor).
  notifyIdeaAuthor(ctx, ideaId);

  revalidatePath(`/work/ideas/${ideaId}`);
  return { ok: true, message: "Comment added." };
}

export async function deleteComment(
  commentId: string,
  ideaId: string
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { error } = await ctx.supabase
    .from("idea_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/work/ideas/${ideaId}`);
  return { ok: true, message: "Comment deleted." };
}

type IdeaForPromotion = {
  id: string;
  title: string;
  body: string | null;
  sector: string | null;
  type: string | null;
  status: string;
  created_by: string | null;
};

/**
 * Shared idea → project core, used by BOTH the manual "Promote" button and the
 * unanimous auto-promote. Creates the project, flips the idea to promoted, and
 * notifies the author. Returns the new project id (or an error) — the caller
 * decides whether to redirect (manual) or hand the id back to the client (auto).
 * Does NOT redirect or revalidate; that's the caller's job.
 */
async function promoteIdeaCore(
  ctx: SessionContext,
  idea: IdeaForPromotion,
  auto: boolean
): Promise<{ ok: true; projectId: string } | { ok: false; message: string }> {
  const { data: project, error: createError } = await ctx.supabase
    .from("projects")
    .insert({
      name: idea.title,
      notes: idea.body,
      status: "planning",
      sector: idea.sector,
      type: idea.type,
      created_by: idea.created_by ?? ctx.userId,
    })
    .select("id")
    .single();
  if (createError || !project) {
    return { ok: false, message: createError?.message ?? "Could not create project." };
  }

  const { error: updateError } = await ctx.supabase
    .from("ideas")
    .update({
      status: "promoted",
      stage: "promoted",
      promoted_project_id: project.id,
    })
    .eq("id", idea.id);
  if (updateError) {
    // Roll the orphan project back, best effort.
    await ctx.supabase.from("projects").delete().eq("id", project.id);
    return { ok: false, message: updateError.message };
  }

  if (idea.created_by) {
    notifyUser(ctx, idea.created_by, {
      kind: "idea_promoted",
      title: auto
        ? `Your idea "${idea.title}" was voted in — it's now a project`
        : `Your idea "${idea.title}" became a project`,
      href: `/work/projects/${project.id}`,
    });
  }

  return { ok: true, projectId: project.id };
}

/**
 * After a fresh upvote, promote the idea IFF everyone with Work access has
 * upvoted it and nobody has downvoted (a downvote is a veto). The bar is the
 * required_count snapshot taken when the idea was posted; a lone person voting
 * on their own idea (required_count < 2) never auto-promotes. Showcase ideas
 * never auto-promote — demo data must stay inert. Returns the new project id
 * when it promoted, otherwise null. Best-effort: a failure here never fails the
 * vote itself (the vote already landed).
 */
async function maybeAutoPromote(
  ctx: SessionContext,
  ideaId: string
): Promise<string | null> {
  if (ctx.showcase) return null;

  const { data: idea } = await ctx.supabase
    .from("ideas")
    .select("id, title, body, sector, type, status, created_by, required_count")
    .eq("id", ideaId)
    .single();
  if (!idea || idea.status !== "open") return null;

  const required = idea.required_count ?? 0;
  if (required < 2) return null;

  const { data: votes } = await ctx.supabase
    .from("idea_votes")
    .select("value")
    .eq("idea_id", ideaId);
  const upvotes = (votes ?? []).filter((v) => v.value === 1).length;
  const downvotes = (votes ?? []).filter((v) => v.value === -1).length;

  // Unanimous means EVERYONE with access actively upvoted and no one vetoed.
  if (downvotes > 0 || upvotes < required) return null;

  const result = await promoteIdeaCore(ctx, idea, true);
  if (!result.ok) return null;

  notifySection(ctx, "work", {
    kind: "idea_promoted",
    title: `"${idea.title}" was voted in and became a project`,
    href: `/work/projects/${result.projectId}`,
  });
  return result.projectId;
}

/** Idea → project (manual button). Creates the project, then redirects to it. */
export async function promoteIdea(ideaId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { data: idea, error: readError } = await ctx.supabase
    .from("ideas")
    .select("id, title, body, sector, type, status, created_by")
    .eq("id", ideaId)
    .single();
  if (readError || !idea) return { ok: false, message: "Idea not found." };
  if (idea.status === "promoted") {
    return { ok: false, message: "Already promoted." };
  }

  const result = await promoteIdeaCore(ctx, idea, false);
  if (!result.ok) return result;

  revalidatePath("/work");
  redirect(`/work/projects/${result.projectId}`);
}

export async function setIdeaStatus(
  ideaId: string,
  status: "open" | "archived"
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { error } = await ctx.supabase
    .from("ideas")
    .update({ status })
    .eq("id", ideaId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/work");
  revalidatePath(`/work/ideas/${ideaId}`);
  return { ok: true, message: status === "archived" ? "Idea archived." : "Idea reopened." };
}

export async function deleteIdea(ideaId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { error } = await ctx.supabase.from("ideas").delete().eq("id", ideaId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/work");
  redirect("/work?tab=ideas");
}
