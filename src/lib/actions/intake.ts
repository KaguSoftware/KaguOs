"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  blockIfNotMyProject,
  blockIfReadOnly,
  getSessionContext,
  isClient,
  type SessionContext,
} from "@/lib/data/session";
import {
  findTable,
  isKnownAnswerKey,
  sanitizeRow,
} from "@/lib/intake";
import type { ActionResult } from "@/lib/actions/account";

/**
 * The input pack's write path — the one set of actions in KaguOs a CLIENT
 * account can reach.
 *
 * Every one of them opens with `guard()`, which is the whole security story of
 * this file: a client may write the pack of a project assigned to them, a Work
 * member with edit rights may write any pack, and nobody else may write
 * anything. The database says the same thing independently (0072 §4) — this
 * exists so a refusal arrives as a sentence rather than as an RLS error, and so
 * the wrong caller is stopped before a round-trip.
 */

type Guarded =
  | { ctx: SessionContext; stop?: undefined }
  | { ctx?: undefined; stop: { ok: false; message: string } };

/**
 * Two principals, one door.
 *
 * The client arm is checked FIRST and returns on its own rather than falling
 * through: `blockIfReadOnly("work")` would refuse a client (correctly, they
 * have no sections) with a message about view-only access to a section they
 * cannot see and do not know exists.
 */
async function guard(projectId: string): Promise<Guarded> {
  if (!projectId) return { stop: { ok: false, message: "Missing project." } };

  const ctx = await getSessionContext();

  if (isClient(ctx)) {
    // The tenant rule is written once, in session.ts, next to the page guard
    // that uses the same rule. Two copies of "is this project theirs" is how
    // one of them ends up a release behind the other.
    const stop = await blockIfNotMyProject(projectId);
    return stop ? { stop } : { ctx };
  }

  const stop = await blockIfReadOnly("work");
  if (stop) return { stop };
  return { ctx };
}

/**
 * Both screens that show a pack, refreshed together.
 *
 * A client editing their answers changes what the team's review screen shows,
 * and a producer filling something in over the phone changes what the client
 * sees — so revalidating only the caller's own route would leave the other side
 * reading a stale pack until it happened to re-render.
 */
function revalidatePack(projectId: string) {
  // The pack's own page, plus every portal route that quotes its percentage:
  // the dashboard card, the inputs chooser and the progress page's second
  // meter. Each is a separate route with a separate cache — `/portal` is not a
  // prefix wildcard, which is why they are listed one by one.
  revalidatePath(`/portal/inputs/${projectId}`);
  revalidatePath("/portal/inputs");
  revalidatePath("/portal/progress");
  revalidatePath("/portal");
  revalidatePath(`/work/projects/${projectId}/intake`);
  revalidatePath(`/work/projects/${projectId}`);
}

/**
 * Save one answer.
 *
 * Called on blur (and on pick, for the chip questions) rather than behind a
 * Save button. The pack is long enough that a client will fill it over several
 * sittings on a phone, and the browser-local autosave the original HTML relied
 * on is exactly what this app doesn't need: the answers belong in the database
 * from the first keystroke, where the team can already see them.
 */
export async function saveIntakeAnswer(
  projectId: string,
  key: string,
  value: string
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  // The catalogue decides what a legal key is. Server actions are reachable by
  // direct POST, so without this the answers table is an open key-value store.
  if (!isKnownAnswerKey(key)) {
    return { ok: false, message: "That question isn't part of the pack." };
  }

  const clean = String(value ?? "").slice(0, 8000);

  const { error } = await ctx.supabase.from("project_intake_answers").upsert(
    {
      project_id: projectId,
      key,
      value: clean,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,key" }
  );
  if (error) return { ok: false, message: error.message };

  revalidatePack(projectId);
  return { ok: true, message: "Saved." };
}

/** Add an empty line to one of the pack's repeating tables. */
export async function addIntakeRow(
  projectId: string,
  tableKey: string
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const card = findTable(tableKey);
  if (!card) return { ok: false, message: "That table isn't part of the pack." };

  // Append: read the current tail rather than counting rows, so a deleted line
  // in the middle doesn't put the new one on top of an existing sort value.
  const { data: last } = await ctx.supabase
    .from("project_intake_rows")
    .select("sort")
    .eq("project_id", projectId)
    .eq("table_key", tableKey)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A cap, because this table is client-writable and nothing else stops a stuck
  // "add" button (or a bored teenager) from inserting until the page dies.
  const { count } = await ctx.supabase
    .from("project_intake_rows")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("table_key", tableKey);
  if ((count ?? 0) >= 500) {
    return {
      ok: false,
      message: "That's 500 lines — send us the rest as a spreadsheet instead.",
    };
  }

  const { data, error } = await ctx.supabase
    .from("project_intake_rows")
    .insert({
      project_id: projectId,
      table_key: tableKey,
      data: {},
      sort: (last?.sort ?? -1) + 1,
      created_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  revalidatePack(projectId);
  return { ok: true, message: "Line added.", id: data?.id };
}

/**
 * Save one line. The whole row goes at once rather than cell by cell: a line is
 * a single fact ("a large cappuccino costs 9000"), and saving its cells
 * independently is what produces a half-written product in the team's view.
 */
export async function saveIntakeRow(
  projectId: string,
  rowId: string,
  tableKey: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const card = findTable(tableKey);
  if (!card) return { ok: false, message: "That table isn't part of the pack." };

  const { error } = await ctx.supabase
    .from("project_intake_rows")
    .update({ data: sanitizeRow(card, data) })
    .eq("id", rowId)
    // Belt and braces on top of RLS: without it a valid client could pass any
    // row id and edit another project's line, because the policy would happily
    // approve the UPDATE if THIS project is theirs and the row belongs to a
    // project that isn't.
    .eq("project_id", projectId)
    .eq("table_key", tableKey);
  if (error) return { ok: false, message: error.message };

  revalidatePack(projectId);
  return { ok: true, message: "Saved." };
}

export async function deleteIntakeRow(
  projectId: string,
  rowId: string
): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { error } = await ctx.supabase
    .from("project_intake_rows")
    .delete()
    .eq("id", rowId)
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidatePack(projectId);
  return { ok: true, message: "Line removed." };
}

/**
 * Tell Kagu the pack is ready to work from.
 *
 * Sending does NOT lock anything — see 0072 §3a. A pack is a living document
 * and a client who spots a wrong price on Thursday must be able to fix it
 * without asking permission. What Send buys is the notification and a date the
 * team can point at.
 *
 * Deliberately allowed on an incomplete pack. The original form let you
 * download a partial one for the same reason: week-1 answers unlock the build,
 * and holding all of them hostage to a staff list that isn't hired yet helps
 * nobody. The team's screen shows exactly what's missing.
 */
export async function submitIntake(projectId: string): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { error } = await ctx.supabase.from("project_intake").upsert(
    {
      project_id: projectId,
      submitted_at: new Date().toISOString(),
      submitted_by: ctx.userId,
    },
    { onConflict: "project_id" }
  );
  if (error) return { ok: false, message: error.message };

  notifyTeamOfIntake(ctx, projectId);

  revalidatePack(projectId);
  return {
    ok: true,
    message: "Sent to Kagu — we'll come back to you on anything unclear.",
  };
}

/** Take it back off the team's desk while you rework it. */
export async function reopenIntake(projectId: string): Promise<ActionResult> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return stop;

  const { error } = await ctx.supabase
    .from("project_intake")
    .update({ submitted_at: null, submitted_by: null })
    .eq("project_id", projectId);
  if (error) return { ok: false, message: error.message };

  revalidatePack(projectId);
  return { ok: true, message: "Reopened — it's yours again." };
}

/**
 * Ring the team's bell when a pack lands.
 *
 * Goes through the SERVICE client rather than the caller's session, and that is
 * not an optimisation: `notifications_insert` refuses a client outright (0062
 * §5), because `with check (true)` on that table let an outsider plant a
 * link-carrying message in a colleague's bell that appeared to come from the
 * company's own system. So the row is written by the server, which decides the
 * title and the href, exactly as 0064's trigger did.
 *
 * Best-effort and after the response, like every other notification in the app.
 */
function notifyTeamOfIntake(ctx: SessionContext, projectId: string) {
  after(async () => {
    try {
      const service = createServiceClient();
      const [{ data: project }, { data: admins }] = await Promise.all([
        service.from("projects").select("name").eq("id", projectId).maybeSingle(),
        service
          .from("profiles")
          .select("id")
          .eq("kind", "member")
          .eq("is_admin", true),
      ]);

      const rows = (admins ?? [])
        .filter((admin) => admin.id !== ctx.userId)
        .map((admin) => ({
          recipient_id: admin.id,
          actor_id: ctx.userId,
          kind: "client_intake" as const,
          title: `Input pack sent for ${project?.name ?? "a project"}`,
          href: `/work/projects/${projectId}/intake`,
        }));
      if (rows.length > 0) await service.from("notifications").insert(rows);
    } catch {
      /* notifications are best-effort — never fail the parent action */
    }
  });
}
