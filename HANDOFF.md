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

## Current status (2026-07-18)

### 🧩 DEBUG QoL + TEAM PRESENCE + ⌘K LEAK FIX (2026-07-18) — BUILT + STATICALLY VERIFIED, live-drive by Parsa pending
Four asks from Parsa (two via debug-board screenshots). Green: `tsc`, lint (back to only the 2
pre-existing errors — this batch also FIXED the third one that had crept into admin/user-row.tsx,
`Date.now()` in render → `new Date().getTime()`, task-row's accepted pattern), `check:demo`
(77 reads, all filtered), `npm run build`. **Migration 0027 APPLIED to prod via the Management API
helper + schema/grant-verified.** Not runtime-driven by Claude (same prod reasons). What shipped:

- **Debug task Copy button** (task-row.tsx, expanded row next to Edit): copies a plain-text
  snapshot — title, meta line (board · priority · due · author), blank line, description — via
  `navigator.clipboard`, toasts "Task copied."
- **Debug task edit can now move the task to another project** ("editing in debug tab" bug):
  a board Dropdown (General + all projects) in the inline edit form; `updateTask` gained
  `project_id` (same only-touch-when-provided shape as `due_on`, "" → null). TaskRow now
  receives `projects` from the board.
- **⌘K showcase leak FIXED** ("Showcase mode bug" from Kemal): `searchContent()` was always
  showcase-filtered server-side, but the palette caches hits client-side per session — enter
  showcase and the cached REAL rows kept answering searches. Fix: layout passes `showcase` into
  CommandPalette; a showcase flip drops the cache during render (anti-flash pattern), next open
  refetches the right world. Works in both directions (real→demo and demo→real).
- **Team presence widget** (dashboard top-right, `shell/team-presence.tsx` + **migration 0027**:
  `profiles.status_kind/status_text/available_to_call` + per-column GRANTs — 0015 lesson).
  Work members only (admins ∪ `work` memberships — same denominator as the ideas pipeline),
  **hidden in showcase mode** (real names/last-seen must not show in a client demo). Trigger =
  avatar stack (initials in identity colors) + "N on"; popover (frosted, pop-in) lists everyone:
  status line, green online dot (<6 min, same window as admin rows), "call ok" chip, last-seen.
  Top section = your own editor: status Dropdown (Working / Deep focus / In a meeting / On a
  break / Unavailable / Off today / Custom…) — custom shows a text input (80 chars, saves on
  Enter/blur), non-custom kinds save on pick — + an "Available to call" Checkbox. Optimistic via
  `useAction`; new action `updateMyStatus` in account.ts (kind whitelist, custom-with-empty-text
  collapses to none). `StatusKind`/`STATUS_LABELS` live in types.ts.
- ⚠️ `.env.local` had REGRESSED to `SUPABASE_ACCESS_TOKEN = "…"` (space + quotes — the exact
  0716 parse bug, back again). Fixed in place. If `apply-migration.mjs` says "token not found",
  check this first.
- 📝 **0026_debug_grant_with_work.sql** (untracked file from a prior session — work⊆debug
  auto-grant + backfill) was **verified already applied to prod** this session (function body
  includes the debug grant). It just needs committing.
- 💬 **Debug batch-add ("brainstorm sessions") — DESIGNED WITH PARSA, then BUILT same session.**
  Agreed shape: rapid-add bar + session trail, NOT a fullscreen mode (capture is already solved
  by realtime; the win is triage right after). What shipped (`debug/batch-add.tsx` + board.tsx):
  - **"Batch add" toggle** on the board (next to the live indicator) → slim capture bar above the
    list: one input (autofocus), **Enter posts + clears + keeps focus**, Esc/X closes. Board
    Dropdown pre-selected from the current board tab. Tasks land medium-priority/open — details
    are for triage via the existing inline edit.
  - **Paste-a-list**: a multi-line paste offers "Add N tasks?" (one confirm, one insert).
  - **Session trail**: everything added while the bar's open is tinted (`bg-primary/5`, TaskRow
    `highlight` prop) and **pinned above the rest of the list** until cleared. After the bar
    closes a slim header ("N added this session — set priorities, claim, clear the dupes." +
    Clear) keeps the trail alive for triage.
  - **One collapsed notification per session, not per task**: `quickAddTasks` (new action —
    N titles in ONE insert trip, NO notify) + `notifyDebugBatch` ("14 new tasks on Pet App",
    existing `debug_task_new` kind, no migration). Fired on bar close with the DELTA since the
    last notify (`notifiedCount` ref), so reopen/close never double-pings. If the user navigates
    away without closing the bar, no ping fires — accepted (realtime already showed the tasks).

## Current status (2026-07-17)

### 🧭 WORK/IDEAS PIPELINE + CROSS-SECTION POLISH (2026-07-17) — BUILT + STATICALLY VERIFIED, live-drive by Parsa pending
One session, ~905 lines across 20 files + **3 migrations (0020, 0021, 0022 — all APPLIED to prod via the
Management API helper + schema-verified)**. Green: `tsc`, lint (no NEW issues — the same 2 pre-existing
errors in create.tsx + command-palette.tsx remain), `check:demo` (72 reads, all filtered), `npm run build`
(all routes). **NOT driven at runtime by Claude** — Parsa verifies live because the dev server points at
prod and several flows write real rows / fan out to real teammates (see ⚠️ below). What shipped:

- **Ideas → real decision pipeline.** Votes gained a **value** (`idea_votes.value` ±1) — up/down, not
  upvote-only; `VoteControl` in idea-bits.tsx is a compact ▲·net·▼ segment, optimistic (adopts server
  truth during render, same anti-flash pattern as the rest of the app). **Unanimous auto-promote**: an
  idea snapshots `required_count` (everyone with Work access = admins ∪ `work` members) at post time —
  **frozen so later joiners can't un-pass it** — and when upvotes reach it with **zero downvotes** (a
  downvote is a veto) and `required_count ≥ 2`, `setVote` calls the shared `promoteIdeaCore` and returns
  `promotedProjectId` so the client routes to the new project. `PromoteProgress` shows "6 / 8 to promote"
  or "Blocked — N vetoes". Denominator via `public.work_access_count()` (thin wrapper over
  `private.work_access_count()`, SECURITY DEFINER — PostgREST only exposes `public`). Ideas also gained a
  `stage` column (open→discussing→accepted→promoted/rejected) and `status` widened to include `rejected` —
  **stage funnel UI is Phase 2, columns exist now**.
- **Work filters + sort** (`work/work-filters.tsx`): URL-backed (`?p_status=…`, `?i_sort=…` — each tab
  namespaces its params so both coexist), client-side (panels already hold every row), on BOTH Projects &
  Ideas. Search, status chips w/ counts, sector/type, mine/anyone, sort. **panels.tsx is now `"use client"`**
  (was server) — it owns the filter state; page.tsx passes rows + `currentUserId`.
- **Dropdown gained a local search box** past `searchThreshold` (default 6) — filters label+hint, keyboard
  nav preserved, resets on open. App-wide primitive, so every long dropdown benefits. ⚠️ The two on-open
  state resets live in `setOpenState` (NOT an effect) and the clamp is during-render — done deliberately to
  avoid `react-hooks/set-state-in-effect` (my first pass tripped it; fixed).
- **Debug**: admin **soft "suggest for"** at create (`debug_tasks.suggested_for`, admin-gated SERVER-SIDE
  in createTask — does NOT claim, shows "suggested for X" only while unclaimed; RLS already allowed it).
  **Deadlines** (`debug_tasks.due_on`) — create + inline edit + overdue styling (past + not done → danger).
  Richer board **filter/sort**: assignee (only people holding a task + unassigned), priority, task search,
  sort (smart/priority/deadline/newest). **Board-tab search** when ≥8 project boards.
- **Projects**: `projects.due_on` — picker on create/edit + a Deadline column (emphasized for `active`,
  danger when overdue).
- **Comms interactions log** (new table `contact_interactions`, migration 0022): call/email/meeting/message/
  note timeline per contact (`ContactInteractions` in comms/bits.tsx), + **"last interaction" (date + summary)**
  on the contact list — one extra query in the existing wave, reduced to newest-per-contact in JS. Mirrors
  contact_links RLS + showcase-aware select + is_demo; added to check:demo's DEMOABLE list.
- **Account**: team-color legend — shows every OTHER member's name in their color so you pick a unique one
  (color-form.tsx `MyColorForm` gained `teamColors`, account page fetches profiles ≠ me).
- **Announcement hero**: admin **Edit** (Pencil — pre-fills body+tone into the composer; posting replaces
  the active one since postAnnouncement retires-then-inserts) alongside New (+) and Retire (X).

⚠️ **WHY CLAUDE DIDN'T LIVE-DRIVE IT (read before "just verify it").** Dev server → prod Supabase. Writes
that would hit real data / real people if driven: auto-promote **creates a project + `notifySection('work')`
fans out to real teammate accounts** (the exact lesson from the Learn overhaul — notify fan-out reaches real
accounts from a dev drive); logging interactions / posting-editing announcements / creating debug tasks all
write real rows; announcements fan out to everyone. Safe ways to verify: (a) Parsa clicks through live
(chosen), (b) showcase mode for DISPLAY paths only — it's read-only and `blockIfShowcase` stops every write,
so voting/logging/auto-promote can't be exercised there. If a future session must drive writes, plant rows
with the service client and DON'T trigger notify fan-out.

### 🧹 WORK/DEBUG/COMMS BATCH 2 (2026-07-17) — BUILT + STATICALLY VERIFIED, live-drive by Parsa pending
Follow-on to the pipeline batch, same session. Green: tsc, lint (still only the 2 pre-existing errors),
`check:demo` (**77 reads, all filtered** — the new ⌘K search + interaction reads), build. **Migrations 0023,
0024, 0025 all APPLIED to prod** (Management API helper; 0024 enabled pg_cron + scheduled a job — see ⚠️).
Not runtime-driven by Claude (same prod/fan-out reasons). What shipped:

- **Dropdown filter input** — killed the green focus ring (added `data-no-ring`, the app's existing opt-out).
- **Debug "suggest for"** now lists **Work members only** (queries `section_memberships` where section='work'
  on the new-task page; admin-gated) and **notifies the suggested person** on create (`notifyUser`, new
  `debug_suggested` notification kind — migration **0023** widened `notifications_kind_check`; the union in
  `notify.ts` gained it too). notifyUser excludes the actor, so self-suggest doesn't self-ping.
- **Debug auto-archive (migration 0024)** — tasks done for **7 days** get soft-archived (NOT deleted). New
  `debug_tasks.done_at` (set/cleared by a BEFORE trigger on state change — so editing a done task's title
  doesn't reset the clock) + `archived_at` (null = live). A **pg_cron** job `archive-stale-done-debug-tasks`
  runs daily 03:00 UTC calling `private.archive_stale_done_tasks()`. Archived tasks drop off the board
  (`liveTasks` filter) and only reach admins (page query adds `.is('archived_at', null)` for non-admins).
  **Admins get an "Archived (N)" cleanup section** (collapsed) with batch-select + hard-delete via
  `deleteTasks` (requireAdmin). `board.tsx` grew `ArchivedSection`.
- **Debug board search** threshold lowered 8→**5** (shows with your ~8 boards) + Enter jumps to a single match.
- **⌘K palette now searches CONTENT**, not just nav actions. `lib/actions/search.ts` → `searchContent()`
  fetches tasks/projects/ideas/contacts/sprints (section-gated via `canAccess`, demo-filtered, PER_TYPE_CAP
  200) in ONE wave; the palette loads it **once on first open, caches for the session**, and filters
  in-memory per keystroke (NO per-keystroke DB hit — that was the explicit perf ask). Content hits only show
  once you type; each carries a type badge + sub-label (project/company/client). Tasks link to /debug (no
  per-task route).
- **Admin "last seen" (migration 0025)** — `profiles.last_seen_at` + column GRANT (same per-column pattern as
  showcase_mode/color — 0015 lesson). Bumped in `getSessionContext` **throttled to >5 min stale, inside
  `after()`** (fire-and-forget, ≤1 tiny write per user per 5 min, never blocks the page). Admin user rows show
  "Online now" (green dot, <6 min) / "Seen 3h ago" (`formatRelative`) / "Never signed in". **NOT** the cheap
  `auth.last_sign_in_at` — that reads weeks-stale under this app's long-lived JWT sessions, which is why we
  built real activity tracking.

⚠️ **NEW: a pg_cron job now runs daily (0024).** `select cron.schedule('archive-stale-done-debug-tasks', '0 3
* * *', …)`. First use of pg_cron in this project. To inspect: `select * from cron.job;` / `select * from
cron.job_run_details order by start_time desc limit 5;`. To change the window, edit
`private.archive_stale_done_tasks()` (the `interval '7 days'`). If a future migration needs pg_cron and errors,
it's already enabled now.
⚠️ **`notify.ts` NotifyKind + `notifications_kind_check` must stay in sync** — adding a kind means BOTH the TS
union AND a migration widening the DB constraint (0023 did this for `debug_suggested`; 0019 for the learn kinds).

### 🎓 LEARN OVERHAUL (2026-07-17) — authoring flow + visuals rebuilt, VERIFIED end-to-end
Parsa: "insanely hard to build new things as an admin, visuals bad." Agreed in plan mode, built,
then verified against prod with two throwaway users (created + deleted the same session; all
`[test]` sprints removed, checked zero leftovers). What changed:
- **`/learn/new` is now a full composer** (`learn/sprint-composer.tsx`): basics + live duration
  hint + participant picker ("Everyone" toggle) + goals (batch textarea → orderable draft list) +
  resources (links + staged file uploads) — ONE submit creates everything via `createSprintFull`
  (returns `{ok, id}`, no redirect, so staged files upload under `${id}/…` before navigating).
  Empty-confirm bar covers Title/Description/Participants/Goals. Old two-step create is gone
  (`new-sprint-form.tsx` deleted, `createSprint` action removed).
- **`/learn/[id]/edit`** (new route, `requireAdmin`): two-column builder (settings+participants |
  goals+resources) + danger zone (**Duplicate sprint** → copies goals/participants, starts today,
  same duration → lands on the copy's edit page; Delete). The detail page is now consume-only with
  an Edit button for admins.
- **Goal ordering finally uses `sort_order`**: shared `goal-list-editor.tsx` (composer + edit page)
  — hand-rolled pointer drag on a grip (NO new dependency), up/down arrow buttons, arrow-key
  support on the handle, inline click-to-rename. Actions: `reorderGoals` (parallel updates, one
  wave), `updateGoal` (blank keeps old title). All optimistic w/ rollback.
- **Race standings (Parsa request: "progress like a race, not a game")**: `race-standings.tsx` —
  identical full-width lanes per participant toward one finish-line hairline, sorted by done count
  (competition ranking, ties share rank), identity-colored fills, viewer's lane tinted + "You".
  No badges/confetti — restraint held. **Round 2 (same day, Parsa): Standings IS the progress
  view** — each lane carries an "on · <first unticked goal>" / "finished" status line and expands
  on click to that person's full per-goal checklist (with a "now" tag); lane swaps animate via
  measured FLIP (`el.animate`, transform-only, reduced-motion aware). **The Team progress grid was
  REMOVED** (`progress-grid.tsx` deleted) — the expanded lanes carry the who-did-which detail.
- **One optimistic owner for ticks**: `sprint-progress.tsx` owns the shared done-set and renders
  Your goals (with an "up next" marker on your first unticked goal) + Standings; a tick moves your
  race lane instantly. `my-goals.tsx` was absorbed into it (deleted).
- **Q&A (Parsa, round 2)**: Questions panel on the sprint detail (`sprint-questions.tsx`).
  Any learn member asks; a Dropdown picks the audience — **Everyone** (notifies the learn section)
  or **Admins only** (asker + admins; RLS-enforced, other members never see it — verified with a
  3rd user). Replies inherit the question's visibility (their RLS policy EXISTS-es against
  `sprint_questions`, so its policy decides both); reply notifies the asker. Ask/reply via
  ⌘+Enter; delete own (or any, as admin) with success toasts. **Migration `0019_sprint_questions.sql`
  — APPLIED to prod via `db push` (2026-07-17)**: `sprint_questions` + `sprint_question_replies`
  (+ is_demo, composite indexes) and widened `notifications_kind_check` for `learn_question` /
  `learn_answer`. `notify.ts` gained `notifyAdmins()` (same fire-and-forget `after()` shape —
  call WITHOUT await). Both tables added to check:demo's DEMOABLE list (now **68 reads, all
  filtered**; the detail-page reads are parent-scoped so they're SAFE shapes).
- **Detail hero**: "day X of Y · team N% done" mono line + thin elapsed-time bar (active),
  "starts in N days" (upcoming). Resources rows fixed: title = ONE primary link (url, else signed
  file), both-url-and-file → small "file" chip (the confusing twin anchors are gone).
- **`/learn` list**: grouped Active / Upcoming / Past (badges dropped — group labels carry phase),
  meta gains "Nd left" + "team N%", personal progress bar as before. Team % needed everyone's
  progress rows — same wave, `.eq("is_demo", ctx.showcase)` added (check:demo caught the miss;
  it now reports **65 reads, all filtered**).
- Small kit changes: `DatePicker` gained optional `onChange` (additive); `CreatePage` gained
  `wide` prop (max-w-2xl) for composer-type surfaces. `deleteSprint` now sweeps the sprint's
  storage folder (uploads no longer orphan) AND everyone's notifications whose `href` deep-links
  to the sprint (service client — other users' rows are outside the admin's RLS; verified by
  planting a notification, deleting the sprint via UI, asserting the row gone). Without the sweep
  a question notification outlives its sprint and 404s from the bell — Parsa hit exactly this
  from the test-run fan-outs (those 14 stray rows were deleted from prod by hand, 2026-07-17).
  ⚠️ Same dead-link shape exists app-wide (idea/debug notifications vs deleted content) — worth
  the same sweep if it ever bites there.
  ⚠️ Testing lesson: notifySection/notifyAdmins fan out to REAL accounts even from a dev-server
  test drive — plant rows with the service client instead of triggering fan-out when verifying.
- **Verified** (Playwright vs `npm run dev`, throwaway users seeded then deleted, screenshots
  reviewed — both rounds): composer end-to-end incl. draft reorder/rename + link resource;
  empty-submit confirm → "Untitled sprint" defaults; member sees no Edit button, `/edit` redirects
  them, their tick moves their lane; drag reorder + rename persist; duplicate lands on a NEW edit
  page; standings status lines advance on tick, lanes expand, "Team progress" gone; Q&A: B's
  admins-only question invisible to C, visible to admin A; A's reply visible to B + notification;
  B deletes own question (row leaves after revalidation). NOT exercised live: file-upload path on
  create (link path was; upload code is the same browser→bucket pattern as before) and the storage
  sweep on delete. Build + lint clean (the 2 pre-existing lint errors remain), check:demo green.
  ⚠️ Verification gotcha: TaskStop on `npm run dev` can orphan the listener on Windows — kill the
  PID on the port (`netstat -ano | findstr :3400`) or the next run drives STALE code.

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
  Currently: 65 reads, all filtered (it caught the Learn list's new team-progress query same day). **Validated both directions** — deleting one `is_demo` line
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
  action now tells the user what happened. Lower-traffic admin flows (fx-editor, user-row,
  contract-bits, color-form, import-debug) still use inline errors — fine. (sprint-forms and
  progress-grid moved onto `useAction`/toasts in the 2026-07-17 Learn overhaul.)
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
  - Work → `work/page.tsx` + `work/panels.tsx` (Projects/Ideas — **now `"use client"`, owns filter state**)
    + `work/work-filters.tsx` (URL-backed filter bar + `useWorkFilters` hook, shared by both tabs)
    + `work/idea-bits.tsx` (`VoteControl` up/down, `PromoteProgress` bar, IdeaActions). `/work/ideas` →
    `/work?tab=ideas`. Auto-promote lives in `lib/actions/work.ts` (`setVote` → `maybeAutoPromote` →
    `promoteIdeaCore`, shared with the manual `promoteIdea`). `work_access_count()` = the unanimous
    denominator (public wrapper over private, both in 0020).
  - Management → `management/finance/page.tsx` + `management/panels.tsx` (Finance/Contracts).
    `/management` → `/management/finance`; `/management/contracts` → `…finance?tab=contracts`.
  - Marketing → `marketing/page.tsx` + `marketing/workspace.tsx` (Campaigns/Content/Links).
    `/marketing/content|links` → `/marketing?tab=…`.
  Old sub-routes are redirect stubs; list-level `revalidatePath`, form `onDone`, and detail back-links
  all point at the `?tab=` URLs. `SectionTabs` + per-section `tabs.ts` were retired.
- **Learn (post-overhaul 2026-07-17)**: `learn/page.tsx` (phase-grouped list) · `learn/new` +
  `learn/sprint-composer.tsx` (one-shot builder) · `learn/[id]/page.tsx` (consume-only detail) ·
  `learn/[id]/edit/page.tsx` + `learn/sprint-forms.tsx` (admin builder + Duplicate/Delete) ·
  `learn/goal-list-editor.tsx` (shared drag/arrows/rename list) · `learn/sprint-progress.tsx`
  (owns the optimistic done-set; renders Your goals + Standings) · `learn/race-standings.tsx`
  (the race: status lines + expandable per-person checklists) · `learn/sprint-questions.tsx`
  (Q&A panel, audience-scoped). `my-goals.tsx`, `new-sprint-form.tsx`, and `progress-grid.tsx`
  no longer exist.
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
- `src/components/shell/team-presence.tsx` — dashboard top-right team widget (avatar stack →
  frosted popover: everyone's status/last-seen/call-availability + your own status editor).
  Work-gated, hidden in showcase. Types (`StatusKind`, `STATUS_LABELS`) in types.ts; action
  `updateMyStatus` in account.ts; columns from migration 0027.
- `supabase/migrations/0026` (work⊆debug auto-grant, applied to prod, file untracked in git) ·
  **0027** presence status columns + grants (applied 2026-07-18).
- `supabase/migrations/0020–0025` (all APPLIED to prod, 2026-07-17): **0020** idea pipeline (vote value,
  required_count/stage, work_access_count) · **0021** debug suggest_for/due_on + project due_on · **0022**
  contact_interactions · **0023** debug_suggested notify kind · **0024** debug auto-archive (done_at/archived_at
  + triggers + **pg_cron** daily job) · **0025** profiles.last_seen_at + grant.
- `scripts/apply-migration.mjs <file.sql>` — applies one migration via the Management API (parses
  `SUPABASE_ACCESS_TOKEN` from `.env.local`, no deps). `scripts/verify-0020.sql` checks 0020/0021/0022 landed.
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
2. ~~Communications / CRM section~~ — DONE (leads/clients + linked resources, 0013). **2026-07-17: added
   an interactions log (0022) + "last interaction" on the list.**
2b. **Ideas pipeline Phase 2/3 (agreed w/ Parsa 2026-07-17, "far more than the minimum")** — the up/down +
   unanimous auto-promote + filters shipped; NEXT: stage funnel UI (the `stage` col + `rejected` status
   already exist), reactions (🤔 needs-discussion / 🔥 love-it), effort×impact tags + a quick-wins sort,
   duplicate/merge, auto-archive stale ideas, a "needs your vote" nudge (critical — unanimous is
   unreachable if people forget to vote), and a weekly digest via `notifySection`. See the scope ledger.
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
| Ideas pipeline | up/down votes, unanimous auto-promote, "N to promote" bar, filters (done) | **stage funnel UI (open→discussing→accepted; cols exist), reactions (🤔/🔥), effort×impact + quick-wins sort, dedupe/merge, auto-archive stale, "needs your vote" nudge, weekly digest** | Phase 2/3 (Parsa's "far more" — agreed, not yet built) |
| Comms interactions | log per contact + last-interaction on list (done) | analytics / follow-up reminders | later |
| Debug lifecycle | suggest-for + deadlines + auto-archive (7d, pg_cron) + admin batch-delete (done) | — | — |
| ⌘K search | nav actions + content (tasks/projects/ideas/contacts/sprints), loaded-once client-filter (done) | live/fresh results, ranking, recents | later |
| Presence | last_seen_at + dashboard team widget: self-set status (working/focus/meeting/break/unavailable/off/custom) + available-to-call + online dot (done 2026-07-18) | per-section activity, realtime presence updates | later |
| Debug batch-add | rapid-add bar + paste-a-list + session trail + collapsed notify (done 2026-07-18) | — | — |
| Comms/CRM | leads/clients + linked resources (done) | — | — |
| Project creds | plaintext RLS-gated accounts store (done) | — | — |
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
- ⚠️ **Idea auto-promote fans out to real teammates.** `setVote`→`maybeAutoPromote` calls
  `notifySection('work')` and creates a real project the instant an idea goes unanimous. It's gated behind
  `!ctx.showcase` (demo ideas never auto-promote) and `required_count ≥ 2`, but on real data a single vote
  that completes the set WILL notify everyone and mint a project. Don't trigger it from a dev test drive
  against prod — that's a real fan-out. The `required_count` is a snapshot from post time (not live), so a
  roster change doesn't move the bar retroactively.
- ⚠️ **Migrations 0020/0021/0022 applied via the Management API helper** (`scripts/apply-migration.mjs` —
  parses `SUPABASE_ACCESS_TOKEN` from `.env.local`, no dotenv dep; `scripts/verify-0020.sql` checks all
  three landed). CLI `db push` history does NOT know about them unless repaired — same situation as 0017/0018.
  If you `db push` later and it complains, `migration repair --status applied 0020 0021 0022`.
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
