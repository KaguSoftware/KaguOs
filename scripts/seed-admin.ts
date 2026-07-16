/**
 * Seeds the first admin account (idempotent).
 *
 * Usage:  npx tsx scripts/seed-admin.ts [password]
 * If no password is given (or ADMIN_PASSWORD env), a random one is generated
 * and printed — change it afterwards in /account.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "parsaa.mansourii@gmail.com";
const ADMIN_NAME = "Parsa Mansouri";
const SECTIONS = ["work", "learn", "management", "debug", "marketing"];

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password =
    process.env.ADMIN_PASSWORD ?? process.argv[2] ?? randomBytes(9).toString("base64url");

  let userId: string | undefined;

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME },
  });

  if (error) {
    if (/already|exists/i.test(error.message) || error.code === "email_exists") {
      const { data: list, error: listError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listError) throw listError;
      userId = list.users.find((u) => u.email === ADMIN_EMAIL)?.id;
      if (!userId) throw new Error(`User exists but not found via listUsers: ${ADMIN_EMAIL}`);
      console.log(`${ADMIN_EMAIL} already exists — password left unchanged.`);
    } else {
      throw error;
    }
  } else {
    userId = created.user.id;
    console.log(`Created ${ADMIN_EMAIL}`);
    console.log(`Temporary password: ${password}`);
    console.log("Change it after first login at /account.");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_admin: true, full_name: ADMIN_NAME })
    .eq("id", userId);
  if (profileError) throw profileError;

  const { error: membershipError } = await supabase
    .from("section_memberships")
    .upsert(SECTIONS.map((section) => ({ user_id: userId, section })));
  if (membershipError) throw membershipError;

  console.log("Admin ready: is_admin = true, member of all five sections.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
