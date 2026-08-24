"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionContext, type SectionAccess } from "@/lib/data/session";
import { SECTIONS, type ProfileKind, type Section } from "@/lib/types";

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
  // The role is picked at creation because the two kinds of account are not
  // variations on each other: a member gets sections, a client gets projects,
  // and the database refuses to let one hold the other's grants (0062 §1).
  const kind: ProfileKind = formData.get("kind") === "client" ? "client" : "member";
  const isAdmin = kind === "member" && formData.get("is_admin") === "on";
  const access = kind === "member" ? parseAccess(formData) : {};
  const projectIds =
    kind === "client" ? formData.getAll("projects").map(String) : [];

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

  // `kind` goes in with the name, in one update. The auth trigger that made
  // this row knows nothing about the column and defaults it to 'member' (0062
  // §1) — which is the right default and the wrong answer here, so it is
  // corrected before the account is usable rather than in a second step that
  // could fail on its own and leave an outsider holding a member profile.
  const { error: profileError } = await service
    .from("profiles")
    .update({ full_name: fullName, is_admin: isAdmin, kind })
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

  if (projectIds.length > 0) {
    const { error: assignError } = await service.from("client_projects").insert(
      projectIds.map((project_id) => ({
        user_id: userId,
        project_id,
        created_by: null,
      }))
    );
    if (assignError) return { ok: false, message: assignError.message };
  }

  revalidatePath("/admin");
  return {
    ok: true,
    message:
      kind === "client"
        ? `${email} created as a client — share the temp password with them.`
        : `${email} created — share the temp password with them.`,
  };
}

/**
 * Switch an existing account between team member and client.
 *
 * This is the destructive one, and it is destructive on purpose. A client
 * cannot hold a section or the admin flag — the database enforces that as a
 * check constraint AND inside all four gate functions (0062 §1/§4) — so making
 * someone a client means TAKING THOSE AWAY, not leaving them dormant. A
 * demotion that quietly kept the rows would restore full access to the company
 * the moment anyone flipped the switch back, which is not what "make them a
 * client" means to the person clicking it.
 *
 * The reverse is symmetrical: promoting a client to member drops their project
 * assignments, because a member reads Work in full and a stale row in
 * `client_projects` would be a grant nothing in the UI could see.
 */
export async function setUserRole(
  userId: string,
  kind: ProfileKind
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }
  if (kind !== "member" && kind !== "client") {
    return { ok: false, message: "Unknown role." };
  }
  // The one guard that matters here: an admin who makes THEMSELVES a client
  // loses the admin page along with every section, and there is no screen left
  // from which to undo it.
  if (userId === ctx.userId && kind === "client") {
    return { ok: false, message: "You can't turn your own account into a client." };
  }

  const service = createServiceClient();

  if (kind === "client") {
    // Order matters. The profiles UPDATE carries `is_admin: false` in the same
    // statement as `kind`, because the check constraint refuses a client row
    // with the admin flag still on — two statements would fail on the first.
    // The section rows go first so that, if the profile update then fails, the
    // account is a member with no sections (harmless) rather than a client with
    // sections the constraint should have made impossible.
    const { error: sectionError } = await service
      .from("section_memberships")
      .delete()
      .eq("user_id", userId);
    if (sectionError) return { ok: false, message: sectionError.message };

    const { error } = await service
      .from("profiles")
      .update({ kind: "client", is_admin: false, showcase_mode: false })
      .eq("id", userId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await service
      .from("profiles")
      .update({ kind: "member" })
      .eq("id", userId);
    if (error) return { ok: false, message: error.message };

    const { error: assignError } = await service
      .from("client_projects")
      .delete()
      .eq("user_id", userId);
    if (assignError) return { ok: false, message: assignError.message };
  }

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message:
      kind === "client"
        ? "Now a client — sections removed, assign them a project below."
        : "Now a team member — project assignments removed.",
  };
}

/**
 * Set exactly which projects a client account can open.
 *
 * The client sends the complete desired set, so this diffs rather than patches
 * — the same shape as updateAccess, and for the same reason: two admins with
 * the page open shouldn't be able to add a project each and have one of them
 * silently lose theirs.
 *
 * `client_projects` has NO write policy (0072 §1), so this is the only path to
 * it, and it runs through the service role after the admin check above. That is
 * deliberate: it means a Work member cannot hand out project access to an
 * outsider by writing a row, however the UI is later changed.
 */
export async function setClientProjects(
  userId: string,
  projectIds: string[]
): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Not an admin." };
  }

  const service = createServiceClient();

  // Refuse on a member rather than writing rows nothing will ever read: a
  // member reads Work in full, so an assignment on one is not a smaller grant,
  // it is a meaningless one — and a meaningless row here is exactly what makes
  // a later "why can they see that?" hard to answer.
  const { data: profile, error: readError } = await service
    .from("profiles")
    .select("kind")
    .eq("id", userId)
    .maybeSingle();
  if (readError) return { ok: false, message: readError.message };
  if (!profile) return { ok: false, message: "No such user." };
  if (profile.kind !== "client") {
    return { ok: false, message: "Make them a client first." };
  }

  const wanted = [...new Set(projectIds.map(String).filter(Boolean))];

  const { data: current, error: currentError } = await service
    .from("client_projects")
    .select("project_id")
    .eq("user_id", userId);
  if (currentError) return { ok: false, message: currentError.message };

  const have = new Set((current ?? []).map((row) => row.project_id));
  const toAdd = wanted.filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !wanted.includes(id));

  if (toRemove.length > 0) {
    const { error } = await service
      .from("client_projects")
      .delete()
      .eq("user_id", userId)
      .in("project_id", toRemove);
    if (error) return { ok: false, message: error.message };
  }
  if (toAdd.length > 0) {
    const { error } = await service
      .from("client_projects")
      .insert(toAdd.map((project_id) => ({ user_id: userId, project_id })));
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  return {
    ok: true,
    message:
      wanted.length === 0
        ? "No projects shared with them."
        : `Sharing ${wanted.length} ${wanted.length === 1 ? "project" : "projects"}.`,
  };
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

  // Sections and the admin flag are MEMBER grants. `section_memberships` would
  // accept the rows for a client happily — nothing in that table knows about
  // `kind` — and `is_member()` would then ignore every one of them (0062 §4).
  // The result is an admin screen showing access the app does not honour, which
  // is worse than a refusal: it looks like a permissions bug in the section,
  // three clicks away from the page that caused it.
  const { data: profile } = await service
    .from("profiles")
    .select("kind")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.kind === "client") {
    return {
      ok: false,
      message: "Clients hold no sections — make them a team member first.",
    };
  }

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
