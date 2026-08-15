"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { blockIfReadOnly, requireSection } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";
import type { ClientRole } from "@/lib/types";

/**
 * Provisioning a client login — the one place in the app that creates a
 * principal who is not one of the 8.
 *
 * ── Why this is a marketing action and not an admin one ────────────────────
 * /admin hands out sections and the admin flag, neither of which a client can
 * hold; a client account is not a smaller teammate, it is a different kind of
 * thing, and it only makes sense next to the client it belongs to. So the
 * marketing team provisions these from the client's own workspace, and the
 * admin screen never lists them (see the kind filter on /admin).
 *
 * ── Why it needs the service role ──────────────────────────────────────────
 * Creating an auth user requires it, and `client_users` deliberately has NO
 * write policy at all (0062 §6) — meaning there is no path by which a marketing
 * member hands out tenant access except this function, which checks
 * `canWrite('marketing')` first. The same shape as admin user creation: the
 * privileged client is only reached after an explicit authorization check.
 */
export async function inviteClientUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  await requireSection("marketing");

  const clientId = String(formData.get("client_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role: ClientRole =
    String(formData.get("role") ?? "approver") === "viewer" ? "viewer" : "approver";

  if (!clientId) return { ok: false, message: "Missing client." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Enter a valid email." };
  if (fullName.length < 1) return { ok: false, message: "Name is required." };
  if (password.length < 8) {
    return { ok: false, message: "Temp password must be at least 8 characters." };
  }

  const service = createServiceClient();

  // Confirm the client exists before creating an auth account for it. Getting
  // this backwards leaves an orphan login with no tenant — which requireClient
  // sends to /login, so it would present as "the password doesn't work".
  const { data: client, error: clientError } = await service
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) return { ok: false, message: clientError.message };
  if (!client) return { ok: false, message: "That client no longer exists." };

  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { ok: false, message: error.message };

  const userId = created.user.id;

  // kind = 'client' is what bars this account from every section gate in the
  // database (0062 §4). It is set BEFORE the tenant row: in the window between
  // these two writes the account is a client with no tenant, which sees
  // nothing. The other order would briefly be a MEMBER with a tenant, which
  // sees the company.
  const { error: profileError } = await service
    .from("profiles")
    .update({ full_name: fullName, kind: "client", is_admin: false })
    .eq("id", userId);
  if (profileError) return { ok: false, message: profileError.message };

  const { error: linkError } = await service
    .from("client_users")
    .insert({ user_id: userId, client_id: clientId, role });
  if (linkError) return { ok: false, message: linkError.message };

  revalidatePath(`/marketing/clients/${clientId}`);
  return {
    ok: true,
    message: `${email} can now sign in — share the temp password with them.`,
  };
}

/**
 * Revoke a client login. Deletes the auth user outright rather than unlinking
 * it: a profile with `kind = 'client'` and no `client_users` row is a principal
 * that can sign in and see nothing, which is a worse state to leave behind than
 * no account. Their reviews survive — `creative_reviews.reviewer_id` is the one
 * FK here that must not cascade, because the record of who approved what
 * outlives the account that said it.
 */
export async function revokeClientUser(
  userId: string,
  clientId: string
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("marketing");
  if (stop) return stop;
  await requireSection("marketing");

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/marketing/clients/${clientId}`);
  return { ok: true, message: "Access revoked." };
}
