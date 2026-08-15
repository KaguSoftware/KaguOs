# Marketing — Execution Plan

> The build plan for the Marketing section. Companions: PRODUCT.md · DESIGN.md · HANDOFF.md.
> Status: **phases 0–2 built, not yet applied.** Phases 3–5 are unstarted by design — each is
> gated on data that only exists once the section is in real use (see the Phases table).
>
> Migrations `0062`–`0064` are written but **not pushed**. ⚠️ `0063` drops `marketing_posts` and
> `marketing_items`; confirm both are empty before `supabase db push` (the migration says how).
>
> Two machine-checked invariants now guard this work: `npm run check:demo` (showcase leaks, as
> before) and `npm run check:principals` (a client account appearing in any member listing).

## What this section actually is

Not a content calendar for Kagu's own brand. **A client-services delivery system** for an agency
arm: Kagu films video for paying clients, runs paid media against it, and reports results. That
reframing came out of the 2026-08-15 scoping interview and it changes every structural decision —
most importantly it puts a **non-Kagu person inside the app for the first time.**

Three facts drive the design:

1. **Client is the root object**, not campaign. Every row in this section belongs to a client.
2. **The unit of work is a video**, with a long production life (idea → shoot → edit → approve →
   live) and a client approval gate in the middle of it.
3. **Client users are a new kind of principal.** Every authenticated user in KaguOs to date is one
   of the 8. This is the highest-risk piece of the build and it goes first.

## The operation (scoping interview, 2026-08-15)

| Question | Answer |
|---|---|
| Who does the work | **3 people** sharing it — handoffs and approvals between them matter |
| For whom | **Client accounts** (agency model), not Kagu's own brand, not a Kagu product |
| Channels | **Instagram / TikTok / YouTube** + **paid ads** |
| Production | **Shot in-house by the team** |
| Paid tracking needed | **Per-creative testing** *and* **full funnel to lead/sale** |
| Engagement shape | Retainer *and* project *and* % of ad spend — **still deciding, first clients now** |
| Scale at launch | **1–2 pilot clients** |
| Ad money | **Client's own ad account** — their card is charged, we manage |
| Client approval | Required, and **wanted inside the panel** — real client accounts, limited role |
| Shoot logistics | **Fields on each video** (shoot date, footage link) — no separate shoot object |
| Ad data source | Not yet considered → see decision D3 |
| Progress shown to | **Kagu management.** Client-facing reporting is a *separate panel*, later |
| Timeline | **No hurry** — sequence it properly |

## Decisions

**D1 — Client users are real accounts with a limited role, not tokenized links.** Chosen over
magic links because the separate client reporting panel is already planned; building the principal
now means that panel grows into an existing seam instead of arriving as a second system. Cost is
paid up front in phase 0.

**D2 — Ad spend never touches the Management ledger.** Clients pay their own ad accounts, so spend
is a performance number only. **But the Kagu fee does touch it** — add one FK from
`contracts.client_id` to `clients` so invoicing isn't archaeology later. One column, large payoff.

**D3 — Ad numbers arrive by weekly CSV import, not the Marketing API.** At 1–2 clients with
per-creative granularity that's ~30–60 rows a week; the Meta/TikTok export is one click and
`papaparse` is already a dependency. An API integration costs OAuth maintenance and app review for
a two-client operation. Revisit at 5+ clients. ⚠️ The import must take **under two minutes** or it
won't happen weekly, and per-creative data that isn't entered weekly is worthless.

**D4 — Engagement model stays undecided, but its storage does not.** `clients.engagement_kind`
(`retainer` | `project` | `ad_fee`) + nullable `monthly_deliverables` holds all three answers.
Decide the business model after a month of real use; the schema doesn't move.

**D5 — The client portal at v1 does two things only:** what's waiting on you, and what's live. The
temptation is to build the reporting portal at the same time — that doubles the surface area with
zero effect on getting videos out the door. Reporting is a later phase and possibly a later panel.

**D6 — Shoot week is derived, never stored.** Per the interview, shoot data is fields on the video
(`shoot_date`, `footage_url`). The shoot-week view is a query over creatives with a shoot date in
the next 14 days, grouped by day. Full calendar value, no second object to keep in sync.

## Architecture: the client principal

This is the part that must be right before any UI exists.

**Today's model.** `profiles` + `section_memberships` → `private.is_member(s)` gates every SELECT,
`private.can_write(s)` gates every INSERT/UPDATE/DELETE (0053). `session_context()` returns profile
+ sections + access tier in one RPC; `getSessionContext()` in `src/lib/data/session.ts` wraps it.
Every policy in the database assumes an authenticated user is a Kagu person. A client account has
no section, so `canAccess` is false and `requireSection` redirects to `/` — the teammate dashboard.
**There is no seam for an outsider today.**

**What phase 0 adds.**

- `profiles.kind` — `'member' | 'client'`, default `'member'` so no existing row changes meaning.
- `clients` table and `client_users(user_id, client_id, role)` where role is `approver` | `viewer`.
- `private.client_id()` → the current user's client, null for members. `private.is_client()`.
- `client_id not null` on every table in this section.
- SELECT policies become `private.is_member('marketing') or client_id = private.client_id()`.
- **Client write access is exactly one table: `creative_reviews`.** Approve or request changes,
  nothing else, ever. A client must never satisfy `can_write('marketing')`.
- `session_context()` gains `kind` and `client_id`. ⚠️ **Additive only** — 0053 §6 explains why:
  the deployed bundle reads the existing keys during the deploy window, so reshaping one throws on
  every page load. Add keys, never change them.
- A `(client)` route group with its own layout — no Kagu sidebar, no chat, no presence — plus
  `requireClient()` mirroring `requireSection`. Signed-in clients redirect there, not to `/`.
- `is_client()` hard-blocks showcase mode. Showcase lets a member roam every section (`canAccess`);
  that arm must never be reachable by a client.

**The bug this will produce if unguarded:** a client leaking into member surfaces — the presence
sidebar, `@`-mentions, `getMembersMap`, notification recipients, the admin user list. Follow the
0053 house pattern and close the migration with a `DO` block asserting every member-listing path
filters `kind = 'member'`. Assert the invariant at migration time rather than trusting review.

**Membership for the humans** needs no new machinery: the 3 marketers get `marketing` at `write`,
Kagu management gets `marketing` at `read`. The 0053 read tier already covers it exactly.

## Data model

Migrations start at **0062** (0061 is the current head).

**`clients`** — name, status, currency, `engagement_kind`, `monthly_deliverables` (nullable),
`ad_account_owner` (`client` | `kagu`), brand notes, `is_demo`.

**`client_users`** — `user_id`, `client_id`, `role`. A client user belongs to exactly one client.

**`creatives`** — the core object; replaces `marketing_posts`.
`client_id`, `campaign_id`, `title`, `hook`, `script`, `owner_id` (producer), `editor_id`,
`shoot_date`, `footage_url`, `cut_url`, `channel`, `kind` (`organic` | `ad`), `publish_on`,
`published_url`, `status`, **`parent_creative_id`** (self-reference), `is_demo`.

The self-reference is what makes per-creative testing meaningful: one concept spawns three hook
variants as siblings, and the comparison is between variants of a concept rather than between
unrelated videos. Without it "which creative won" is a question about noise.

Status ladder — one-click advance, per PRODUCT.md's one-click primitives principle:

```
idea → scripted → shot → editing → internal_review → client_review → approved → scheduled → live
                              ↑                            │
                              └──── changes_requested ←─────┘
```

**`creative_reviews`** — `creative_id`, `reviewer_id`, `decision` (`approved` | `changes`),
`comment`, **`timecode`** (nullable seconds), `created_at`. Append-only; never overwritten. The
history *is* the documentation of why a cut changed. The timecode field is what makes clients
actually use a review tool — "the hook at 0:14 is weak" instead of "the second bit is off".

**`ad_results`** — `creative_id`, `date`, `platform`, `spend`, `impressions`, `clicks`, `leads`.
Per-creative granularity per the interview. Populated by CSV import (D3).

**`tracked_links`** — the UTM registry: `client_id`, `campaign_id`, `creative_id`, generated URL
with fixed dropdowns for source/medium/campaign so naming stays consistent. Without this the
`ad_results` → `leads` join is guesswork, and inconsistent UTM naming is the standard reason
attribution reports are garbage.

**`leads`** — `client_id`, `campaign_id`, `creative_id`, source, contact, `status`
(`new → contacted → qualified → won | lost`), value, `owner_id`. Closes the funnel.

**`marketing_campaigns`** (existing, extended) — add `client_id`, `platform`, `goal_metric`,
`goal_target`, `spend_actual`, `retro_worked`, `retro_avoid`. The two retro fields are the
highest-value documentation in the section: a campaign that closes without them teaches nothing.

**`assets`** — reusable per-client material (logos, b-roll, music, fonts). Private storage bucket
following the `contracts` / `debug` pattern. **`client_playbook`** — brand voice, posting times,
do/don't. Documentation that survives a person leaving.

**`marketing_items`** (existing) — retire or fold into `assets`; it's a bookmark list with no
client dimension.

⚠️ Every new table needs `is_demo` — `npm run check:demo` enforces the showcase filter repo-wide.

## Screens

**My queue** — the most important screen and the first one built. Across all clients: what's mine,
what's blocked, what's overdue. Three people sharing work need this more than any dashboard.

**Client workspace** — one client, tabs: Pipeline · Calendar · Ads · Leads · Assets · Notes.
At 1–2 clients a switcher suffices; client does not need to be a nav-level concept yet.

**Pipeline board** — columns are the status ladder, cards are creatives, one-click advance.

**Shoot week** — derived (D6): creatives with a shoot date in the next 14 days, grouped by day.

**Creative detail** — script, video, the timecoded review thread, sibling variants, ad results.

**Ads** — spend vs. budget per campaign, plus a per-creative table sorted by cost-per-lead. This
screen answers "which video won", which is the entire point of per-creative tracking.

**Recap** — weekly, derived, for Kagu management: shipped, live, spend, leads, per client. No
manual writing; if it needs composing by hand it won't get sent.

**Portal** (client route group) — waiting on you, and what's live. Nothing else at v1 (D5).

## Phases

| Phase | Scope | Why here |
|---|---|---|
| **0** ✅ | Client principal, `clients`, `client_id` everywhere, route group, invariant checks | Retrofitting a tenant column across 40+ policies later is the expensive mistake |
| **1** ✅ | `creatives` + pipeline board + my queue + client workspace shell | The 3 of them start using it for real; everything after is additive |
| **2** ✅ | `creative_reviews` + portal | First client approvals happen in-panel |
| **3** | `tracked_links` + CSV import + `ad_results` + Ads screen | Needs campaigns to have actually run |
| **4** | `leads` + funnel joins | Needs tracked links to exist first |
| **5** | Recap + `assets` + `client_playbook` | Value compounds only once phases 1–4 hold real data |

## Conventions this section must honor

Inherited from HANDOFF.md — this section gets no exemptions:

- **Create flows** are spacious dedicated surfaces (`/marketing/…/new` or fullscreen overlay),
  never inline expanders. No required fields; empty-field confirm.
- **Typed custom fields** only — Dropdown, DatePicker, NumberInput, UrlInput, FileInput, Checkbox
  from `src/components/ui/`. No native select/date/checkbox. A video's channel is a typed enum,
  not a string.
- **macOS-feel motion** (`--ease-mac`, pop-in popovers, page fade-rise, button micro-press).
- **Optimistic updates** on every status advance and approval — they are one-click primitives.
- **Realtime** via `LiveRefresh` on the new tables, as `marketing/page.tsx` already does.
- **Files upload browser → storage** (RLS-gated), then a server action saves the path.
  ⚠️ **Never bake a signed URL into server-rendered HTML — sign at click.** Video review pages are
  the worst case for this: a client leaves the tab open, the token expires, and the player silently
  fails.
- **Server actions re-check auth**; `blockIfReadOnly('marketing')` on every mutation. Client-user
  actions need their own guard — `can_write('marketing')` must not be the check that lets a client
  approve.
- Read AGENTS.md first: this Next.js version diverges from training data; consult
  `node_modules/next/dist/docs/` before writing route or data-layer code.

## Risks

1. **Tenant leak.** A client seeing another client's rows, or appearing in Kagu member lists. Only
   real mitigation is DB-level policies plus migration-time invariant assertions (0053 style).
2. **Import discipline.** Per-creative ad data is worthless if nobody imports weekly. The schema is
   the easy half; the two-minute import is the half that decides whether this works.
3. **Portal scope creep.** D5 exists because building the client reporting panel alongside the
   internal one is the most likely way this stalls.
4. **Undecided engagement model.** Mitigated by D4, but if the answer lands on % of ad spend,
   spend accuracy becomes billing-critical and D2/D3 both need revisiting.
