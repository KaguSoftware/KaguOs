// Apply a single migration file to prod via the Supabase Management API.
//   node scripts/apply-migration.mjs supabase/migrations/0020_idea_pipeline.sql
// Reads SUPABASE_ACCESS_TOKEN from .env.local. Prints STATUS + body; 201 + [] = ok.
import fs from "node:fs";

const REF = "ibbfptujwtbfwdefllgz";
const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-migration.mjs <path-to.sql>");
  process.exit(1);
}

// Minimal .env.local parse (KEY=value, no deps) — the file must stay quote/space-free.
const token = fs
  .readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("SUPABASE_ACCESS_TOKEN="))
  ?.slice("SUPABASE_ACCESS_TOKEN=".length)
  .trim();

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN not found in .env.local");
  process.exit(1);
}

const query = fs.readFileSync(file, "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  }
);

console.log("STATUS", res.status);
console.log(await res.text());
if (!res.ok) process.exit(1);
