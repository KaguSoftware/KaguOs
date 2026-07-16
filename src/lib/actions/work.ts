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

  const { error } = await ctx.supabase
    .from("ideas")
    .insert({ title, body: body || null, sector, type, created_by: ctx.userId });
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

export async function toggleVote(ideaId: string, hasVoted: boolean): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { error } = hasVoted
    ? await ctx.supabase
        .from("idea_votes")
        .delete()
        .eq("idea_id", ideaId)
        .eq("user_id", ctx.userId)
    : await ctx.supabase
        .from("idea_votes")
        .upsert({ idea_id: ideaId, user_id: ctx.userId });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/work");
  revalidatePath(`/work/ideas/${ideaId}`);
  return { ok: true, message: hasVoted ? "Vote removed." : "Voted." };
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

/** Idea → project. Creates the project, then marks the idea promoted. */
export async function promoteIdea(ideaId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("work");

  const { data: idea, error: readError } = await ctx.supabase
    .from("ideas")
    .select("*")
    .eq("id", ideaId)
    .single();
  if (readError || !idea) return { ok: false, message: "Idea not found." };
  if (idea.status === "promoted") {
    return { ok: false, message: "Already promoted." };
  }

  const { data: project, error: createError } = await ctx.supabase
    .from("projects")
    .insert({
      name: idea.title,
      notes: idea.body,
      status: "planning",
      sector: idea.sector,
      type: idea.type,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (createError || !project) {
    return { ok: false, message: createError?.message ?? "Could not create project." };
  }

  const { error: updateError } = await ctx.supabase
    .from("ideas")
    .update({ status: "promoted", promoted_project_id: project.id })
    .eq("id", ideaId);
  if (updateError) {
    // Roll the orphan project back, best effort.
    await ctx.supabase.from("projects").delete().eq("id", project.id);
    return { ok: false, message: updateError.message };
  }

  if (idea.created_by) {
    notifyUser(ctx, idea.created_by, {
      kind: "idea_promoted",
      title: `Your idea "${idea.title}" became a project`,
      href: `/work/projects/${project.id}`,
    });
  }

  revalidatePath("/work");
  redirect(`/work/projects/${project.id}`);
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
