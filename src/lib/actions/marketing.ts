"use server";

import { revalidatePath } from "next/cache";
import {
  blockIfReadOnly,
  getSessionContext,
  isClient,
  requireSection,
} from "@/lib/data/session";
import { notifyUser } from "@/lib/actions/notify";
import { nextStatus, parseTimecode } from "@/lib/creatives";
import type { ActionResult } from "@/lib/actions/account";
import type {
  CampaignStatus,
  CreativeKind,
  CreativeStatus,
  ReviewDecision,
} from "@/lib/types";

const CAMPAIGN_STATUSES: CampaignStatus[] = ["idea", "planned", "running", "done"];
const CREATIVE_STATUSES: CreativeStatus[] = [
  "idea", "scripted", "shot", "editing", "internal_review",
  "client_review", "changes_requested", "approved", "scheduled", "live",
];
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
    return { ok: false, message: "Videos per month must be a whole number." };
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

  revalidatePath("/marketing/clients");
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
  revalidatePath("/marketing/clients");
  return { ok: true, message: "Saved." };
}

/* ── Creatives ──────────────────────────────────────────────────────────── */

export async function createCreative(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { ok: false, message: "Pick a client — every video belongs to one." };

  const kind = String(formData.get("kind") ?? "organic") as CreativeKind;
  const parentId = String(formData.get("parent_creative_id") ?? "").trim() || null;

  const { data, error } = await ctx.supabase
    .from("creatives")
    .insert({
      client_id: clientId,
      campaign_id: String(formData.get("campaign_id") ?? "").trim() || null,
      title: text(formData.get("title"), 200) ?? "Untitled video",
      hook: text(formData.get("hook"), 500),
      script: text(formData.get("script"), 20000),
      owner_id: String(formData.get("owner_id") ?? "").trim() || null,
      editor_id: String(formData.get("editor_id") ?? "").trim() || null,
      shoot_date: String(formData.get("shoot_date") ?? "") || null,
      footage_url: cleanUrl(formData.get("footage_url")),
      channel: cleanChannel(formData.get("channel"), "instagram"),
      kind: kind === "ad" ? "ad" : "organic",
      parent_creative_id: parentId,
      created_by: ctx.userId,
    })
    .select("id, owner_id, title")
    .single();
  if (error) return { ok: false, message: error.message };

  if (data.owner_id && data.owner_id !== ctx.userId) {
    notifyUser(ctx, data.owner_id, {
      kind: "creative_assigned",
      title: `You're producing "${data.title}"`,
      href: `/marketing/creatives/${data.id}`,
    });
  }

  revalidatePath("/marketing");
  revalidatePath(`/marketing/clients/${clientId}`);
  return { ok: true, message: "Video added.", id: data.id };
}

/**
 * Move a video one rung. THE one-click primitive of this section (PRODUCT.md),
 * so it takes no arguments beyond the id: the next state is a property of the
 * current one, not something a caller gets to choose. A dropdown here would let
 * a video jump from `idea` to `live` with no footage.
 *
 * `expected` is the status the button was rendered against. Two people share
 * this board and the page is live-refreshed; without it, clicking a stale
 * "Send to client" on a video someone already sent would push it a step further
 * than anyone intended. Mismatch is not an error — the board has simply moved
 * on, and saying so is more useful than a failure.
 */
export async function advanceCreative(
  creativeId: string,
  expected: CreativeStatus
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const next = nextStatus(expected);
  if (!next) return { ok: false, message: "That's the last step." };

  const { data, error } = await ctx.supabase
    .from("creatives")
    .update({ status: next })
    .eq("id", creativeId)
    .eq("status", expected)
    .select("id, title, owner_id, editor_id, client_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "Someone else moved this one — refreshing." };
  }

  // The hand-offs worth a bell: into the edit (the editor's cue) and back from
  // the client (the producer's). Everything else is visible on a board the
  // three of them already have open.
  if (next === "editing" && data.editor_id && data.editor_id !== ctx.userId) {
    notifyUser(ctx, data.editor_id, {
      kind: "creative_status",
      title: `Ready to edit: ${data.title}`,
      href: `/marketing/creatives/${data.id}`,
    });
  }

  revalidatePath("/marketing");
  revalidatePath(`/marketing/creatives/${creativeId}`);
  revalidatePath(`/marketing/clients/${data.client_id}`);
  // No message: the card has already moved under the cursor. A toast saying so
  // would be the app narrating what the user just watched happen.
  return { ok: true, message: "" };
}

export async function updateCreative(
  creativeId: string,
  patch: Partial<{
    title: string;
    hook: string | null;
    script: string | null;
    owner_id: string | null;
    editor_id: string | null;
    shoot_date: string | null;
    footage_url: string | null;
    cut_url: string | null;
    publish_on: string | null;
    published_url: string | null;
    campaign_id: string | null;
    channel: string;
    kind: CreativeKind;
    status: CreativeStatus;
  }>
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  if (patch.status && !CREATIVE_STATUSES.includes(patch.status)) {
    return { ok: false, message: "Unknown status." };
  }

  const { data, error } = await ctx.supabase
    .from("creatives")
    .update(patch)
    .eq("id", creativeId)
    .select("client_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That video no longer exists." };

  revalidatePath("/marketing");
  revalidatePath(`/marketing/creatives/${creativeId}`);
  revalidatePath(`/marketing/clients/${data.client_id}`);
  return { ok: true, message: "" };
}

export async function deleteCreative(creativeId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  const ctx = await requireSection("marketing");

  const { error } = await ctx.supabase.from("creatives").delete().eq("id", creativeId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/marketing");
  return { ok: true, message: "Video deleted." };
}

/* ── Reviews ────────────────────────────────────────────────────────────── */

/**
 * Record a decision on a cut. Called from BOTH sides of the wall: a Kagu
 * internal review, and a client's approval from the portal.
 *
 * ⚠️ There is deliberately no `blockIfReadOnly("marketing")` at the top. That
 * guard refuses every client outright (0062), which is correct for every other
 * action in this file and would break the one thing a client is here to do.
 * The authorisation for this one lives in RLS — two insert policies, one per
 * kind of reviewer (0064 §3) — because that is the only place it can be
 * expressed without a widened section gate. What this function does instead is
 * refuse the cases RLS would refuse anyway, so the user gets a sentence rather
 * than a database error.
 */
export async function reviewCreative(
  creativeId: string,
  decision: ReviewDecision,
  comment: string,
  timecodeRaw: string
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const client = isClient(ctx);

  // Showcase is a read-only tour and members without write access can't review
  // either. Clients skip this branch: they are never in showcase and hold no
  // section tier.
  if (!client) {
    const stop = await blockIfReadOnly("marketing");
    if (stop) return stop;
  }

  if (!["approved", "changes"].includes(decision)) {
    return { ok: false, message: "Unknown decision." };
  }
  const body = comment.trim().slice(0, 4000);
  if (decision === "changes" && !body) {
    return { ok: false, message: "Say what needs changing — otherwise there's nothing to act on." };
  }

  const timecode = parseTimecode(timecodeRaw);
  if (timecodeRaw.trim() && timecode === null) {
    return { ok: false, message: "Timecode should look like 1:07 (or leave it empty)." };
  }

  // The tenant is read from the creative rather than taken from the caller —
  // and for a client the row is only visible at all if it is theirs and in
  // front of them, so this read is itself part of the check.
  const { data: creative, error: readError } = await ctx.supabase
    .from("creatives")
    .select("id, client_id, title, owner_id, status")
    .eq("id", creativeId)
    .maybeSingle();
  if (readError) return { ok: false, message: readError.message };
  if (!creative) return { ok: false, message: "That video isn't available to review." };

  if (client && creative.status !== "client_review") {
    return {
      ok: false,
      message:
        creative.status === "changes_requested"
          ? "Your notes are already with the team."
          : "This one has already been decided.",
    };
  }

  const { error } = await ctx.supabase.from("creative_reviews").insert({
    creative_id: creative.id,
    client_id: creative.client_id,
    reviewer_id: ctx.userId,
    decision,
    comment: body || null,
    timecode,
  });
  if (error) return { ok: false, message: error.message };

  // A client's review notifies the producer from inside the database trigger
  // (0064 §4) — clients cannot write notification rows. A member's review is
  // notified here, the ordinary way.
  if (!client && creative.owner_id && creative.owner_id !== ctx.userId) {
    notifyUser(ctx, creative.owner_id, {
      kind: "creative_review",
      title:
        decision === "approved"
          ? `Internal sign-off: ${creative.title}`
          : `Changes noted on ${creative.title}`,
      href: `/marketing/creatives/${creative.id}`,
    });
  }

  revalidatePath("/portal");
  revalidatePath(`/marketing/creatives/${creative.id}`);
  revalidatePath("/marketing");
  return {
    ok: true,
    message: decision === "approved" ? "Approved — thank you." : "Sent to the team.",
  };
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

  revalidatePath("/marketing/clients");
  return { ok: true, message: "Campaign deleted." };
}
