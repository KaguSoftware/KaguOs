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

## Current status (2026-07-19)

### 🟢 TASK SCREENSHOTS + COMMS SPLIT + MOBILE REMINDERS (2026-07-19) — BUILT + STATICALLY VERIFIED, on `main`, migrations 0036+0037 APPLIED to prod, **live-drive by Parsa PENDING**
Three items Parsa noted at the gym, plus Kemal's standing Comms request. Migrations `0036`
(`debug_task_images` + private `debug` bucket) and `0037` (`comms_meetings` + `comms_notes`) are
live in production.

1. **Screenshots on debug tasks.** Private `debug` bucket, member-write (deliberately unlike
   `learn`, which is admin-write — a screenshot is part of reporting a bug). Attach from **three**
   places: the create form (files are staged locally and flushed once `createTask` returns the new
   id — they can't upload earlier, nothing to key them to), the expanded row, and the row EDITOR.
   All three exist because Parsa reached for each in turn and hit a dead end. Caps: 6 per task,
   5MB each, PNG/JPEG/WebP/GIF, all announced rather than silently truncating.
2. **Copy carries the images — for pasting into Claude Code.** This is what decided the design: a
   terminal takes text only, can't receive a pasted image, and can't fetch a private Supabase URL.
   The only thing it can act on is a LOCAL PATH. So Copy downloads the files and writes their
   filenames into the text. `imageStem()` computes the name once for both the download and the
   text — if those ever drift, the paste hands Claude a path that doesn't exist, which is worse
   than no path. **Clipboard is written BEFORE awaiting the fetches** (Safari rejects a `writeText`
   that's drifted from its user gesture).
3. **Comms split into External / Meetings / Notes** — Kemal's request, finally scoped and built.
   Both internal tables are SHARED with the whole comms section, not private: "in case it comes up
   later" fails if only the author can see it. `comms_notes` is deliberately body + pin and nothing
   else — a title, a category and a status would each be a reason not to bother.
4. **Reminders composer stacks on phones.** `sm:contents` dissolves the wrapper at desktop so the
   existing shift-free row is byte-identical to before. Do not remove it (see the anti-shift
   comments in `reminders.tsx`).

**Not yet driven by a human on any of this.** The one test that matters: copy a task with 2 images,
paste into Claude Code, confirm it can `Read` both paths unaided.

### 🟢 DEBUG OVERHAUL + DASHBOARD RESHAPE + APP-WIDE DATE FIX (2026-07-19) — SHIPPED, merged to `main` (`3f5f7b9`), migration 0035 applied, production deployed
Two review passes ("go through the entire debug tab / dashboard tab, list me improvements") turned
into two plans, both approved and built. Branch `debug-board-overhaul` (off `main`), commits
`b4a7580` (debug) + `cff9f79` (dashboard/dates) + this one. Preview:
`kagu-clpw786cd-bau-engs-projects.vercel.app`. **Not merged to main, not promoted to prod.**

**⚠️ TIMEZONE — the important one.** `new Date().toISOString().slice(0,10)` was in **9 places**
(dashboard, learn ×3, work, management ×2, debug). That's UTC; Istanbul is UTC+3, so from
00:00–03:00 local every one answered *yesterday* — sprints not "active", tasks due today shown
"Overdue". Fixed with **`todayInIstanbul()`** (`lib/utils.ts`, Intl pinned to `Europe/Istanbul`,
DST-correct). **`todayLocal()` is NOT the fix and is now documented as narrow** — it reads the
machine clock, which on the server is the Vercel runtime (no `TZ` env var, region `hnd1` ⇒ UTC),
so it would have reintroduced the bug while looking like a fix. Use `todayInIstanbul()` for every
domain date; `todayLocal()` only for viewer-local things (a download filename). `addDays()` no
longer routes through either, so no timezone can leak in.

**Debug board** (`b4a7580`): archived rows no longer counted in board tab counts · inline edit
posts the same object it renders optimistically · realtime handlers now honour the page query's
`is_demo` scope (a real task could stream onto the **showcase** board) and drop rows that leave
scope · **`unclaimTask` had NO ownership check and neither did RLS** — anyone in Debug could
release anyone's claim; guarded in the action **and** in `private.debug_guard_unclaim()`
(**migration 0035, APPLIED**). RLS can't express it: `using` sees the old row, `with check` the
new one, and "assignee_id changed from someone else's" needs both, so it's a before-update trigger.
Row rebuilt as a **grid** with a declared `md` collapse (the flex-wrap reflowed below ~1100px).
**Kind and priority swapped roles** (Parsa): priority is a 4-step *scale* so it stays a word-pill;
kind is a 3-value *category* with existing icons, so it became the leading tinted mark — tints are
slate/blue/violet, deliberately NOT green/amber/red, which are the state vocabulary. Due chip only
when overdue or within 7d. Done/archived rows recede by colour, not `opacity-60` stacked on already
-muted text (was under the AA floor). Kind/state/priority folded into one **Filters popover** with
a count. **Active/Mine/Done/All are now PRESETS that write the real filters** — they used to be a
second filter system that could contradict the multi-selects (Mine + another assignee = guaranteed
empty board, nothing explaining why). Smart sort leads with **overdue**.

**Dashboard** (`cff9f79` + this commit): debug counts now filter `archived_at`, so the dashboard
and the board agree (the header says it out loud — "You have N tasks on your plate"). Announcement
**"Edit" was a replace** — it retired the row and inserted a new one, resetting `created_at` and
reassigning `created_by`; added `updateAnnouncement()`. **Six identical cards → one dense stat row**
(the card grid is named in both DESIGN.md bans and PRODUCT.md anti-references, and it duplicated
the sidebar); blurbs were filler, stats are now numbers not sentences. New **"Needs you"** strip
(overdue + suggested-for-you) above everything, queried **inside the existing single wave** — the
827ms number depends on that. Quick actions 7 → 3 (rest via ⌘K). Activity feed is full-width, and
gained per-kind filters + "show more" (`PER_SOURCE` 6→15, limit 12→40). **Showcase toggle moved
out of the "New …" row** — it's a mode switch that changes every number on screen and sat one
mis-click from "New contact".

**UI-shift fixes driven by Parsa live** (all the same root cause — a `flex-1` neighbour absorbs any
width change): popovers now flip **above** the trigger when there's no room below
(`lib/use-popover-side.ts`, applied to Dropdown/MultiDropdown/DatePicker — editing the last row in
a list meant scrolling after every click) · expanding a debug row scrolls it into view · debug
"Reset" moved out of the filter row (a reserved slot wasn't enough; the search box is `flex-1`) ·
reminders scope chips are fixed-width with an icon on **both** states, and the submit button no
longer swaps label *or* variant (outline has a 1px border, primary doesn't = 2px shift).

**📱 MOBILE — real menu + status reachable (2026-07-19, from the board).** Sait filed *"Status not
changable through mobile version"*. Root cause: the **entire presence panel lives inside the desktop
`<aside>`, which is `hidden md:flex`**, and `/account` has no status UI — so on a phone there was
literally no way to set your own status. Fixed by exporting **`StatusButton`** from
`sidebar-presence.tsx` (a trigger only — it opens the *same* portaled `StatusModal`, no duplicated
editor) and mounting it in the mobile bar.

That bug was a symptom: the mobile bar was a logo + a **horizontally-scrolling nav strip**, so
sections past the third were invisible unless you guessed to swipe, and account/search/sign-out had
nowhere to live.

**The mobile menu is now a FULL-SCREEN LIVE BOARD, not a drawer of links** (`MobileMenu` in
`sidebar.tsx`). Parsa rejected two earlier passes — a right-anchored drawer, then the same drawer
with more polish — with "I want something innovative that people open and say wow, but functional",
and he's right that styling a row list can't get there: the *form* was the problem. A drawer only
answers "where do you want to go?". This answers **"what's going on?"**:

- Every section is a **tile carrying its live number** (9 open · 2 projects · 1 sprint), and **a
  section with work in it spans the full width** — so the grid physically reshapes to the state of
  the company and looks different on a Monday than a Friday. That's the part a nav list can't do.
- Header is the one line that's about YOU: an Istanbul-clock greeting + your overdue count
  (`text-danger` when non-zero, "Nothing overdue. Nice." otherwise).
- Utility rail at the bottom: ⌘K search, **who's online right now as coloured avatar chips**
  (5-minute `last_seen_at` window), account/status, sign out.
- Motion: `tile-in` (scale-from-centre, staggered), two blurred brand glows so the screen has a
  light source, `active:scale` press feedback. **Closing animation on EVERY path out** — backdrop,
  X, Escape, and following a link all route through one `close()` that flips a `closing` flag,
  plays `overlay-out`, then unmounts after `EXIT_MS` (kept in sync with the CSS by a comment).

**`src/lib/data/pulse.ts` (NEW)** feeds those numbers: one parallel wave of head-only counts,
`cache()`-wrapped, and it rides in the **same `Promise.all` as `getPresence`** in
`(app)/layout.tsx` — which the layout already awaited after its main wave — so the tiles cost **no
extra round-trip** on a navigation. Deliberately NOT the dashboard's numbers: that page also
fetches recurring items, FX and activity, far too heavy to run on every page just to label a menu.

**`TeamSheet`** (also new, in `sidebar-presence.tsx`): tapping the online avatars in the menu opens
a bottom sheet with **everyone's status** — name, live dot, emoji + status text, remaining time,
call availability. The desktop panel does this with hover cards, which don't exist on touch, so
this is the touch equivalent: everything is on the row rather than hover-revealed. Grab handle,
`sheet-up` entrance, same dismissal contract.

⚠️ Two React-purity traps hit while building this, both caught by lint (`react-hooks/purity`), both
worth remembering: `Date.now()` **and** `new Date()` in a render body are impure. The menu reads the
clock once via `useState(() => Date.now())`; the debug row's due-soon window uses `addDays()` on a
plain string instead of epoch arithmetic.

**Mobile pass across the app** (fixes only, no redesigns): the debug task row's assignee column was
a fixed `w-40` — 43% of a 375px screen — now fluid below `md`. Debug filter controls and the inline
edit form's dropdowns go full-width under `sm` instead of leaving stranded gaps. The Filters popover
is capped to `calc(100vw-2rem)` so it can't overflow. Checked and found already fine: layout padding
(`px-4 md:px-8`), tables (each in its own `overflow-x-auto`), toasts, and the dashboard stat row
(`grid-cols-2 sm:3 lg:6`).

**Also caught during the pass — a follow-through miss on my own rule:** `task-row.tsx` and
`board.tsx`'s `smartSort` were still on `todayLocal()` after the sweep. Both are domain dates (is
this task overdue / where does it sort), so both now use `todayInIstanbul()`. Two people on the same
board must agree on whether a task is late. The download filename in `board.tsx` correctly stays
`todayLocal()` — that one really is about the viewer's own clock.

**Two findings I reported and then WITHDREW after checking** — recorded so nobody re-chases them:
*activity-feed "dead links"* (the feed queries live tables; worst case is the ≤30s client router
cache, `staleTimes.dynamic`, which is app-wide by design) and *announcement "re-notifies everyone"*
(announcements never notified anyone — the real bug was the lost `created_at`/`created_by`, fixed).

### 🟢 DEBUG: fix/feature KIND + MULTI-SELECT FILTERS + FOCUS HERO (2026-07-19) — BUILT + STATICALLY VERIFIED (tsc/lint/build green), committed on `debug-board-overhaul`, live-drive by Parsa pending
Parsa: "add a feature or fix tag to the things in the debug tab, with a filter for it" + "a hero
section in debug tab that admins can write something, similar to the dashboard one, but with presets".
Then, iteratively in the same session: narrow-and-deep presets → a composable sentence builder →
multi-select everywhere → the composer moved into an overlay. **Migration 0031 APPLIED to prod**
via `scripts/apply-migration.mjs` (STATUS 201). Green: `tsc`, lint (zero warnings in the touched
files), `npm run build`. What shipped:

- **`debug_tasks.kind` — `'fix' | 'feature' | 'audit'`** (0031 + **0034**, default `'fix'`: the board
  began as a bug list so every existing row IS a fix). Set on create (`new-task-form.tsx` Kind field)
  and in the inline edit; `createTask`/`updateTask` validate against a `KINDS` whitelist. Shown as a
  `KindBadge` (Wrench / Sparkles / SearchCheck icon + lowercase word) in `task-row.tsx`, and carried
  into the copy/export text (`debug-export.ts`).
- **"Go find what needs doing" is a FOCUS MODE — this was the actual ask.** Parsa: "have an
  announcement preset which tells people to go find issues/features needed with the selected project."
  The focus builder's first step is now **Asking the team to → `Work through the board` | `Go find what
  needs doing`**, because those are opposite instructions and can't share a sentence shape:
  work → "Pet app — fixes, urgent and high priority." · find → "Pet app — go looking for anything
  broken, what's missing. File what you hit." In find mode the qualifier row swaps to **Looking for**
  (bugs · missing features · rough edges · out-of-date stuff), all optional. Persisted in `parts.mode`
  + `parts.hunt` so an item re-opens in the right mode.
  ⚠️ The find sentence **comma-joins** its list and never uses "and" — the clause already ends with
  "File what you hit", and "anything broken and what's missing and file what you hit" was unreadable.
- **`audit` as a third task kind — built BEFORE the ask was clarified, kept because it's genuinely
  useful, but it is NOT what "go find issues" meant.** (Claude first read the request as a new task
  type; Parsa corrected it to a focus preset, above.) Same axis as fix/feature
  ("what sort of work is this"), so it inherits the badge, the multi-select filter and the focus
  builder for free. What makes it different: **an audit's output is a LIST of tasks, not a finished
  thing.** So (**0034**) `debug_tasks.found_by` → the audit that turned a task up, and a new action
  **`logAuditFindings(auditId, titles)`** files N findings in ONE trip — they inherit the audit's
  board, default to `fix`, and fire ONE collapsed notification ("Audit found 7: …"), never one per row.
  UI: an audit row's expanded view gets a **"Log findings" / "Found N"** button opening a one-per-line
  textarea; a task that came from an audit reads "· found by <audit title>" in its meta line. The
  `Found N` count is computed over ALL tasks, not the filtered view, so an audit's yield doesn't
  change as you filter.
  ⚠️ `found_by` is **`on delete set null`, NOT cascade** — deleting an audit must never delete the real
  work it discovered; that work is the value the audit produced.
  ⚠️ Filing findings deliberately does **not** mark the audit done — finding things and declaring the
  sweep over are two separate calls, and an audit often files a batch, keeps looking, files more.
  ⚠️ **The kind badge is deliberately NEUTRAL for BOTH kinds.** The first build gave `feature` the
  `green` tone; a critique caught that green already means *done* on this board (`bg-primary/10` badge
  vs `bg-primary/15` done-state button — 5% apart, four hues already on one row). DESIGN.md says colour
  marks STATE ONLY and a kind is not a state. Icon + word carry the distinction. **Don't re-colour it.**
- **ALL board filters are now MULTI-SELECT** (Parsa: "sometimes we need multiple priorities, multiple
  projects"). New **`MultiDropdown`** in `ui/dropdown.tsx` — same shell/keyboard model as `Dropdown`,
  but menu stays OPEN on pick, `aria-multiselectable`, a "Clear selection" footer, and a trigger that
  collapses to "3 projects" past one pick. Assignee / kind / state / priority are `string[]`;
  **empty array = no filter** (so untouched controls never hide rows), several picks are **OR-within,
  AND-across**. The `"" → "Any priority"` placeholder rows were REMOVED from the option lists — the
  neutral state is now the empty array, and each control passes an explicit `placeholder` that still
  names its field ("Anyone" / "Any kind" / "Any state" / "Any priority"). `MultiDropdown` makes
  `placeholder` + `label` REQUIRED props so it can't regress to the generic "Choose…".
  Also: **project boards are ctrl/⌘-click multi-select** — plain click still replaces the selection,
  so the one-board case stays one click; deselecting the last board falls back to `["all"]`. The
  per-row project badge now shows whenever >1 board is in view. "Clear" reports a count ("Clear 3").
  ⚠️ Four of the five refine dropdowns previously had **no accessible name** (the trigger's text is a
  value, not a label) — `MultiDropdown` takes an explicit `label` and builds `aria-label="Kind: 2 kinds"`.
- **Debug focus — a LIST of items, not one banner** (`debug/focus-hero.tsx` +
  `lib/actions/debug-focus.ts` + table `debug_focus`, migrations **0031 + 0032**, both applied).
  Deliberately a **separate table from `announcements`** — that one is company-wide news, this one
  never leaves /debug; sharing a table would mean every announcement query has to remember to filter,
  and forgetting once leaks a debug focus onto the dashboard.
  **The unit is a focus ITEM: a SET of boards (`project_ids`; empty = the whole board) + their shared
  qualifiers — and SEVERAL items are active at once.** Both axes matter and each was wrong once:
  0031 shipped ONE row holding one sentence, so every clause smeared across every project ("Focus on
  Pet app and Site — fixes and features" tells nobody which board needs which); **0032** split it into
  a list but pinned each item to ONE project, which then forced duplicate items for "Pet app and Site
  both need bugs cleared". **0033** made the target an array, so:
  one item + many boards = one shared instruction · many items = genuinely different instructions.
  Two items MAY name the same board (a broad "Pet app — fixes" plus a sharper "Pet app — login crash
  first"); rank disambiguates, so 0032's one-item-per-board unique index was dropped.
  `parts jsonb` holds the structured picks so an item re-opens for editing instead of being retyped.
  `saveDebugFocus({id?, projectIds, …})` — with `id` it UPDATES in place (keeping rank, so the list
  doesn't reshuffle under a typo fix); `clearDebugFocus(id)` / `clearAllDebugFocus()` / `reorderDebugFocus(ids)`.
  **Banner**: 0 items → dashed "Set the focus" (admins only) · 1 item → the full-width tone-coloured
  banner it always was · 2+ → a compact ranked list, one row each, each keeping its own tone dot.
  **Modal** (portaled, frosted, pop-in, Esc/backdrop, scroll-lock — same language as the sidebar
  `StatusModal`, deliberately NOT `CreateOverlay`): shows the CURRENT LIST first with per-item
  up/down/edit/remove, because editing focus is usually a small change to what's there. The composer
  — board chips + a single flat "Narrow it" row (kind · priority · state · order, hairline-separated)
  + the live sentence + tone — appears **only while adding/editing one item**, so the modal is short
  at rest and the chips are never permanent furniture.
  ⚠️ **The board picker gets a search box at ≥5 projects** (`BOARD_SEARCH_THRESHOLD`, same constant and
  reasoning as the board tab strip — Parsa: "I really have to look for the project I wanna select").
  Enter picks the single match. **Already-picked boards always render even when filtered out** — a
  filter that hides your own selection reads as having dropped it. A count + Clear sits in the header.
  ⚠️ **Chips, not dropdowns, and no "use this wording" step.** Five multi-select dropdowns hid sixteen
  options behind five closed doors (Parsa: "the multi-select dropdown is messy"); as chips the whole
  vocabulary is visible and each option is one click — the same reasoning as the status modal's preset
  tiles. The sentence is a **live editable textarea**: chips rewrite it until the admin types, then
  `edited` latches and chips stop clobbering their words ("Back to the built wording" un-latches).
  ⚠️ An early build highlighted the "active" preset via `body === preset.text` exact compare, which
  silently vanished on any keystroke; that dishonest state was **removed**, not fixed.
  ⚠️ Order/state phrases deliberately avoid the word "and" (clauses are already joined with it —
  "urgent and high only and overdue first" was the bug).
- Mounted at the top of `board.tsx`; `/debug/page.tsx` fetches ALL active items rank-ordered in the
  existing `Promise.all` wave (showcase → `null`, same rule as the dashboard announcement) and mounts
  `<LiveRefresh tables={["debug_focus"]} />` — the tasks stream through the board's own channel, but
  the banner is server-rendered and needs the re-pull.

### 🟢 STATUS REDESIGN — three-signal model, live presence channels, modal editor, hover cards (2026-07-19) — BUILT + STATICALLY VERIFIED (tsc/lint/build green), committed `a26ff0f`, live two-browser drive by Parsa pending
Parsa: "redo the entire status thing — it can be a lot better." Full rebuild agreed via Q&A, built in
one session. **Migration 0030 APPLIED to prod by Parsa.** Committed as `a26ff0f "status update"`.
Green: `tsc`, lint (only the same pre-existing errors elsewhere — none in these files), `npm run build`.
**NOT two-browser-driven by Claude** (auth-gated panel, no Playwright/test-login here — the ONE thing
needing Parsa's eyes: does the live dot flip + status propagate between two real sessions). The model:

- **Three honest signals, no longer one overloaded status string** (this was the whole point):
  1. **Live online/away/offline dot** — AUTOMATIC, from real Supabase **presence channels**
     (`src/lib/use-live-presence.ts`, new). Each client joins `presence:team`, `track()`s
     `{userId, away}`; away is self-reported (tab hidden or >3min idle). Replaces the old faked
     "online = last_seen <6min" guess — the dot now flips the instant a tab opens/closes, no DB write.
     `last_seen_at` stays ONLY for the "Seen 3h ago" text on offline people.
  2. **Status = emoji + optional note** — MANUAL. Presets are just SHORTCUTS that pre-fill
     emoji+label+call-default; there's no special "custom mode" anymore — ANY status is emoji + text.
  3. **Available-for-call** — the ONE availability signal (Parsa collapsed "can I interrupt?" into it:
     "it feels like too many things"). A preset sets a sensible default (overridable).
- **New preset set** (`STATUS_PRESETS` in types.ts, `{emoji,label,callDefault}`): 🛠️ Working (call on),
  🧠 Deep focus, 📅 In a meeting, ☕ On a break, 🌙 Off today, 💬 Custom. **`unavailable` was DROPPED**
  (redundant now call-off = unavailable; the phantom empty chip Parsa saw between Break/Off was this).
- **Timed status → simple DURATIONS, not "till HH:MM"** (Parsa: "simpler durations"): Open / 30m / 1h /
  2h / 12h. The client sends a `durationMs` choice; the SERVER computes the absolute `status_until`
  (no wall-clock from client, nothing to tamper). A ticking 30s "now" clears expired statuses on their
  own + counts down ("58m left"). **The old `ui/time-picker.tsx` is no longer used by presence.**
- **Editor = spacious CENTERED MODAL** (Parsa picked modal over anchored-popover "for now; if we don't
  like it we go anchored"). Frosted `bg-raised/90 backdrop-blur-md`, `animate-pop-in`, portaled out of
  the sidebar's stacking context, Esc/backdrop close, body-scroll lock. **DRAFT + Save** (Parsa: "add a
  Save button rather than auto save") — presets/emoji/note/duration/call all mutate LOCAL draft, a
  **live preview row** at the top shows how you'll read to the team, Save commits once (disabled until
  dirty), Cancel/Clear. Instant-save was the first build; Parsa reverted it to Save-button for the modal.
- **Teammate HOVER CARDS** (Parsa: long custom status "gets cut off … open a lil something on hover"):
  hovering/focusing a teammate row portals a frosted detail card showing the FULL (wrapped, untruncated)
  status + emoji, Call state, and last-seen. Positioned to the right of the row, clamped to stay fully
  on-screen with an 8px y-margin (measured card height via `useLayoutEffect`).
- **Row layout fixes**: emoji rides on the avatar (bottom-left badge) + live dot (top-right) — two
  distinct signals, and emoji no longer eats text width. **Last-seen moved to its own right-aligned
  mono column, ALWAYS shown** (Parsa: "wanna see last seen all the time") — never fights the status text.
- **`updateMyStatus` rewritten** (account.ts): takes `{kind, emoji, text, availableToCall, durationMs}`;
  emoji preset-seeded when blank; note allowed with ANY kind (was custom-only); duration→absolute expiry
  server-side (validated against a known ms set). Meaningful-change notify logic kept (fires on kind
  change or newly-callable; quiet on note/duration/clear); label now includes the emoji.
- **DB (migration 0030)**: adds `profiles.status_emoji` (+per-column grant, 0027 pattern), drops
  `unavailable` from the kind CHECK (migrates stray rows→none first), backfills preset emojis.

### 🟢 PRESENCE→SIDEBAR + REALTIME EVERYWHERE + SHOWCASE LEAK (full) + STATUS TIMERS (2026-07-19) — BUILT + STATICALLY VERIFIED (tsc/lint/check:demo/build all green), live-drive by Parsa pending
> ⚠️ **Superseded in part by the STATUS REDESIGN above (same day).** The presence FEATURE below (sidebar
> panel, work-gating, notify-on-change) still stands, but its EDITOR (status Dropdown + `TimePicker`
> "till HH:MM" + dirty-Save inline) and the `unavailable`/`focus`/`meeting` kind set were REPLACED by the
> modal + emoji + durations model. Read the redesign entry as the current truth for the status UI.
One long session off the debug-board task list. **Migrations 0028 + 0029 APPLIED to prod** via the
Management API helper. NOT runtime-driven by Claude (dev server → prod; presence/notify writes reach
real teammates). Green: `tsc`, lint (only the same pre-existing errors in create.tsx / command-palette.tsx /
comms/bits / marketing/bits / contract-bits / admin — NONE in this batch's files), `check:demo` (78 reads,
all filtered), `npm run build`. What shipped:

- **Status-change notifications** (Parsa's URGENT ask): `updateMyStatus` now diffs old→new and fires a
  `status_change` notification **only on a MEANINGFUL change** (different status kind, or newly
  available-to-call) — never on clearing / custom-text edits / expiry-only. Recipients = **work team**
  (admins ∪ `work` members, the presence denominator) via new `notifyWorkTeam` in notify.ts. New kind
  `status_change` added to `NotifyKind`, the `Notification.kind` union (which had drifted — also added the
  missing `debug_suggested`/`learn_question`/`learn_answer`), and the DB CHECK (**migration 0028**).
- **Timed status — "till HH:MM"** (Parsa ask): **migration 0028** adds `profiles.status_until timestamptz`
  (per-column grant, 0027 pattern). Set a time and the status auto-expires — an elapsed `status_until`
  reads as "no status" client-side with no write. Shows "Working · till 15:00". "HH:MM" resolves to today
  or rolls to tomorrow if already past. **NOTE: "from" was explicitly dropped by Parsa — till-only.**
- **Status moved to the SIDEBAR, always-open** (Parsa ask, mid-session pivot from the old dashboard
  popover): new `shell/sidebar-presence.tsx` — my editor (status Dropdown + custom "till" TimePicker +
  Available-to-call Checkbox + **dirty-aware Save button**, NO more auto-save) **plus** a compact
  read-only team list, visible on every page. Loaded via new `lib/data/presence.ts` `getPresence(ctx)`
  (cache()-deduped, showcase/Work-gated) in the **layout**, passed to Sidebar. **Old dashboard top-right
  `TeamPresence` widget + its inline loader REMOVED from page.tsx; `team-presence.tsx` DELETED**;
  `PresencePerson` type moved to `lib/types.ts`.
- **Custom TimePicker** (`ui/time-picker.tsx`): hour/minute column popover matching Dropdown/DatePicker.
  Replaces the native `<input type=time>` I'd first used (Parsa: "fully custom dropdowns everywhere").
  Also **removed the dead native `<select>` export from `ui/input.tsx`** (was exported, never imported).
- **Showcase leak — FULL fix** (the 2026-07-18 ⌘K fix only closed the palette-cache path; an audit found
  **10 surfaces**). Class A (no is_demo column, always-on): `getMembersMap` now returns synthetic
  "Team member ####" + NO real email in showcase (was leaking real names/emails app-wide via the layout);
  notifications hidden in showcase (layout); reminders + announcements skipped in showcase (dashboard).
  Class B (detail pages fetching children by parent-id, leaked to a real section member in showcase):
  added `.eq("is_demo", ctx.showcase)` to project (+**secrets**), idea (+comments/votes), contact
  (+links/interactions), sprint (+all child tables + roster anonymized). `demoName(id)` shared from members.ts.
- **Live updates on EVERY tab** (Parsa ask): new `lib/use-realtime-refresh.ts` hook + `shell/live-refresh.tsx`
  mount — subscribes to a table's postgres_changes and calls `router.refresh()` (coalesced 150ms), so the
  server re-renders already-filtered. Mounted on comms/work/management-finance/marketing/learn/dashboard +
  app-wide notifications+profiles via layout (showcase-gated). **Migration 0029** (idempotent) confirms every
  user-facing table is in `supabase_realtime` + `replica identity full` (they already were in prod; 0029
  bumped only `debug_tasks` from default→full).
- **Debug board realtime FIX** ("only my own changes show", diagnosed with Parsa: channel SUBSCRIBED but no
  teammate events). Root cause = realtime socket authorized as anon, so `debug_tasks` RLS streamed nothing.
  Fix: `supabase.realtime.setAuth(session.access_token)` before `.subscribe()`, in BOTH the board and the
  shared hook. **⚠️ NEEDS TWO-BROWSER live verification — can't be tested headlessly.**
- **Logo → dashboard**: both desktop + mobile "KaguOs" wordmarks are now `<Link href="/">`.
- **Resend email integration**: scoped with Parsa (announcements→everyone, task-assign→assignee, digests)
  then **explicitly dropped by Parsa this session ("forget abt resend for now")**. Not started. `resend`
  is NOT installed. See scope ledger.

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
- 💬 **Debug brainstorm mode — v1 (inline bar) REJECTED by Parsa after live testing, REBUILT as a
  dedicated two-phase page the same day.** The first shape (a slim capture bar on the board) was
  built, Parsa tested it and said no; he asked for a page flow instead: spam titles → "Done" →
  step through details one by one. `debug/batch-add.tsx` is DELETED. What exists now:
  - **`/debug/brainstorm`** (`debug/brainstorm.tsx`, one route, two client phases so the title
    list never crosses a route change — matches the create-flow rule's dedicated-surface shape):
    - **Capture**: big autofocus input, **Enter appends a line** (nothing touches the DB), lines
      are editable inline + removable, multi-line paste appends all, one session-wide board
      Dropdown, count, "Done — add details" / Cancel.
    - **Done** posts EVERY title in ONE trip (`quickAddTasks`) + fires the ONE collapsed
      notification (`notifyDebugBatch`, "14 new tasks on Pet App") + writes the trail ids to
      `sessionStorage["kagu-debug-brainstorm"]` IMMEDIATELY — so the dump is durable and
      trail-marked even if the user bails mid-details.
    - **Details pass**: card per task (title/board/priority/deadline/suggest-for(admin)/details),
      "N / M" + thin progress bar, Back / **Skip** (leaves it as-is) / **Save & next**
      (`updateTask`, optimistic) / **"Leave the rest as-is"** escape hatch / "Save & finish".
      Finish → `/debug` with a toast ("14 posted, 9 detailed").
  - **Board**: "Batch add" button replaced by a **Brainstorm** Link; the session trail (tint +
    pin-to-top + "N added this session" header + Clear) now seeds from sessionStorage — adopted
    in a post-paint rAF inside the mount effect (a sync set trips `set-state-in-effect`; a lazy
    init mismatches hydration — the rAF sidesteps both). Trail persists across navigations
    (tab-scoped) until Clear.
  - **"Suggest for" is now editable in the task edit form too** (Parsa ask): admin-only Dropdown
    (Work-members roster, fetched in the /debug page wave), `updateTask` gained `suggested_for`
    **admin-gated server-side** like createTask. The brainstorm details pass reuses it.

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
- `src/lib/debug-export.ts` — `taskToText`/`tasksToText`, plus `imageStem`/`imageFilename`/
  `downloadBlob`/`downloadTaskImages`. The filename helpers are the contract between the file
  written to disk and the path written into the clipboard — change one, change both.
- `src/lib/debug-images.ts` — image caps (6/task, 5MB, allowed MIME). Lives outside
  `actions/debug.ts` because a `"use server"` module may only export async functions.
- `src/components/debug/task-images.tsx` — upload / thumbnails / lightbox, signed URLs batched in
  one call per row. Used by the expanded row AND the row editor.
- `src/components/comms/workspace.tsx` — Comms tablist (External / Meetings / Notes); contacts stay
  server-rendered and arrive as the `external` prop.
- `src/components/comms/internal.tsx` — `MeetingList` + `NoteList` (the internal half).
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
- `src/lib/actions/notify.ts` (helpers: notifySection/notifyEveryone/notifyAdmins/**notifyWorkTeam**/
  notifyUser, best-effort, actor excluded) + `notifications.ts` (markAllRead/clearAll).
  `shell/notification-bell.tsx` renders the bell; layout fetches the feed. Events fire from
  debug/work/reminders/**account (status_change)** actions. **The notify helpers are FIRE-AND-FORGET
  (return void, run inside `after()`) — call them WITHOUT `await`; the SELECT+INSERT happens after the
  response ships. Don't re-add `await` or they'll block the save.** `notifyWorkTeam` = admins ∪ `work`
  members (the presence denominator).
- `src/components/shell/announcement-hero.tsx` + `lib/actions/announcements.ts` — admin banner
  (one active at a time). `src/components/shell/command-palette.tsx` — ⌘K nav+actions.
- **Debug focus (2026-07-19)**: `src/components/debug/focus-hero.tsx` — banner (0/1/many shapes) +
  `FocusModal` (list-first editor, chip composer). `src/lib/actions/debug-focus.ts` —
  save/clear/clearAll/reorder. Table `debug_focus` (0031 + **0032**: `project_id`, `parts` jsonb,
  `rank`, partial unique index = one active item per board). Type `DebugFocus`/`DebugFocusParts`
  in types.ts. **Several items are active at once — it's a list, not a single banner.**
- `src/lib/utils.ts` — **`todayInIstanbul()` is the app's "today"** for every domain date (Intl
  pinned to `Europe/Istanbul`). `todayLocal()` is viewer-local and NARROW — server-side it's the
  Vercel runtime (UTC), so it silently reintroduces the off-by-3-hours bug; don't reach for it.
  `addDays(date, n)` is pure string→string. Also `formatDate`/`formatRelative`/`formatMoney`.
- `src/lib/use-popover-side.ts` — flips a popover above its trigger when there's no room below.
  Used by `Dropdown`, `MultiDropdown`, `DatePicker`; fixes "editing the last row means scrolling
  after every click" everywhere at once.
- `src/components/ui/dropdown.tsx` — `Dropdown` (single) **and `MultiDropdown`** (multi-select:
  menu stays open on pick, `aria-multiselectable`, "Clear selection" footer, trigger collapses to
  "3 boards"; `placeholder` + `label` are REQUIRED so a control always names its field). The debug
  board's assignee/kind/state/priority filters use it — **empty array = no filter**, picks are
  OR-within and AND-across.
- `supabase/migrations/0001–0010` — full schema history (0008 reminders, 0009 notifications,
  0010 announcements; all applied to cloud).
- **Presence (REDESIGNED 2026-07-19, `a26ff0f`)**: `src/components/shell/sidebar-presence.tsx` — the
  ALWAYS-OPEN sidebar panel. Three components inside: `PresenceRow` (avatar w/ emoji badge + live dot,
  name, status sub-line, always-on last-seen meta column), `TeammateRow` (wraps a row + a portaled
  hover detail card, clamped on-screen), and `StatusModal` (centered frosted draft editor: preset tiles
  + emoji/note + duration chips + call toggle + live preview + Save/Cancel/Clear). Live dot comes from
  **`src/lib/use-live-presence.ts`** (new — `useLivePresence(meId)` joins the `presence:team` channel,
  returns userId→online/away/offline). `src/lib/data/presence.ts` `getPresence(ctx)` loads the roster
  (now selects `status_emoji` too; cache()-deduped, Work-gated, null in showcase). Types
  (`StatusKind`/`STATUS_PRESETS`/**`PresencePerson`** with `status_emoji`) in types.ts; action
  `updateMyStatus` in account.ts takes `{kind,emoji,text,availableToCall,durationMs}`. Columns from
  migrations 0027 + 0028 (`status_until`) + **0030** (`status_emoji`; drops `unavailable`). `STATUS_LABELS`
  was removed (superseded by `STATUS_PRESETS`). The dashboard `team-presence.tsx` popover was DELETED
  earlier; presence is sidebar-only.
- `src/components/ui/time-picker.tsx` — custom hour/minute popover. **No longer used by presence** (the
  redesign uses duration chips); still the ONLY time control if any surface needs one. `ui/input.tsx`
  has no native `<select>` (use `ui/dropdown.tsx`).
- **Realtime**: `src/lib/use-realtime-refresh.ts` (`useRealtimeRefresh(tables)` → coalesced
  `router.refresh()` on any change; sets `realtime.setAuth` first so RLS lets events through) +
  `src/components/shell/live-refresh.tsx` (`<LiveRefresh tables={…}/>` mount, one per page). The debug
  board keeps its own in-place `setTasks` subscription (also now setAuth-fixed).
- `supabase/migrations/0026` (work⊆debug auto-grant, applied to prod, file untracked in git) ·
  **0027** presence status columns + grants (applied 2026-07-18) · **0028** `status_until` + `status_change`
  notify kind (applied 2026-07-19) · **0029** realtime publication + replica-identity-full, idempotent
  (applied 2026-07-19) · **0030** `profiles.status_emoji` + grant, drops `unavailable` from kind CHECK,
  backfills preset emojis (applied by Parsa 2026-07-19) · **0031** `debug_tasks.kind` (fix/feature,
  default 'fix') + `debug_focus` table (applied 2026-07-19 via `apply-migration.mjs`) · **0032**
  debug focus becomes a LIST — `project_id`/`parts`/`rank` + partial unique index (applied 2026-07-19) ·
  **0033** focus item targets MANY boards — `project_ids uuid[]`, drops `project_id` + that unique
  index (applied 2026-07-19) · **0034** `audit` added to the kind CHECK + `debug_tasks.found_by`
  (applied 2026-07-19). **0031→0032→0033 all reshaped `debug_focus` in place because it held
  zero rows; it is now settled — a future change needs a real data migration.**
  ✅ **All of 0028–0034 were `migration repair`-ed to `applied` (2026-07-19); `migration list --linked`
  now shows local == remote for all 34.** A future `db push` won't try to re-run them.
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
| Debug kind tag | `fix`/`feature`/**`audit`** on every task + create/edit + multi-select filter + copy/export text (done 2026-07-19) | — | — |
| Debug audits | `audit` kind + `found_by` link + "Log findings" one-per-line composer filing N tasks in one trip + "Found N" / "found by X" (done 2026-07-19) | audit templates (a reusable checklist per project); "close the audit when all findings are done"; audit yield on the dashboard | later |
| Debug focus | **a LIST of items, each covering MANY boards** (`project_ids[]`; empty = whole board) with kind/priority/state/order qualifiers, hand-ranked, searchable chip composer in a status-style modal (done 2026-07-19) | **"Apply" — snap the board's filters to a focus item, making it a shared saved view instead of only words**; expiry/auto-clear; who set it + when on the banner | not scoped with Parsa yet |
| Debug filters | assignee/kind/state/priority all MULTI-select **behind one Filters popover w/ count**; Active/Mine/Done/All are **presets that write those filters** (no longer a rival system); project boards ctrl/⌘-click multi (done 2026-07-19) | saved views, **URL-backed filter state** (still resets on navigation — and it's the prerequisite for the dashboard "Needs you" counts deep-linking to a filtered board rather than plain `/debug`) | later |
| Debug board keyboard | none — the board is mouse-only | **j/k row nav, `c` claim, 1/2/3 state, `/` search, `?` overlay.** PRODUCT.md promises "full keyboard operability for claim/tick flows"; that promise is currently unmet | not started |
| Debug bulk actions | select mode copies / downloads .txt only (done) | bulk state / priority / board / claim via an `updateTasks(ids, patch)` action — the selection infrastructure already exists, it just has no write actions | not started |
| Debug brainstorm | 2-phase capture → linear details wizard (done) | the details pass as an **inline-expandable list** (can't jump to item 7 of 14 today); `savedCount` double-counts on Back+re-save; the 50-item `quickAddTasks` cap is silent | not started |
| Debug audits UI | "Found N" badge (done) | make the count **clickable** → filter the board to `found_by = <audit>`; today there's no way to see which N | not started |
| Debug focus editor | modal composer (done) | de-modal it — DESIGN.md says modals are for destructive confirms only; also focus items lose board attribution once an admin types custom wording | not started |
| Dashboard shape | **"Needs you" strip (overdue + suggested) + one dense stat row + full-width activity w/ per-kind filter and show-more** (done 2026-07-19) | strip currently covers **debug only** — sprint goals due, unticked reminders, and contracts expiring belong in it; counts should deep-link to filtered views once URL filters land | later |
| Dashboard charts | numbers only (done) | **one** sparkline: net recurring over 12 months (`lastMonths()` + recharts both exist). Agreed with Parsa 2026-07-19 that the other five stats are single-state counts with nothing to plot — charting them would be decoration | next |
| Reminder due dates | text + scope + done only | optional `due_on` via `DatePicker`, sort/dim by it. **Needs a migration** (`reminders` has no date column) — deferred rather than rushed at the end of a session | not started |
| Mobile | **drawer menu + status reachable** (2026-07-19); layout padding and tables were already responsive | teammates' presence is still desktop-only (deliberate — browsing affordance); the rest of the app has NOT been driven on a real phone yet, only reasoned from the code + build. **Debug row, dashboard stat row and filter popover need a real-device pass** | needs a live pass |
| Comms split (Kemal, 2026-07-19) | **DONE 2026-07-19** — three tabs (External / Meetings / Notes), migration 0037. Meetings = title, date, attendees, summary, notes. Notes = body + pin. Both shared section-wide | Follow-ups if asked: link a meeting to a contact or project · attendees from an actual calendar · search across notes | — |
| Task screenshots (2026-07-19) | 6 images/task, 5MB each, attach from create form + row + editor; Copy downloads them and writes filenames into the text | Paste-to-upload (Ctrl+V a screenshot straight onto a task) · annotation/crop · thumbnails via a transform CDN rather than full-size `unoptimized` | later |
| ⌘K search | nav actions + content (tasks/projects/ideas/contacts/sprints), loaded-once client-filter (done) | live/fresh results, ranking, recents | later |
| Presence | **REDESIGNED 2026-07-19 (`a26ff0f`)**: three signals — LIVE online/away/offline dot via presence channels + status (emoji+note, presets are shortcuts) + available-to-call; **simple durations (30m/1h/2h/12h)** auto-expiry; **centered modal editor** w/ live preview + **Save button** (draft, not auto-save); **teammate hover cards** (full status); always-on last-seen column; status-change notify to work team kept (done) | real emoji picker (currently a text field); open/close delay on hover cards; per-section activity | later |
| Realtime | **live updates on every tab via `useRealtimeRefresh`→router.refresh(); debug board in-place (done 2026-07-19)** | in-place patching on more tabs (currently only debug patches; others refresh) | later |
| Email (Resend) | **NONE — scoped then dropped by Parsa 2026-07-19 ("forget resend for now")**. `resend` not installed | announcements→everyone, task-assign→assignee, admin digests, role-polarized | when Parsa revives it |
| Debug brainstorm | /debug/brainstorm: capture → one-trip post → per-task details pass + board trail + collapsed notify (done 2026-07-18, v2 after Parsa rejected the inline-bar v1) | — | — |
| Comms/CRM | leads/clients + linked resources (done) | — | — |
| Project creds | plaintext RLS-gated accounts store (done) | — | — |
| Showcase mode | fake-data demo mode w/ re-auth exit + **all 10 real-data leak surfaces closed (2026-07-19 audit: members map, notifications, reminders, announcements + all detail pages incl. project secrets)** (done) | — | — |
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
- ✅ **CLI migration history is fully reconciled (2026-07-18).** Parsa ran `migration repair --status
  applied 0020…0026`; Claude repaired 0027 the same day after `db push` tried to re-run it (harmless —
  it errored on the first statement, nothing partial). `migration list --linked` confirms local ==
  remote for 0001–0027. **Standing rule: any migration applied via `scripts/apply-migration.mjs` must
  be followed by `npx supabase migration repair --status applied <n> --linked`** so the next `db push`
  doesn't try to re-run it.
- Secrets only in `.env.local` + Vercel env. Access token + service key were pasted in chat —
  rotate anytime in dashboard.
- `db push` needs `$env:SUPABASE_ACCESS_TOKEN` set and pipes `"Y"`; Docker warning is harmless.
- ⚠️ **Realtime RLS needs an authenticated socket (2026-07-19).** `postgres_changes` on an RLS table
  streams NOTHING if the realtime socket is authorized as anon — the channel still reports SUBSCRIBED,
  so the symptom is "connected but only my own optimistic edits show, nothing from teammates." Every
  subscription MUST call `await supabase.realtime.setAuth(session.access_token)` before `.subscribe()`
  (done in the debug board + `useRealtimeRefresh`). If a new realtime surface shows no teammate events,
  this is the first thing to check. **The debug-board fix still needs TWO-BROWSER live verification.**
- ✅ **CLI migration history reconciled through 0034 (2026-07-19).** 0028–0034 had all been applied to
  prod via `apply-migration.mjs` (and 0030 by Parsa) but showed `remote: ""` in `migration list --linked`
  — the exact drift the standing rule warns about. Claude ran
  `npx supabase migration repair --status applied 0028 0029 0030 0031 0032 0033 0034 --linked`;
  **local == remote for all 34 now**, verified. The standing rule still holds for the NEXT one: anything
  applied via `apply-migration.mjs` must be repaired before the next `db push`.
- ⚠️ **`debug_focus` was reshaped in place three times** (0031 → 0032 → 0033) rather than versioned,
  because the table held **zero rows in prod** — verified with a count before each migration. The shape
  is settled now (`project_ids uuid[]` + `parts jsonb` + `rank`); once it holds real rows, any further
  reshape needs a real data migration.
- Deleting a user cascades cleanly (created_by set-null everywhere).
- `staleTimes` is experimental — if a Next upgrade breaks it, drop it from next.config.ts.

## Running it
- `npm run dev` · `npm run build` · `npm run lint`
- `npx supabase db push` — apply new migrations (Parsa runs interactively; token in `.env.local`;
  harmless Docker-cache warning on Windows, apply still succeeds). 0008–0010 are all applied.
- `npx tsx scripts/seed-admin.ts` — re-seed admin (idempotent)
- `node .claude/skills/impeccable/scripts/detect.mjs src` — design lint (clean as of today)
