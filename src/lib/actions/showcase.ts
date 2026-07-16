"use server";

import { revalidatePath } from "next/cache";
import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { getSessionContext } from "@/lib/data/session";
import type { ActionResult } from "@/lib/actions/account";

/** Enter showcase mode — the app flips to demo data everywhere. No gate. */
export async function enterShowcase(): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ showcase_mode: true })
    .eq("id", ctx.userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Showcase mode on — showing demo data." };
}

/**
 * Exit showcase mode — GATED by the account password so a client you're
 * demoing to can't flip back to real data. Verified server-side against
 * Supabase auth; the flag only clears on a correct password.
 */
export async function exitShowcase(password: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!password) return { ok: false, message: "Enter your password to exit." };

  // Verify the password with an ISOLATED client (no cookie persistence) so the
  // sign-in check never touches the real session tokens.
  const verifier = createIsolatedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: authError } = await verifier.auth.signInWithPassword({
    email: ctx.profile.email,
    password,
  });
  if (authError) return { ok: false, message: "Incorrect password." };

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ showcase_mode: false })
    .eq("id", ctx.userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Back to real data." };
}
