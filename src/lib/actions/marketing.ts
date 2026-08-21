"use server";

import { revalidatePath } from "next/cache";
import { blockIfReadOnly, requireSection } from "@/lib/data/session";
import { notifyUser } from "@/lib/actions/notify";
import { nextPostStatus } from "@/lib/posts";
import { todayInIstanbul } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/account";
import type { CampaignStatus, PostStatus } from "@/lib/types";

const CAMPAIGN_STATUSES: CampaignStatus[] = ["idea", "planned", "running", "done"];
const POST_STATUSES: PostStatus[] = ["idea", "making", "scheduled", "posted"];
const CHANNELS = [
  "instagram", "linkedin", "x", "tiktok", "youtube",
  "google-ads", "meta-ads", "email", "seo", "website", "other",
];

function cleanUrl(value: FormDataEntryValue | null): string | null {
  const url = String(value ?? "").trim();
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

function text(value: FormDataEntryValue | null, max: number): string | null {
  return String(value ?? "").trim().slice(0, max) || null;
}

function cleanChannel(value: FormDataEntryValue | null, fallback: string) {
  const channel = String(value ?? "").trim();
  return CHANNELS.includes(channel) ? channel : fallback;
}

/* ── Clients ────────────────────────────────────────────────────────────── */

export async function createClient(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const engagement = String(formData.get("engagement_kind") ?? "retainer");
  const deliverablesRaw = String(formData.get("monthly_deliverables") ?? "").trim();
  const deliverables = deliverablesRaw ? Number(deliverablesRaw) : null;
  if (deliverables !== null && (!Number.isFinite(deliverables) || deliverables < 0)) {
    return { ok: false, message: "Posts per month must be a whole number." };
  }
  const currency = String(formData.get("currency") ?? "TRY");

  const { data, error } = await ctx.supabase
    .from("clients")
    .insert({
      name: text(formData.get("name"), 120) ?? "Untitled client",
      currency: ["TRY", "USD", "EUR"].includes(currency) ? currency : "TRY",
      engagement_kind: ["retainer", "project", "ad_fee"].includes(engagement)
        ? engagement
        : "retainer",
      monthly_deliverables: deliverables === null ? null : Math.round(deliverables),
      ad_account_owner:
        String(formData.get("ad_account_owner") ?? "client") === "kagu" ? "kagu" : "client",
      brand_notes: text(formData.get("brand_notes"), 4000),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  // The id rides back so the create surface can send them straight into the
  // workspace they just made, rather than to a list they have to find it in.
  return { ok: true, message: "Client created.", id: data.id };
}

export async function updateClient(
  clientId: string,
  patch: {
    status?: "active" | "paused" | "ended";
    engagement_kind?: "retainer" | "project" | "ad_fee";
    monthly_deliverables?: number | null;
    brand_notes?: string | null;
  }
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase.from("clients").update(patch).eq("id", clientId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/marketing/clients/${clientId}`);
  revalidatePath("/marketing");
  return { ok: true, message: "Saved." };
}

/* ── Posts ──────────────────────────────────────────────────────────────── */

export async function createPost(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { ok: false, message: "Pick a client — every post belongs to one." };

  const status = String(formData.get("status") ?? "idea") as PostStatus;

  const { data, error } = await ctx.supabase
    .from("marketing_posts")
    .insert({
      client_id: clientId,
      campaign_id: String(formData.get("campaign_id") ?? "").trim() || null,
      title: text(formData.get("title"), 200) ?? "Untitled post",
      channel: cleanChannel(formData.get("channel"), "instagram"),
      status: POST_STATUSES.includes(status) ? status : "idea",
      publish_on: String(formData.get("publish_on") ?? "") || null,
      url: cleanUrl(formData.get("url")),
      owner_id: String(formData.get("owner_id") ?? "").trim() || null,
      notes: text(formData.get("notes"), 8000),
      created_by: ctx.userId,
    })
    .select("id, owner_id, title")
    .single();
  if (error) return { ok: false, message: error.message };

  if (data.owner_id && data.owner_id !== ctx.userId) {
    notifyUser(ctx, data.owner_id, {
      kind: "creative_assigned",
      title: `On you: "${data.title}"`,
      href: `/marketing/posts/${data.id}`,
    });
  }

  revalidatePath("/marketing");
  revalidatePath(`/marketing/clients/${clientId}`);
  return { ok: true, message: "Post added.", id: data.id };
}

/**
 * Move a post one rung — the section's one-click primitive. It takes no target
 * status: the next state is a property of the current one, not something a
 * caller chooses. `expected` is the status the button was rendered against, so
 * a click on a stale card says "the board moved on" instead of double-stepping.
 */
export async function advancePost(
  postId: string,
  expected: PostStatus
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const next = nextPostStatus(expected);
  if (!next) return { ok: false, message: "That's the last step." };

  const { data, error } = await ctx.supabase
    .from("marketing_posts")
    .update({ status: next })
    .eq("id", postId)
    .eq("status", expected)
    .select("id, client_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "Someone else moved this one — refreshing." };
  }

  revalidatePath("/marketing");
  revalidatePath(`/marketing/posts/${postId}`);
  revalidatePath(`/marketing/clients/${data.client_id}`);
  // No message: the card has already moved under the cursor.
  return { ok: true, message: "" };
}

export async function updatePost(
  postId: string,
  patch: Partial<{
    title: string;
    channel: string;
    status: PostStatus;
    publish_on: string | null;
    url: string | null;
    owner_id: string | null;
    campaign_id: string | null;
    notes: string | null;
  }>
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  if (patch.status && !POST_STATUSES.includes(patch.status)) {
    return { ok: false, message: "Unknown status." };
  }
  if (patch.channel && !CHANNELS.includes(patch.channel)) {
    return { ok: false, message: "Unknown channel." };
  }

  const { data, error } = await ctx.supabase
    .from("marketing_posts")
    .update(patch)
    .eq("id", postId)
    .select("client_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That post no longer exists." };

  revalidatePath("/marketing");
  revalidatePath(`/marketing/posts/${postId}`);
  revalidatePath(`/marketing/clients/${data.client_id}`);
  return { ok: true, message: "" };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase.from("marketing_posts").delete().eq("id", postId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  return { ok: true, message: "Post deleted." };
}

/* ── Campaigns ──────────────────────────────────────────────────────────── */

export async function createCampaign(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { ok: false, message: "Pick a client." };

  const budgetRaw = String(formData.get("budget") ?? "").trim();
  const budget = budgetRaw ? Number(budgetRaw) : null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    return { ok: false, message: "Budget must be a number." };
  }
  const targetRaw = String(formData.get("goal_target") ?? "").trim();
  const goalTarget = targetRaw ? Number(targetRaw) : null;
  if (goalTarget !== null && (!Number.isFinite(goalTarget) || goalTarget < 0)) {
    return { ok: false, message: "Goal must be a number." };
  }
  const currency = String(formData.get("currency") ?? "TRY");
  const status = String(formData.get("status") ?? "idea") as CampaignStatus;
  const platform = String(formData.get("platform") ?? "").trim();
  const goalMetric = String(formData.get("goal_metric") ?? "").trim();

  const { error } = await ctx.supabase.from("marketing_campaigns").insert({
    client_id: clientId,
    name: text(formData.get("name"), 160) ?? "Untitled campaign",
    channel: cleanChannel(formData.get("channel"), "other"),
    platform: ["meta", "tiktok", "google", "other"].includes(platform) ? platform : null,
    status: CAMPAIGN_STATUSES.includes(status) ? status : "idea",
    starts_on: String(formData.get("starts_on") ?? "") || null,
    ends_on: String(formData.get("ends_on") ?? "") || null,
    budget,
    goal_metric: ["reach", "leads", "sales", "followers"].includes(goalMetric)
      ? goalMetric
      : null,
    goal_target: goalTarget,
    currency: ["TRY", "USD", "EUR"].includes(currency) ? currency : "TRY",
    url: cleanUrl(formData.get("url")),
    notes: text(formData.get("notes"), 4000),
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/marketing/clients/${clientId}`);
  revalidatePath("/marketing");
  return { ok: true, message: "Campaign created." };
}

export async function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");
  if (!CAMPAIGN_STATUSES.includes(status)) return { ok: false, message: "Invalid status." };

  const { data, error } = await ctx.supabase
    .from("marketing_campaigns")
    .update({ status })
    .eq("id", campaignId)
    .select("client_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  if (data?.client_id) revalidatePath(`/marketing/clients/${data.client_id}`);
  revalidatePath("/marketing");
  return { ok: true, message: "" };
}

/**
 * The retro. Separate from the rest of the campaign because it is written at a
 * different time by a different impulse — the campaign is set up once, and this
 * is filled in when it ends, by whoever ran it, while they still remember.
 */
export async function saveCampaignRetro(
  campaignId: string,
  worked: string,
  avoid: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const { data, error } = await ctx.supabase
    .from("marketing_campaigns")
    .update({
      retro_worked: worked.trim().slice(0, 4000) || null,
      retro_avoid: avoid.trim().slice(0, 4000) || null,
    })
    .eq("id", campaignId)
    .select("client_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  if (data?.client_id) revalidatePath(`/marketing/clients/${data.client_id}`);
  return { ok: true, message: "Retro saved." };
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase
    .from("marketing_campaigns")
    .delete()
    .eq("id", campaignId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  return { ok: true, message: "Campaign deleted." };
}

/* ── The ledger's marketing slice (0069) ────────────────────────────────── */

/**
 * A marketing expense (or, rarely, income) — written into THE company ledger
 * with category='marketing', never into a parallel one. The Finance tab and
 * the marketing Budget views render the same row. `marketing_client_id` says
 * who the money was spent for; null is general team spend.
 */
export async function logMarketingExpense(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const type = String(formData.get("type") ?? "expense");
  const currency = String(formData.get("currency") ?? "TRY");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be a positive number." };
  }

  const { error } = await ctx.supabase.from("transactions").insert({
    type: type === "income" ? "income" : "expense",
    amount,
    currency: ["TRY", "USD", "EUR"].includes(currency) ? currency : "TRY",
    status: "paid",
    occurred_on: String(formData.get("occurred_on") ?? "") || todayInIstanbul(),
    client: null,
    category: "marketing",
    marketing_client_id: String(formData.get("marketing_client_id") ?? "").trim() || null,
    campaign_id: String(formData.get("campaign_id") ?? "").trim() || null,
    notes: text(formData.get("notes"), 4000),
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  // The row also lives on the Finance tab — same ledger, second lens.
  revalidatePath("/management/finance");
  return { ok: true, message: "Expense logged." };
}

/* ── The link shelf (0070) ──────────────────────────────────────────────── */

export async function createMarketingLink(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const url = cleanUrl(formData.get("url"));
  if (!url) return { ok: false, message: "A link needs a URL." };

  const clientId = String(formData.get("client_id") ?? "").trim() || null;

  const { error } = await ctx.supabase.from("marketing_links").insert({
    client_id: clientId,
    title: text(formData.get("title"), 160) ?? "Untitled link",
    url,
    note: text(formData.get("note"), 500),
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  if (clientId) revalidatePath(`/marketing/clients/${clientId}`);
  return { ok: true, message: "Link added." };
}

export async function deleteMarketingLink(linkId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const { data, error } = await ctx.supabase
    .from("marketing_links")
    .delete()
    .eq("id", linkId)
    .select("client_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  if (data?.client_id) revalidatePath(`/marketing/clients/${data.client_id}`);
  return { ok: true, message: "Link removed." };
}
