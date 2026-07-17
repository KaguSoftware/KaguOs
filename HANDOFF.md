# KaguOs — Handoff

> Read this first when starting a fresh chat. Companions: PRODUCT.md · DESIGN.md ·
> plan at `C:\Users\p.mansouri\.claude\plans\we-are-kagu-this-precious-teacup.md`.

## Working style
- **Git authorship — ABSOLUTE RULE**: Parsa is the SOLE author of every commit. NEVER add Claude as
  co-author (`Co-Authored-By` trailers banned), never mention Claude/AI in commit messages or PR
  bodies. He deleted and recreated the repo on 2026-07-16 to purge one such trailer.
- **Collaborate**: agree with Parsa before locking significant decisions; propose with a
  recommendation. No subagents/orchestration unless he asks.
- **Create flows (Parsa rule)**: every "add new X" is a spacious dedicated surface (`/…/new` page
  or fullscreen overlay) — never an inline expander. No required fields; empty-field confirm
  ("Title and Details are empty — sure?"). `src/components/ui/create.tsx`.
- **Typed custom fields (Parsa rule)**: every control is custom + typed — Dropdown, DatePicker,
  NumberInput, EmailInput, UrlInput, FileInput, ColorPicker, **Checkbox** in `src/components/ui/`.
  No native select/date/checkbox UI, no bare strings for typed content. Custom scrollbars too
  (globals.css).
- **macOS-feel motion (Parsa rule)**: `--ease-mac` curve, pop-in popovers, page/overlay fade-rises,
  button micro-press, frosted translucency on transient surfaces only. Spec: DESIGN.md → Motion.
- **Fast (Parsa rule)**: optimistic updates on claims/states/goal-ticks/votes, client-side board
  switching, React `cache()` session dedupe, router `staleTimes`, streaming `loading.tsx`.
- **Make partial scope OBVIOUS** (ledger below) · keep this file + memory index in lockstep.

## What this is
KaguOs — internal system of Kagu (kagusoftware.com, Istanbul, **8 people**). One login, five
membership-gated sections: **Work** (4: projects+ideas w/ sector+type, promote idea→project),
**Learn** (all 8: sprints, per-person goals, file resources; Work⊆Learn enforced by DB trigger),
**Management** (2: Finance in TL w/ manual FX + charts + recurring items + one-time transactions,
Contracts w/ PDFs), **Debug** (everyone: per-project boards, self-claim-only, realtime),
**Marketing** (digital: campaigns, content calendar, shared links). Per-member identity colors
(picked from 20 vibrant swatches; admin can override) color-code names app-wide.

## Stack & environment
- Next.js 16.2.10 (App Router, Turbopack, `staleTimes` experiment), React 19.2, Tailwind v4,
  lucide-react, recharts, papaparse.
- Supabase: Auth (invite-only email+password — **public signups must be disabled in dashboard**,
  still to verify), Postgres w/ RLS everywhere, private buckets `contracts` + `learn`, Realtime on
  `debug_tasks`. Project ref `ibbfptujwtbfwdefllgz`. Migrations 0001–0013 applied via `db push`;
  **0014 was applied by hand in the SQL Editor** (see incident note in Current status) — so the CLI
  migration history does NOT know about 0014.
- Env (`.env.local`, never committed): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`
  (CLI; used for `db push` + Management API).
- GitHub `KaguSoftware/KaguOs` (main). Windows 11 + PowerShell. Impeccable installed project-level
  but LOCAL-ONLY (`.claude/` is gitignored — Parsa wants only app code on GitHub; re-install on a
  new machine with `npx impeccable install`, answers `"1`nproject"`).

## Conventions
- Access: `profiles.is_admin` + `section_memberships`; RLS via `private.is_admin()` /
  `private.is_member()`. Server actions re-check auth; service client only in
  `lib/supabase/service.ts` after admin check. Column grants protect `profiles.is_admin`
  (authenticated may update only `full_name`, `color`).
- Debug claim rule (DB): assignee may only be set to yourself/null unless admin.
- Files upload from the BROWSER straight to storage (RLS-gated), then a server action saves the
  path; downloads via signed URLs (1h).
- Text+CHECK not enums; created_by nullable `on delete set null`; `updated_at` triggers.
- Next 16: `src/proxy.ts` (not middleware); async cookies/params.
- Chart colors are validated (dataviz skill): income `oklch(0.62 0.13 160)`, expense
  `oklch(0.55 0.16 25)` — L band 0.48–0.67 on dark; re-validate any new chart palette.

## Current status (2026-07-17)

### ⚡ Perf pass 2 (2026-07-17) — the numbers that should govern every future change

**THE ONE RULE: a round-trip costs ~305ms; a query added to an EXISTING wave costs ~3ms.**
Measured against prod, warm connection: 1 query alone **311ms** · 6 queries in one `Promise.all`
**328ms** · those same 6 run serially **633ms**. Fourteen dashboard queries in one wave: **416ms**.
So the only quantity worth optimising is the NUMBER OF SEQUENTIAL AWAITS. Never count queries —
count waves. A new stat belongs INSIDE the page's existing `Promise.all`, never in an await above
it. This is why the dashboard's per-section `if (canAccess) { await … }` blocks cost ~2s: seven
serial waves. They're now one.

**What was actually slow, in order of size:**
1. **Compute in the wrong hemisphere** (see the REGION note below) — ~30% of every page. Fixed by a
   4-line `vercel.json`.
2. **The proxy called `getUser()` on EVERY request** — a full auth-server round-trip (~305ms) paid
   before any page began rendering, even `/login`. Now `getClaims()`, which refreshes the token via
   `getSession()` exactly the same way but verifies the JWT **locally** against the project's ES256
   JWKS. `/login` **318ms → 15ms**. Signed-out and forged tokens still redirect (verified).
   **The old comment in proxy.ts warning "don't touch, random logouts" was over-broad** — the
   refresh is what matters, and `getClaims()` does it. Keep it in place, keep nothing between it and
   `createServerClient`.
3. **Post-mutation FLASH — this was the "system dies for a few seconds then comes back".** Seven
   components synced server props into state with `useEffect(() => setX(prop), [prop])`. After a
   mutation `revalidatePath` re-sends props, the effect fires, and React commits the STALE value
   first, then re-renders — so a just-ticked reminder or just-cast vote visibly bounces back for a
   frame. **Fix: adjust state DURING RENDER** (`if (seen !== prop) { setSeen(prop); setX(prop) }`),
   which lets React throw the stale pass away before it paints. `react-hooks/set-state-in-effect`
   flags this — the lint rule was already telling us, with 10 errors. Now 2, both legitimate
   (`create.tsx` and the palette's open-reset genuinely react to events).

4. **`await` inside a `for` loop** (`learn/[id]`) — signed one storage URL per file, serially. Six
   attachments = **2,509ms** of pure waiting, and every upload made the page permanently slower.
   `createSignedUrls` (PLURAL) signs the batch in one trip: **2509 → 338ms**, and now flat in file
   count instead of linear. Match results back **by path, not index** — order isn't guaranteed.
   ⚠️ **Grep for `await` inside loops before adding one; this is the failure mode that grows.**
5. **`work/projects/[id]`** fetched credentials in a second wave that only needed the URL's `id` and
   a synchronous `ctx` check — never the project row. Merged into the existing wave.
   `contracts/[id]` looks identical but is **genuinely dependent** (its storage path embeds a random
   uuid + the original filename, so it can't be derived from the id) — left alone on purpose.

**Where it landed** (prod, warm, median, incl. the Istanbul→Vercel hop the team also pays):
dashboard **827ms**, `/debug` **633ms**, `/work` **622ms**, `/comms` **598ms** — from ~1,500ms.
A full waterfall audit of all 34 pages + 2 layouts + the data layer found the rest already optimal
(one `Promise.all` after the unavoidable session wave). The dashboard is the reference pattern.

**Deliberately NOT done** — the last ~300ms would mean collapsing the session fetch into the page's
wave. It's reachable: `private.in_showcase()` (0016) already exists, so a self-filtering VIEW per
demo-able table would let queries drop `.eq("is_demo", …)` and merge the waves (verified working).
**Rejected**: 19 views + rewriting ~60 queries, and it makes the dangerous call (`from("debug_tasks")`)
look identical to the safe one (`from("v_debug_tasks")`) — buying 300ms by making the leak risk
LESS visible, for an 8-person app. Bad trade. Don't do this without a strong reason.

**Indexes (0018).** 0014 indexed `is_demo` ALONE on 7 tables; a lone boolean index barely narrows
anything so the planner seq-scans past it (confirmed via EXPLAIN on prod). 0016 then added `is_demo`
to 10 more tables and indexed none. 0018 replaces them with composites matching the real shapes
(`is_demo + created_at desc`, `is_demo + state/status/kind`) across all 19 demo-able tables.
**Honest**: at today's row counts (max 22) this changes ZERO measurable ms — a 9-row seq scan is
0.1ms and unbeatable. Verified on a 20k-row scratch table that they do get index scans at real
volume. They're insurance, not a speedup.

- ✅ **`npm run check:demo`** (`scripts/check-demo-filters.ts`) — the showcase invariant is now
  machine-checked instead of resting on reviewer memory. Flags any read of a demo-able table with no
  `is_demo` filter, ignoring the shapes that legitimately skip it (by-id, parent-scoped, writes).
  Currently: 58 reads, all filtered. **Validated both directions** — deleting one `is_demo` line
  makes it fail with the exact file:line and exit 1. Run it after touching any query on a demo-able
  table. A full audit of all 19 tables found **no leaks** in the current code.
- ✅ **Skip-to-content link** — PRODUCT.md promises full keyboard operability, but every page put 6+
  tab stops (all section links, search, bell, account) before the content, on every navigation.
- 🐞 **`.env.local` had two parse bugs**: `SUPABASE_ACCESS_TOKEN = "…"` (space before `=`) and a
  space AFTER `=`. Next's loader tolerates both, so the app worked and it went unnoticed — but any
  script doing `. ./.env.local` got `command not found` and a silently empty token. Fixed. Keep the
  file strictly `KEY=value`, no spaces, no quotes.
- 🔑 **Vercel**: `VERCEL_TOKEN` is in `.env.local` (gitignored) — the agent can deploy and read
  project config. ⚠️ It's an ACCOUNT token: it can see all 9 projects under `bau-engs-projects`
  (kagu-website, upper-deck, the client demos), not just kagu-os. **Revoke it at
  vercel.com/account/tokens when it's no longer needed.**

## Current status (2026-07-16, late)
- ⚡ **DB/save latency pass (2026-07-16) — measured & fixed.** Saves felt "insanely slow." A latency
  probe against prod (`ibbfptujwtbfwdefllgz`) found: raw HTTPS floor **64ms**, `auth.getUser()`
  **~300ms** (a full auth-server round-trip, NOT a local decode), single DB select ~300–600ms; the
  serial save critical path measured **~1,500ms** before `revalidatePath` even re-ran the page.
  Two root causes fixed:
  1. **Double auth round-trip.** The proxy calls `getUser()` (needed — refreshes token) AND
     `getSessionContext()` called it AGAIN (~300ms wasted/save). Project uses **ES256 asymmetric JWT
     keys** (verified via JWKS), so `getClaims()` verifies the token **LOCALLY** — measured
     **299ms → 0ms**. `getSessionContext` + new `getUserId(supabase)` helper (session.ts) + both
     `account.ts` actions now use `getClaims()`. **Only the proxy still calls `getUser()`** (don't
     touch — comment there warns it must stay put or random logouts happen). **LESSON: never call
     `getUser()` in an action/page for identity — use `getClaims()` (local, free) or `getUserId()`.**
  2. **Notifications blocked the save.** `notifySection/notifyEveryone/notifyUser` (notify.ts) did a
     SELECT + INSERT the user waited on; `addComment`/`promoteIdea` added more. All now run inside
     Next's **`after()`** (`next/server`) — they execute AFTER the response ships (Vercel `waitUntil`
     completes them). The notify helpers are now **fire-and-forget (return void, not Promise)** — call
     them WITHOUT `await`. `work.ts` gained `notifyIdeaAuthor()` (defers the author lookup too).
  Combined: ~1,500ms critical path → ~500–600ms.
- 🌏 **REGION — SOLVED, and it was the COMPUTE, not the database (2026-07-17).** The earlier note
  here said the Tokyo db was the problem and an EU migration was the next big win. That was half
  right and the wrong half to act on. The real find: **Vercel had no `vercel.json`, so the server
  function defaulted to `iad1` — WASHINGTON DC.** Every page ran Istanbul → Frankfurt edge →
  **Washington** → Tokyo db → back, and each of the 2–3 db round-trips a page makes was a
  US↔Japan flight. `x-vercel-id` read `fra1::iad1::` and gave it away.
  **Fix: `vercel.json` → `{"regions": ["hnd1"]}`** — put the compute NEXT TO THE DATABASE (Tokyo).
  A page makes several db trips but only ONE hop to the user, so compute belongs beside the db, not
  beside the team. Measured on prod, same code, same db: dashboard **1194→827ms**, `/debug`
  **936→633ms**, `/work` **752→622ms** (~30%), from a 4-line file, no migration, instantly
  reversible. Route now reads `fra1::hnd1::`.
  **DB region decision (Parsa, 2026-07-17): the database STAYS in Tokyo. Permanently. Don't raise
  it again.** Blocked anyway: the free-project limit belongs to `saitaydin.kagu@gmail.com` (2/2 used
  by KaguOs + KaguWebsite), so freeing a slot means touching someone else's project. Not worth it —
  the compute move already captured most of the win. ⚠️ If the db is ever moved, **change `hnd1` to
  match the new db region in the same commit**, or compute ends up stranded away from it.
- DONE (code written, `npm run build` clean, pushed): all five sections at full agreed scope, admin
  panel, dashboard, CSV import, design system + field kit + create surfaces + optimistic layer. DB
  seeded: Parsa is admin with all memberships. Now DEPLOYED on Vercel + 2-browser tested.
- UI/UX pass (2026-07-16): custom `Checkbox` primitive app-wide; instant client-side tabs across
  Marketing/Work/Management; dashboard grew quick-actions, personal focus line, **recent-activity
  feed**, and **reminders**; warmed dark theme; **small-text contrast lifted to WCAG AA** (verified,
  don't lower the text ramp); brand **logo** in sidebar + favicons.
- HCI foundation (2026-07-16): app-wide **toast system** (`ui/toast.tsx`, mounted in the (app)
  layout) + **`useAction` hook** (`lib/use-action.ts`) standardizing optimistic run→rollback→
  toast-on-failure. High-traffic flows refactored onto it; create forms toast success/error. Every
  action now tells the user what happened. Lower-traffic admin flows (fx-editor, sprint-forms,
  user-row, contract-bits, progress-grid, color-form, import-debug) still use inline errors — fine.
- Features shipped (2026-07-16): **in-app notifications** (bell in sidebar, unread badge, event
  fan-out via `lib/actions/notify.ts`); **announcements hero** (admin-posted dashboard banner);
  **⌘K command palette** (`shell/command-palette.tsx`, mounted in (app) layout, sidebar Search
  button); **editing flows** for debug tasks (inline in expanded row) and ideas (inline on detail
  page) — projects already had it; **admin Team rows redesigned** (calm summary + expandable Manage
  panel instead of ~10 inline controls); empty-state CTAs on work panels.
- Features shipped (2026-07-16, batch 2): **Comms/CRM** = sixth section (leads/clients + linked
  resources, 0013); **finance CSV exports** (client-side, transactions + recurring); **project
  credentials** now Work-gated (0011+0012); **loading strategy** complete (SSR shell + client
  routing + `prefetch-heavy.tsx` warms Finance/Debug from dashboard + finance-specific skeleton);
  **SHOWCASE MODE** (0014, see its own note below).
- Perf/UX fixes (2026-07-16): laggy interactions were full-page revalidate on every tick — made
  **reminders check/delete, sprint participants, sprint goal removal OPTIMISTIC** (no router.refresh);
  **sprint goals now batch-add** (textarea, one per line, ⌘+Enter) via `addGoals`. Removed the green
  focus glow on search/reminder inputs (global `:focus-visible` scoped to `:not([data-no-ring])`).
- ⚠️ SHOWCASE MODE (`lib/actions/showcase.ts`, `shell/showcase.tsx`, `data/session.ts` →
  `ctx.showcase`/`demoFlag`): per-user `profiles.showcase_mode` swaps the app to OBVIOUSLY-FAKE demo
  data (Acme Corp / 123456789) for client demos. **Enforcement is server-side**: every list/count
  query filters `.eq("is_demo", ctx.showcase)`. Enter = one click; **exit is password-gated**
  (verified via an isolated Supabase client so the session isn't disturbed). Amber banner while
  active. **When adding a NEW query on a demo-able table, you MUST add the `is_demo` filter** or real
  data leaks in demo mode. Known limitation: records CREATED in demo mode are real rows (not flagged
  is_demo) — demos are view-first; thread is_demo through create actions if that becomes a problem.
- Migrations 0008–0013 **pushed to cloud & live** via `db push`; 0014 hand-applied in SQL Editor
  (see incident); **0015 pushed via `db push` (2026-07-16)**. Harmless Docker-cache warning on
  Windows; remote apply still succeeds.
- ✅ **APPLYING MIGRATIONS UNATTENDED (2026-07-17) — the agent does this now; don't wait for Parsa.**
  The old note here said the sandbox can't auto-confirm `db push` so Parsa had to run it for every
  migration. Superseded: `SUPABASE_ACCESS_TOKEN` in `.env.local` reaches the **Management API**,
  which runs arbitrary SQL against prod with no interactive confirm. 0017 and 0018 were both applied
  this way. Pattern (Node, because `/tmp` and heredocs are awkward on Windows):
  ```js
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: fs.readFileSync('supabase/migrations/00XX_name.sql', 'utf8') }),
  });   // 201 + [] on success
  ```
  **Still write the numbered migration file** — it's the record, and `db push` history should match.
  **Verify after applying** (query `pg_proc` / `pg_indexes` / `information_schema.columns`), and
  **verify column refs BEFORE applying** — a half-applied migration is worse than none.
- **0015_showcase_grant.sql (2026-07-16):** 0014 added `profiles.showcase_mode` but never granted
  UPDATE on it. `profiles` has UPDATE revoked from `authenticated` (0001), re-granted PER-COLUMN
  (full_name 0001, color 0006) — so entering showcase mode hit **"permission denied for table
  profiles"** for everyone, admin included (app `is_admin` ≠ Postgres column grant). 0015 adds
  `grant update (showcase_mode) … to authenticated`; the `profiles_update_own` RLS already scopes the
  row. **LESSON: adding a column to `profiles` that users update requires BOTH a column GRANT and the
  RLS row policy — the grant is easy to forget.**
- ⚠️ **INCIDENT (2026-07-16): 0014 shipped in code but was NEVER pushed to prod.** Commit `3d06785`
  added `.eq("is_demo", ctx.showcase)` to every list/count query, but `0014_showcase_mode.sql` (which
  creates `is_demo` on the demo-able tables + `showcase_mode` on profiles) never ran on cloud. Effect:
  every list query filtered on a non-existent column → PostgREST errored → the code's `data ?? []`
  **silently swallowed it → every section showed empty ("No projects yet") for all non-admin users**.
  Parsa (admin) still saw data only because he was on a dev DB that had 0014. Diagnosed via the tell
  `column "showcase_mode" does not exist`. **Fixed by pasting `0014_showcase_mode.sql` into the
  Supabase SQL Editor and running it directly on prod** (`ibbfptujwtbfwdefllgz`). This applied the 4
  seeded demo projects to prod too (inert unless showcase on). The SQL-Editor apply bypassed the CLI,
  so history was out of sync — **RESOLVED 2026-07-16 via `npx supabase migration repair --status
  applied 0014`; the CLI history is now correct and 0015 pushed cleanly after it.**
- NOT DONE: disabling public signups in the Supabase dashboard; formal E2E with RLS negative checks
  (deferred — 2-browser tested). **The agreed feature plan is now fully built.**

## File map (key files)
- `src/lib/data/session.ts` — cached session context + `requireSection`/`requireAdmin` guards.
- `src/lib/actions/*.ts` — server actions per section (account, admin, debug, work, learn,
  management, marketing).
- `src/lib/{types,options,colors,finance,utils}.ts` — domain types, dropdown vocabularies,
  member colors, TL/FX math, cn+formatters.
- `src/components/ui/*` — the design system (button, create surfaces, dropdown, date-picker,
  number-input, typed-inputs, color-picker, **checkbox**, badge, panel, empty-state, skeleton…).
  `checkbox.tsx` is the one styled checkbox (peer input under a brand box, controlled or
  uncontrolled) — use it everywhere, never a native `type="checkbox"`.
- `src/components/shell/tabbed-panels.tsx` — the shared instant-tab shell. Owns the PageHeader +
  tab bar; each panel's content (and its per-tab header action) is rendered on the server and passed
  in, so switching is pure client state — no navigation, no refetch, URL reflects `?tab=…`. Used by
  Work + Management; Marketing predates it and uses its own `marketing/workspace.tsx` (same pattern).
- `src/components/<section>/*` + `src/app/(app)/<section>/…` — per-section UI/pages. **Tabbed
  sections are single pages that fetch every tab's data up front and switch client-side:**
  - Work → `work/page.tsx` + `work/panels.tsx` (Projects/Ideas). `/work/ideas` → `/work?tab=ideas`.
  - Management → `management/finance/page.tsx` + `management/panels.tsx` (Finance/Contracts).
    `/management` → `/management/finance`; `/management/contracts` → `…finance?tab=contracts`.
  - Marketing → `marketing/page.tsx` + `marketing/workspace.tsx` (Campaigns/Content/Links).
    `/marketing/content|links` → `/marketing?tab=…`.
  Old sub-routes are redirect stubs; list-level `revalidatePath`, form `onDone`, and detail back-links
  all point at the `?tab=` URLs. `SectionTabs` + per-section `tabs.ts` were retired.
- `src/components/ui/toast.tsx` — toast provider + `useToast()` (success/error/loading/info,
  promise wrapper). Mounted once in `(app)/layout.tsx`. `src/lib/use-action.ts` — `useAction()`
  wraps optimistic mutate→run→rollback+toast; the one way client components fire actions now.
- `src/lib/data/activity.ts` — membership-gated recent-activity fan-out (debug/ideas/projects/
  transactions/posts), merged newest-first. `src/components/shell/activity-feed.tsx` renders it.
- `src/components/shell/reminders.tsx` + `src/lib/actions/reminders.ts` — DB-backed personal + team
  reminders (Share button posts a team one; RLS in migration 0008). `Reminder` type in types.ts.
- `src/components/shell/logo.tsx` — the brand mark (`/kagu-mark.png`, 0.4KB, downscaled from
  `/brand/kagu-logo-source.png`). App icons: `src/app/icon.png` + `apple-icon.png`.
- `src/lib/actions/notify.ts` (helper: notifySection/notifyEveryone/notifyUser, best-effort, actor
  excluded) + `notifications.ts` (markAllRead/clearAll). `shell/notification-bell.tsx` renders the
  bell; layout fetches the feed. Events fire from debug/work/reminders actions. **The three notify
  helpers are FIRE-AND-FORGET (return void, run inside `after()`) — call them WITHOUT `await`; the
  SELECT+INSERT happens after the response ships. Don't re-add `await` or they'll block the save.**
- `src/components/shell/announcement-hero.tsx` + `lib/actions/announcements.ts` — admin banner
  (one active at a time). `src/components/shell/command-palette.tsx` — ⌘K nav+actions.
- `supabase/migrations/0001–0010` — full schema history (0008 reminders, 0009 notifications,
  0010 announcements; all applied to cloud).
- `scripts/seed-admin.ts` — idempotent first-admin seed.

## Roadmap / next steps
DONE this session: notifications, announcements hero, ⌘K palette, task/idea editing, admin-row
redesign, empty-state CTAs (a–c, f from the old list); **DB/save latency pass — double-auth killed via
`getClaims()`, notifications deferred via `after()` (see Current status).** REMAINING:
00. 🌏 **MIGRATE the Supabase project from Tokyo (`ap-northeast-1`) to an EU region** — confirmed the
    single biggest remaining perf win (see Current status). Not in-place: new EU project → dump/restore
    → swap ref/URL/keys in `.env.local` + Vercel + re-run migration history. Cheapest to do NOW while
    the DB is near-empty. Do it with the team briefly offline.
0a. ⚠️ **Fix the silent error-swallowing on list pages** (see gotcha) — check `error` on every
    `.select()` and surface it, so the next schema/migration slip screams instead of showing a fake
    empty state. Consider a shared `selectOrThrow` helper + a CI guard that blocks deploying code
    which references a column no applied migration has added. **Still the #1 latent risk.**
0b. ~~Reconcile CLI migration history with hand-applied 0014~~ — DONE 2026-07-16 (`migration repair`).
1. Disable "Allow new users to sign up" in Supabase dashboard (Auth → Sign In / Up).
0. ⚠️ **push migration 0012** (`npx supabase db push`) — widens project_secrets RLS to Work members
   (0011 shipped it Management-gated; Parsa moved it to Work). 0011 already applied.
2. **Communications / CRM section** — leads + clients, status, links to everything tied to them.
   (New section: table + RLS + CRUD + nav entry. NOT started — the one remaining buildable feature.)
3. ~~Project credentials store~~ — DONE (project detail page; now **Work-gated**, migrations 0011+0012).
   Everyone in Work sees/manages per-project credentials.
4. **Loading/perf strategy — AGREED (2026-07-16), partly shipped.** The app is already the hybrid
   "sweet spot": SSR shell for instant paint + client-side routing (instant tabs) + `staleTimes`
   route caching. Decision: **eager-prefetch only the heavy routes** (Finance charts, Debug board)
   from the dashboard during idle — shipped in `shell/prefetch-heavy.tsx` (mounted on the dashboard,
   membership-gated). Lighter sections stay on Next's default hover/viewport prefetch. Do NOT
   eager-prefetch everything (wasteful for 8 users). Add `loading.tsx` skeletons only where a route's
   data is genuinely slow — not as a blanket. When adding a new heavy route, add it to `heavyRoutes`
   in `app/(app)/page.tsx`.
4. **Showcase mode** — DEFERRED, needs a design decision before building. "Click → all data becomes
   fake demo data; leaving needs the account password." Touches EVERY section's data path + is
   security-sensitive (must be enforced server-side, not a client flag). Recommended shape: a
   separate read-only demo dataset that showcase mode reads from, + a re-auth gate to exit. Scope
   this with Parsa first.
5. Finance exports + budgets + per-client P&L.
6. Onboard the team (create the other 7 accounts), import the old sheet, retire it.

Cross-cutting: keep weaving the perf pass and the `useAction`/toast HCI pattern into every new
surface; run `/impeccable audit` after the batch (design hook was silenced after 6 edits/file).

## Deliberately partial — grows later (scope ledger)
| Area | What shipped now | Intended full shape | Grows in |
|---|---|---|---|
| Notifications | in-app center (done) | Telegram bot later | later |
| Reminders | personal + team, DB-backed (done) | — | — |
| Editing | tasks/ideas/projects inline (done) | — | — |
| Comms/CRM | none | leads/clients + linked resources | next (roadmap 2) |
| Project creds | none | plaintext RLS-gated accounts store | next (roadmap 3) |
| Showcase mode | none | fake-data demo mode w/ re-auth exit | deferred, needs design (4) |
| Invites | admin sets temp password | email invites via SMTP | when SMTP exists |
| Roles | membership + global admin | per-section roles (Learn owner) | when needed |
| Finance reports | 12-mo chart + tiles + recurring breakdown | exports, budgets, per-client P&L | roadmap 5 |
| Marketing | campaigns/content/links CRUD | analytics pulls, approval flows | next phase |
| i18n | English only | next-intl (TR) | if requested |

## Gotchas / open issues
- ⚠️ **List queries silently swallow errors.** Pages like `work/page.tsx` do
  `const { data } = await supabase.from(...).select(...)` then `data ?? []` — the `error` field is
  ignored, so a failed query (missing column, RLS block, schema drift) renders as a benign empty
  state instead of throwing. This is what turned the un-pushed-0014 migration into a silent
  company-wide outage that looked like "no data." **STILL UNFIXED (roadmap 0).** When touching any
  list page, check `error` and surface it. This is the single biggest reason a schema/migration slip
  is hard to diagnose here.
- Secrets only in `.env.local` + Vercel env. Access token + service key were pasted in chat —
  rotate anytime in dashboard.
- `db push` needs `$env:SUPABASE_ACCESS_TOKEN` set and pipes `"Y"`; Docker warning is harmless.
- Realtime respects RLS; if the debug board shows "connecting…" forever, check Realtime is
  enabled for the project and `debug_tasks` is in the publication (it is, migration 0001).
- Deleting a user cascades cleanly (created_by set-null everywhere).
- `staleTimes` is experimental — if a Next upgrade breaks it, drop it from next.config.ts.

## Running it
- `npm run dev` · `npm run build` · `npm run lint`
- `npx supabase db push` — apply new migrations (Parsa runs interactively; token in `.env.local`;
  harmless Docker-cache warning on Windows, apply still succeeds). 0008–0010 are all applied.
- `npx tsx scripts/seed-admin.ts` — re-seed admin (idempotent)
- `node .claude/skills/impeccable/scripts/detect.mjs src` — design lint (clean as of today)
