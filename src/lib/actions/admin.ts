"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionContext } from "@/lib/data/session";
import { SECTIONS, type Section } from "@/lib/types";
import { isValidColorKey } from "@/lib/colors";
import type { ActionResult } from "@/lib/actions/account";

/** Every admin action re-checks authorization server-side before touching the service client. */
async function assertAdmin() {
  const ctx = await getSessionContext();
  if (!ctx.isAdmin) throw new Error("Not an admin.");
  return ctx;
}

function parseSections(formData: FormData): Section[] {
  const picked = formData.getAll("sections").map(String) as Section[];
  const valid = picked.filter((s) => (SECTIONS as readonly string[]).includes(s));
  // Company rule (also enforced by a DB trigger): Work implies Learn.
  if (valid.includes("work") && !valid.includes("learn")) valid.push("learn");
  return valid;
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
  const sections = parseSections(formData);

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

  if (sections.length > 0) {
    const { error: memberError } = await service
      .from("section_memberships")
      .upsert(sections.map((section) => ({ user_id: userId, section })));
    if (memberError) return { ok: false, message: memberError.message };
  }

  revalidatePath("/admin");
  return { ok: true, message: `${email} created — share the temp password with them.` };
}

export async function updateAccess(
  userId: string,
  sections: Section[],
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

  const wanted = new Set<Section>(
    sections.filter((s) => (SECTIONS as readonly string[]).includes(s))
  );
  // Company rule (also a DB trigger): Work implies Learn.
  if (wanted.has("work")) wanted.add("learn");

  const service = createServiceClient();

  const { error: profileError } = await service
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);
  if (profileError) return { ok: false, message: profileError.message };

  const { data: current, error: readError } = await service
    .from("section_memberships")
    .select("section")
    .eq("user_id", userId);
  if (readError) return { ok: false, message: readError.message };

  const have = new Set((current ?? []).map((m) => m.section as Section));
  const toAdd = [...wanted].filter((s) => !have.has(s));
  const toRemove = [...have].filter((s) => !wanted.has(s));

  if (toRemove.length > 0) {
    const { error } = await service
      .from("section_memberships")
      .delete()
      .eq("user_id", userId)
      .in("section", toRemove);
    if (error) return { ok: false, message: error.message };
  }
  if (toAdd.length > 0) {
    const { error } = await service
      .from("section_memberships")
      .upsert(toAdd.map((section) => ({ user_id: userId, section })));
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

  const { data: profiles } = await ctx.supabase
    .from("profiles")
    .select("id, full_name, email");
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
