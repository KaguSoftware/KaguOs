/**
 * Guards the showcase-mode invariant: every READ of a demo-able table must
 * filter on is_demo, or real company data leaks into a client demo.
 *
 * Why this exists: enforcement lives in ~60 hand-written queries across dozens
 * of files, and the only thing keeping them correct is whoever reviews the PR
 * remembering the rule. RLS is a real backstop (0016 widened each SELECT policy
 * with `OR (is_demo AND private.in_showcase())`), but it protects the demo
 * user's session, not a query that forgets the filter and shows a member the
 * wrong set. This makes the invariant something a machine checks.
 *
 *   npm run check:demo
 *
 * Exits non-zero and prints file:line for anything suspicious.
 *
 * It reads the source as TEXT, deliberately: a full type-aware pass would need
 * the TS compiler API and would still not know which reads are user-facing.
 * This is a smoke alarm, not a proof — it is designed to be noisy about real
 * reads and quiet about the safe shapes below.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Tables carrying an is_demo column (0014 + 0016 + 0022). Keep in sync with those migrations. */
const DEMOABLE = [
  "projects", "ideas", "debug_tasks", "transactions", "recurring_items",
  "marketing_campaigns", "marketing_posts", "contacts", "contracts",
  "idea_comments", "idea_votes", "project_secrets", "contact_links",
  "marketing_items", "sprints", "sprint_resources", "sprint_participants",
  "sprint_goals", "sprint_goal_progress", "sprint_questions",
  "sprint_question_replies", "contact_interactions",
];

/**
 * Reads that legitimately skip the filter:
 *  - by primary key (`.eq("id", …)`) — the row was reached via a URL, and RLS
 *    already decides whether this user may see it;
 *  - scoped to a parent row (`.eq("<something>_id", …)`) — the parent read was
 *    itself filtered, so the children inherit the demo/real split;
 *  - `.insert(…).select()` / `.update(…).select()` — writes, not reads.
 */
const SAFE = [
  /\.eq\(\s*["']id["']/,
  /\.eq\(\s*["']\w+_id["']/,
  /\.in\(\s*["']\w+_id["']/,
  /\.(insert|update|delete|upsert)\(/,
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

  for (const table of DEMOABLE) {
    const marker = `.from("${table}")`;
    lines.forEach((line, i) => {
      if (!line.includes(marker)) return;

      // Read forward only to the END of THIS query's chain. Stopping matters:
      // these queries sit side by side inside Promise.all([...]), so a naive
      // lookahead runs into the NEXT query and happily reads its is_demo — the
      // filter looks present when this query has none. Cut at the first line
      // that starts a new statement or a new supabase chain.
      const chain: string[] = [lines[i]];
      for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
        const next = lines[j];
        if (/\b(ctx\.)?supabase\b|\.from\(|^\s*(const|let|return|await)\b|^\s*\]\)/.test(next)) break;
        chain.push(next);
        if (/[;,]\s*$/.test(next.trim())) break; // chain terminated
      }
      const upToTerminator = chain.join("\n");

      if (!upToTerminator.includes(".select(")) return; // not a read
      checked++;

      if (upToTerminator.includes("is_demo")) return; // filtered — good
      if (SAFE.some((re) => re.test(upToTerminator))) return; // safe shape

      leaks++;
      console.error(
        `LEAK RISK  ${file}:${i + 1}\n  read of "${table}" with no is_demo filter\n  ${line.trim()}\n`
      );
    });
  }
}

if (leaks > 0) {
  console.error(
    `\n${leaks} unfiltered read(s) of demo-able tables out of ${checked} checked.\n` +
      `In showcase mode these show REAL data to someone being given a demo.\n` +
      `Add .eq("is_demo", ctx.showcase) — or if the read is genuinely safe\n` +
      `(by-id, parent-scoped, or a write), widen SAFE in this script and say why.`
  );
  process.exit(1);
}

console.log(`check:demo — ${checked} reads of demo-able tables, all filtered.`);
