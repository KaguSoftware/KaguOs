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
  `debug_tasks`. Project ref `ibbfptujwtbfwdefllgz`. Migrations 0001–0007 all APPLIED to cloud.
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

## Current status (2026-07-16)
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
- Migrations 0008 (reminders) / 0009 (notifications) / 0010 (announcements) all **pushed to cloud
  & live**. Note: `supabase db push` prints a harmless Docker-cache warning on this Windows box —
  the remote apply still succeeds ("Finished supabase db push").
- ⚠️ SANDBOX NOTE: the agent's auto-confirm of `db push` is blocked (guardrail on prod schema
  changes); Parsa runs `npx supabase db push` interactively. Future migrations need the same.
- NOT DONE: disabling public signups in the Supabase dashboard; formal E2E with RLS negative checks
  (deferred — you've 2-browser tested); the remaining queue below.

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
  bell; layout fetches the feed. Events fire from debug/work/reminders actions.
- `src/components/shell/announcement-hero.tsx` + `lib/actions/announcements.ts` — admin banner
  (one active at a time). `src/components/shell/command-palette.tsx` — ⌘K nav+actions.
- `supabase/migrations/0001–0010` — full schema history (0008 reminders, 0009 notifications,
  0010 announcements; all applied to cloud).
- `scripts/seed-admin.ts` — idempotent first-admin seed.

## Roadmap / next steps
DONE this session: notifications, announcements hero, ⌘K palette, task/idea editing, admin-row
redesign, empty-state CTAs (a–c, f from the old list). REMAINING:
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
