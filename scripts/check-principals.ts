/**
 * Guards the client-principal invariant: every list of PEOPLE must filter
 * `kind = 'member'`, or a client account appears among the eight colleagues.
 *
 * Why this exists, and why it is a script rather than a review checklist:
 *
 * 0062 put an outsider behind the login. The database side of that is airtight
 * — four gate functions refuse a client, and the migration asserts it at deploy
 * time. What the database CANNOT do is stop a member's own query from returning
 * a client row. `profiles` is readable in full by every member, correctly: they
 * need the roster. So the filter is a per-query obligation in TypeScript, in
 * exactly the way `is_demo` is, and it fails exactly the same way — silently,
 * and looking plausible. A client in the @-mention menu does not throw. It just
 * sits there, next to Parsa, until someone mentions them.
 *
 *   npm run check:principals
 *
 * Same design as check-demo-filters.ts and the same limits: it reads the source
 * as TEXT and is a smoke alarm, not a proof. It is deliberately noisy about
 * reads of `profiles` and quiet about the shapes that are safe by construction.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads that legitimately skip the filter:
 *  - by primary key (`.eq("id", …)`) — one named row, reached deliberately;
 *  - your own row (`auth.uid()` / `userId`) — always yours to read;
 *  - writes;
 *  - a read joined to `client_projects`, which is the one place a client
 *    account is the point: that table can only hold client rows (0072 §2), so
 *    a join through it is already scoped by construction.
 *
 * `client_users` was 0062's version of that last one. 0068 dropped the table
 * and 0072 replaced it with `client_projects`; the old name stays out of this
 * list deliberately, because an exemption for a table that no longer exists is
 * an exemption that can only ever be claimed by mistake.
 */
const SAFE = [
  /\.eq\(\s*["']id["']/,
  /\.(insert|update|delete|upsert)\(/,
  /client_projects/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

let leaks = 0;
let checked = 0;

for (const file of walk("src")) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const marker = `.from("profiles")`;

  lines.forEach((line, i) => {
    if (!line.includes(marker)) return;

    // Read forward only to the end of THIS query's chain — these sit side by
    // side inside Promise.all([...]), and a naive lookahead would happily read
    // the NEXT query's filter and call this one covered.
    const chain: string[] = [lines[i]];
    for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
      const next = lines[j];
      if (/\b(ctx\.)?supabase\b|\.from\(|^\s*(const|let|return|await)\b|^\s*\]\)/.test(next)) break;
      chain.push(next);
      if (/[;,]\s*$/.test(next.trim())) break;
    }
    const chunk = chain.join("\n");

    if (!chunk.includes(".select(")) return; // not a read
    checked++;

    if (/\bkind\b/.test(chunk)) return; // filtered — good
    if (SAFE.some((re) => re.test(chunk))) return;

    leaks++;
    console.error(
      `PRINCIPAL LEAK  ${file}:${i + 1}\n  read of "profiles" with no kind filter\n  ${line.trim()}\n`
    );
  });
}

/**
 * The session helpers are the seam itself, so they are checked for PRESENCE of
 * the guard rather than for a filter. If `isClient` disappears from session.ts,
 * every `canAccess` call site in the app silently reopens to clients — which is
 * the single worst regression this whole sequence can suffer, and the one least
 * likely to produce a failing test.
 */
const session = readFileSync("src/lib/data/session.ts", "utf8");
const required: [string, string][] = [
  ["isClient", "the client predicate"],
  ["requireClient", "the portal guard"],
  ["if (isClient(ctx)) return false", "the client bar in canAccess/canWrite"],
  // 0072. Without this, every route and action in the portal is scoped by a
  // project id that arrived in the URL from the person it is supposed to be
  // checking — the one bug that would let a client read another client's pack.
  ["requireClientProject", "the portal's per-project tenant guard"],
  ["blockIfNotMyProject", "the tenant guard for the portal's write actions"],
];
for (const [needle, what] of required) {
  if (!session.includes(needle)) {
    leaks++;
    console.error(
      `PRINCIPAL LEAK  src/lib/data/session.ts\n  ${what} is gone (looked for: ${needle})\n`
    );
  }
}

if (leaks > 0) {
  console.error(
    `\n${leaks} problem(s) out of ${checked} reads of "profiles" checked.\n` +
      `A client account is not a colleague: it must never appear in the roster,\n` +
      `the mention menu, a notification fan-out, or the admin user list.\n` +
      `Add .eq("kind", "member") — or, if the read is genuinely safe (by-id, own\n` +
      `row, a write, or a client_users join), widen SAFE in this script and say why.`
  );
  process.exit(1);
}

console.log(
  `check:principals — ${checked} reads of "profiles", all scoped; session guards intact.`
);
