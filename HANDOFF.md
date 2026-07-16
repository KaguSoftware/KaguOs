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
- ⚠️ PENDING MANUAL STEP: **migration 0008 (reminders table) is written + committed but NOT pushed
  to cloud.** The reminders widget will error until you run `supabase db push` (see Running it). It's
  additive (new table + RLS), safe. The auto-confirm push was blocked by the sandbox — push it
  interactively so you review the diff.
- NOT DONE: disabling public signups in the Supabase dashboard; formal E2E with RLS negative checks
  (deferred — you've 2-browser tested); the feature queue below.

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
- `supabase/migrations/0001–0008` — full schema history (0008 = reminders, **cloud-push pending**).
- `scripts/seed-admin.ts` — idempotent first-admin seed.

## Roadmap / next steps
0. ➡️ **ACTIVE — DO FIRST: push migration 0008** (`supabase db push`) so reminders have a table.
1. Disable "Allow new users to sign up" in Supabase dashboard (Auth → Sign In / Up).
2. Big feature batch Parsa green-lit (2026-07-16), in-progress order:
   a. In-app notification center (bell + unread feed, driven by activity data). *(next up)*
   b. Search / command palette (⌘K).
   c. Editing flows for tasks / ideas / projects (title/desc are currently fixed after post).
   d. **Communications / CRM section** — leads + clients, status, links to everything tied to them.
   e. **Project credentials store** — per-project accounts (Supabase email/password etc).
      DECISION: plaintext, RLS-gated to management/admins, masked with reveal-on-click. ⚠️ A DB leak
      exposes these — a real secrets manager is the safer long-term move; revisit.
   f. Empty / first-run states across sections. g. Finance exports + budgets + per-client P&L.
3. Onboard the team (create the other 7 accounts), import the old sheet, retire it.

Cross-cutting: keep weaving the perf pass and the `useAction`/toast HCI pattern into every new
surface; run `/impeccable audit` after the batch (design hook was silenced after 6 edits/file).

## Deliberately partial — grows later (scope ledger)
| Area | What shipped now | Intended full shape | Grows in |
|---|---|---|---|
| Notifications | none yet | in-app center now (Telegram later) | in progress (2a) |
| Reminders | personal + team, DB-backed | (done) — migration 0008 needs cloud push | — |
| Comms/CRM | none | leads/clients + linked resources | in progress (2d) |
| Project creds | none | plaintext RLS-gated accounts store | in progress (2e) |
| Invites | admin sets temp password | email invites via SMTP | when SMTP exists |
| Roles | membership + global admin | per-section roles (Learn owner) | when needed |
| Finance reports | 12-mo chart + tiles + recurring breakdown | exports, budgets, per-client P&L | in progress (2g) |
| Marketing | campaigns/content/links CRUD | analytics pulls, approval flows | next phase |
| Task editing | title/desc fixed after post (state/claim/delete only) | edit page | in progress (2c) |
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
- `$env:SUPABASE_ACCESS_TOKEN='<token>'; "Y" | npx supabase db push` — apply new migrations
  (⚠️ 0008 reminders is pending this). `npx supabase migration list` shows local-vs-remote drift.
- `npx tsx scripts/seed-admin.ts` — re-seed admin (idempotent)
- `node .claude/skills/impeccable/scripts/detect.mjs src` — design lint (clean as of today)
