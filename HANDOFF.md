# KaguOs — Handoff

> Read this first when starting a fresh chat. Companion: the approved plan at
> `C:\Users\p.mansouri\.claude\plans\we-are-kagu-this-precious-teacup.md` (full schema/RLS detail).

## Working style
- **Git authorship — ABSOLUTE RULE**: Parsa is the SOLE author of every commit. NEVER add Claude as
  co-author (`Co-Authored-By` trailers are banned), never mention Claude/AI in commit messages or PR
  bodies. Parsa deleted and recreated the GitHub repo on 2026-07-16 to purge one such trailer —
  do not make that mistake again.
- **Collaborate**: agree with Parsa before locking significant/user-facing decisions; propose with a
  recommendation, don't unilaterally commit. Decisions below were agreed on 2026-07-16.
- **Plan mode** for direction-setting work; owner approves before build.
- **No subagents/orchestration** for this project unless Parsa asks — he prefers direct work.
- **Make partial scope OBVIOUS**: deliberately-small areas live in the scope ledger below, carry a
  `// SCOPE(mvp): … GROWS LATER → …` code tag, and show a "coming soon" affordance in-app.
- **Keep this file and the memory index in lockstep** (memory dir: Claude's project memory).

## What this is
KaguOs — the internal system of Kagu (kagusoftware.com, Istanbul software studio, **8 people
total**). One login, five membership-gated sections: **Work** (4 ppl: projects + ideas),
**Learn** (all 8: learning sprints with per-person progress), **Management** (2 ppl:
multi-currency ledger + contracts w/ PDFs), **Debug** (everyone: claim-a-task board replacing a
Google Sheet), **Marketing** (shell for now). Global admins manage users/memberships from an
admin panel. **Rule: everyone in Work is ALWAYS also in Learn** (enforced by DB trigger —
granting work auto-grants learn; learn can't be removed while work is held).

## Stack & environment
- Next.js 16.2.10 (App Router, TS, Turbopack), React 19.2, Tailwind v4, lucide-react.
- Supabase: Auth (invite-only email+password, public signups DISABLED in dashboard),
  Postgres w/ RLS, private Storage bucket `contracts`, Realtime on `debug_tasks`.
- Vercel deploy. GitHub: `KaguSoftware/KaguOs` (main).
- Dev machine: Windows 11 + PowerShell. Supabase CLI as dev dep (no Docker; `db push` to cloud).
- Env vars (values in `.env.local`, NEVER committed): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- UI quality: Impeccable skill pack installed project-level (`.claude/skills/impeccable`).

## Conventions
- Access model: `profiles.is_admin` + `section_memberships(user_id, section)`; ALL enforcement via
  RLS using `private.is_admin()` / `private.is_member(section)` (SECURITY DEFINER helpers).
- Text + CHECK constraints instead of Postgres enums (easier migrations).
- Server actions re-check auth server-side every time; service-role client only in
  `src/lib/supabase/service.ts`, used only after an explicit admin check.
- Next 16: `proxy.ts` (not middleware.ts); `cookies()`/`params`/`searchParams` are async.
- Debug board rule: anyone can change state; you can only claim a task for YOURSELF
  (`assignee_id IS NULL OR = auth.uid() OR admin`) — mirrors the old sheet culture.
- Sprint create/edit: admin-only for MVP. Package name is `kaguos` (folder `kaguOs` broke npm naming).

## Current status (2026-07-16)
- DONE: scaffold (create-next-app), Impeccable installed (project-level), deps installed,
  repo pushed to GitHub main.
- IN PROGRESS: Supabase wiring (env, clients, proxy).
- NOT STARTED: schema/RLS migration, seed, auth shell, admin panel, dashboard, five sections,
  CSV import, deploy. Nothing is verified yet.

## File map (key files)
- `HANDOFF.md` — this file.
- `src/app/(auth)/login/` + `src/app/(app)/…` — public login vs protected app (per plan).
- `src/lib/supabase/{client,server,service}.ts` — browser / SSR / service-role Supabase clients.
- `src/lib/actions/*.ts`, `src/lib/data/*.ts` — server actions & queries per section.
- `proxy.ts` — session refresh (Next 16 middleware replacement).
- `supabase/migrations/0001_init.sql` — full schema + RLS + bucket + realtime (source of truth).
- `scripts/seed-admin.ts` — creates first admin (parsaa.mansourii@gmail.com) via service role.

## Roadmap / next steps
1. ✅ Scaffold + Impeccable + git push
2. ➡️ **ACTIVE: Supabase wiring (.env.local, 3 clients, proxy.ts)**
3. Migration 0001 (schema+RLS+bucket+realtime) applied to cloud
4. Seed admin; disable public signups (dashboard)
5. Auth shell (login, protected layout, membership-aware sidebar, account page)
6. Admin panel (users, memberships, is_admin)
7. Dashboard cards → 8. Debug board (claim + realtime) → 9. Work → 10. Learn → 11. Management
12. Marketing shell → 13. CSV import → 14. polish + build → 15. E2E verify (3 test users, RLS
negative tests) → 16. Vercel deploy + Supabase auth URLs → 17. sync this file.

## Deliberately partial — grows later (scope ledger)
| Area | What shipped now | Intended full shape | Grows in |
|---|---|---|---|
| Marketing | gated shell + shared links/notes | real marketing tooling (campaigns, calendar) | next phase |
| Notifications | none (realtime board only) | Telegram bot on task create/claim | fast follow |
| Invites | admin sets temp password | email invites via SMTP | when SMTP exists |
| Roles | binary membership + global admin | per-section roles (Learn owner plans sprints) | when needed |
| Mgmt reporting | month/client totals | charts, FX normalization, exports | when needed |
| i18n | English only | next-intl (TR) if wanted | if requested |

## Gotchas / open issues
- **Secrets**: service role key lives ONLY in `.env.local` + Vercel env. Never in repo/docs/memory.
  Owner can rotate it in Supabase dashboard anytime (it was pasted in chat once).
- Supabase project uses NEW api-key scheme (`sb_publishable_…`); service key is legacy JWT — both work.
- `npx impeccable install` is interactive — pipe answers (`"1`nproject"`) if re-running.
- Applying migrations needs owner auth: `npx supabase login` + `link` + `db push`, or paste SQL in
  dashboard SQL editor (file in repo stays source of truth).
- Manual dashboard steps: disable "Allow new users to sign up"; after deploy set Site URL/redirects.

## Running it
- `npm run dev` — local dev (http://localhost:3000)
- `npm run build` — prod build; `npm run lint` — eslint
- `npx supabase db push` — apply migrations to cloud (after `login`+`link`, owner-interactive)
- `npx tsx scripts/seed-admin.ts` — seed first admin (reads env)
