"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";
import type { CampaignStatus, PostStatus } from "@/lib/types";

const CAMPAIGN_STATUSES: CampaignStatus[] = ["idea", "planned", "running", "done"];
const POST_STATUSES: PostStatus[] = ["draft", "scheduled", "published"];
const CHANNELS = [
  "instagram", "linkedin", "x", "tiktok", "youtube",
  "google-ads", "meta-ads", "email", "seo", "website", "other",
];

function cleanUrl(value: FormDataEntryValue | null): string | null {
  const url = String(value ?? "").trim();
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

function cleanChannel(value: FormDataEntryValue | null, fallback: string) {
  const channel = String(value ?? "").trim();
  return CHANNELS.includes(channel) ? channel : fallback;
}

export async function createCampaign(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireSection("marketing");

  const budgetRaw = String(formData.get("budget") ?? "").trim();
  const budget = budgetRaw ? Number(budgetRaw) : null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    return { ok: false, message: "Budget must be a number." };
  }
  const currency = String(formData.get("currency") ?? "TRY");
  const status = String(formData.get("status") ?? "idea") as CampaignStatus;

  const { error } = await ctx.supabase.from("marketing_campaigns").insert({
    name: String(formData.get("name") ?? "").trim().slice(0, 160) || "Untitled campaign",
    channel: cleanChannel(formData.get("channel"), "other"),
    status: CAMPAIGN_STATUSES.includes(status) ? status : "idea",
    starts_on: String(formData.get("starts_on") ?? "") || null,
    ends_on: String(formData.get("ends_on") ?? "") || null,
    budget,
    currency: ["TRY", "USD", "EUR"].includes(currency) ? currency : "TRY",
    url: cleanUrl(formData.get("url")),
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  return { ok: true, message: "Campaign created." };
}

export async function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus
): Promise<ActionResult> {
  const ctx = await requireSection("marketing");
  if (!CAMPAIGN_STATUSES.includes(status)) return { ok: false, message: "Invalid status." };

  const { error } = await ctx.supabase
    .from("marketing_campaigns")
    .update({ status })
    .eq("id", campaignId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  return { ok: true, message: "Status updated." };
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase
    .from("marketing_campaigns")
    .delete()
    .eq("id", campaignId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  return { ok: true, message: "Campaign deleted." };
}

export async function createPost(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireSection("marketing");

  const status = String(formData.get("status") ?? "draft") as PostStatus;
  const campaignId = String(formData.get("campaign_id") ?? "").trim() || null;
  const ownerId = String(formData.get("owner_id") ?? "").trim() || null;

  const { error } = await ctx.supabase.from("marketing_posts").insert({
    title: String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled post",
    channel: cleanChannel(formData.get("channel"), "instagram"),
    status: POST_STATUSES.includes(status) ? status : "draft",
    publish_on: String(formData.get("publish_on") ?? "") || null,
    url: cleanUrl(formData.get("url")),
    campaign_id: campaignId,
    owner_id: ownerId,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing/content");
  return { ok: true, message: "Post added to the calendar." };
}

export async function setPostStatus(
  postId: string,
  status: PostStatus
): Promise<ActionResult> {
  const ctx = await requireSection("marketing");
  if (!POST_STATUSES.includes(status)) return { ok: false, message: "Invalid status." };

  const { error } = await ctx.supabase
    .from("marketing_posts")
    .update({ status })
    .eq("id", postId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing/content");
  return { ok: true, message: "Status updated." };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase
    .from("marketing_posts")
    .delete()
    .eq("id", postId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing/content");
  return { ok: true, message: "Post deleted." };
}

export async function createLink(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase.from("marketing_items").insert({
    title: String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled link",
    url: cleanUrl(formData.get("url")),
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing/links");
  return { ok: true, message: "Link saved." };
}

export async function deleteLink(itemId: string): Promise<ActionResult> {
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase
    .from("marketing_items")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing/links");
  return { ok: true, message: "Link deleted." };
}
