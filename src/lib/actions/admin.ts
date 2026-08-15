"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionContext, type SectionAccess } from "@/lib/data/session";
import { SECTIONS, type Section } from "@/lib/types";

/** What an admin picked per section: absent = no access at all. */
export type AccessMap = Partial<Record<Section, SectionAccess>>;

/** Keep only real sections and real tiers — this arrives from a client call. */
function sanitizeAccess(input: AccessMap): AccessMap {
  const clean: AccessMap = {};
  for (const [section, tier] of Object.entries(input) as [Section, SectionAccess][]) {
    if (!(SECTIONS as readonly string[]).includes(section)) continue;
    clean[section] = tier === "read" ? "read" : "write";
  }
  return clean;
}
import { isValidColorKey } from "@/lib/colors";
import type { ActionResult } from "@/lib/actions/account";

/** Every admin action re-checks authorization server-side before touching the service client. */
async function assertAdmin() {
  const ctx = await getSessionContext();
  if (!ctx.isAdmin) throw new Error("Not an admin.");
  return ctx;
}

/**
 * Read the section checkboxes off the create-user form. Each checked section
 * posts "sections" = <name>, and an optional "access:<name>" = "read" when the
 * admin picked View instead of Edit.
 *
 * Sections are independent — access is exactly what was checked. Work used to
 * imply Learn (and, via 0026, Debug); 0051 dropped that rule and its triggers.
 */
function parseAccess(formData: FormData): AccessMap {
  const picked = formData.getAll("sections").map(String) as Section[];
  const map: AccessMap = {};
  for (const section of picked) {
    map[section] = formData.get(`access:${section}`) === "read" ? "read" : "write";
  }
  return sanitizeAccess(map);
}

export async function createUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const isAdmin = formData.get("is_admin") === "on";
  const access = parseAccess(formData);

  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Enter a valid email." };
  if (fullName.length < 1) return { ok: false, message: "Name is required." };
  if (password.length < 8) {
    return { ok: false, message: "Temp password must be at least 8 characters." };
  }

  const service = createServiceClient();
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { ok: false, message: error.message };

  const userId = created.user.id;

  const { error: profileError } = await service
    .from("profiles")
    .update({ full_name: fullName, is_admin: isAdmin })
    .eq("id", userId);
  if (profileError) return { ok: false, message: profileError.message };

  const rows = Object.entries(access).map(([section, tier]) => ({
    user_id: userId,
    section,
    access: tier,
  }));
  if (rows.length > 0) {
    const { error: memberError } = await service
      .from("section_memberships")
      .upsert(rows);
    if (memberError) return { ok: false, message: memberError.message };
  }

  revalidatePath("/admin");
  return { ok: true, message: `${email} created — share the temp password with them.` };
}

/**
 * Set a user's whole access picture in one call: which sections, at which tier,
 * plus the admin flag. The client always sends the complete desired state, so
 * this diffs rather than patches.
 */
export async function updateAccess(
  userId: string,
  access: AccessMap,
  isAdmin: boolean
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }

  if (userId === ctx.userId && !isAdmin) {
    return { ok: false, message: "You can't remove your own admin access." };
  }

  const wanted = sanitizeAccess(access);

  const service = createServiceClient();

  const { error: profileError } = await service
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);
  if (profileError) return { ok: false, message: profileError.message };

  const { data: current, error: readError } = await service
    .from("section_memberships")
    .select("section, access")
    .eq("user_id", userId);
  if (readError) return { ok: false, message: readError.message };

  const have = new Map<Section, SectionAccess>(
    (current ?? []).map((m) => [m.section as Section, (m.access as SectionAccess) ?? "write"])
  );

  const toRemove = [...have.keys()].filter((s) => !(s in wanted));
  // Grants AND tier changes both go through upsert on (user_id, section): a
  // delete-then-insert would work too, but it would reset created_at every time
  // an admin flipped View to Edit.
  const toUpsert = (Object.entries(wanted) as [Section, SectionAccess][]).filter(
    ([section, tier]) => have.get(section) !== tier
  );

  if (toRemove.length > 0) {
    const { error } = await service
      .from("section_memberships")
      .delete()
      .eq("user_id", userId)
      .in("section", toRemove);
    if (error) return { ok: false, message: error.message };
  }
  if (toUpsert.length > 0) {
    const { error } = await service
      .from("section_memberships")
      .upsert(
        toUpsert.map(([section, tier]) => ({ user_id: userId, section, access: tier }))
      );
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Access updated." };
}

export async function setUserColor(
  userId: string,
  colorKey: string
): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }
  if (!isValidColorKey(colorKey)) return { ok: false, message: "Pick a color from the set." };

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ color: colorKey })
    .eq("id", userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return { ok: true, message: "Color set." };
}

export async function setUserPassword(
  userId: string,
  password: string
): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, message: error.message };

  return { ok: true, message: "Password set — share it with them." };
}

export type ImportTaskRow = {
  title: string;
  description: string;
  state: string;
  assignee: string;
  priority: string;
};

/** One-time import from the old Google Sheet. Admin only; max 500 rows. */
export async function importDebugTasks(rows: ImportTaskRow[]): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, message: "Nothing to import." };
  }
  if (rows.length > 500) return { ok: false, message: "Max 500 rows per import." };

  // kind = 'member' (0062). This map turns a name in the old spreadsheet into
  // an assignee. A client account sharing a first name with a colleague would
  // otherwise be a candidate, and the import would hand them a debug task —
  // which they cannot see, so it would read as "assigned to nobody" forever.
  const { data: profiles } = await ctx.supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("kind", "member");
  const byName = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.full_name) byName.set(p.full_name.trim().toLowerCase(), p.id);
    byName.set(p.email.trim().toLowerCase(), p.id);
  }

  const states = ["open", "in_progress", "done"];
  const priorities = ["low", "medium", "high", "urgent"];
  let unmatched = 0;

  const inserts = rows.map((row) => {
    const rawState = row.state.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const state = states.includes(rawState)
      ? rawState
      : rawState.startsWith("done") || rawState === "closed"
        ? "done"
        : rawState.includes("progress") || rawState === "doing"
          ? "in_progress"
          : "open";
    const rawPriority = row.priority.trim().toLowerCase();
    const assigneeName = row.assignee.trim();
    const assigneeId = assigneeName
      ? (byName.get(assigneeName.toLowerCase()) ?? null)
      : null;
    if (assigneeName && !assigneeId) unmatched++;
    let description = row.description.trim();
    if (assigneeName && !assigneeId) {
      description = `${description}${description ? "\n" : ""}(imported assignee: ${assigneeName})`;
    }
    return {
      title: row.title.trim().slice(0, 200) || "Untitled task",
      description: description || null,
      state,
      priority: priorities.includes(rawPriority) ? rawPriority : "medium",
      assignee_id: assigneeId,
      created_by: ctx.userId,
    };
  });

  const { error } = await ctx.supabase.from("debug_tasks").insert(inserts);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/debug");
  return {
    ok: true,
    message: `Imported ${inserts.length} tasks${unmatched ? ` (${unmatched} assignees didn't match a member — noted in the task)` : ""}.`,
  };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }
  if (userId === ctx.userId) {
    return { ok: false, message: "You can't delete yourself." };
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin");
  return { ok: true, message: "User deleted." };
}
