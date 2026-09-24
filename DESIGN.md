# Design

KaguOs visual system — dark-first, quiet & precise, register: product. Design serves the task;
the bar is earned familiarity (Linear/Vercel fluency), not novelty.

## Theme & color (OKLCH, single dark theme)

| Token | Value | Role |
|---|---|---|
| `bg` | `oklch(0.11 0 0)` | app background (pure neutral, chroma 0) |
| `surface` | `oklch(0.145 0 0)` | sidebar, panels |
| `raised` | `oklch(0.185 0 0)` | hover fills, inputs, row hover |
| `line` / `line-strong` | `oklch(0.235/0.33 0 0)` | borders / emphasized borders |
| `ink` | `oklch(0.93 0.005 160)` | body text (~14:1 vs bg) |
| `muted` | `oklch(0.68 0.008 160)` | secondary text (~6:1) |
| `faint` | `oklch(0.53 0.006 160)` | meta text, ≥3.5:1, never body copy |
| `primary` | `oklch(0.86 0.14 160)` | operational green — primary buttons (with `primary-ink` text), success/done |
| `primary-dim` | `oklch(0.78 0.12 160)` | links, focus ring, green text on bg |
| `amber` | `oklch(0.80 0.13 75)` | in-progress, high priority, warnings |
| `danger` | `oklch(0.70 0.19 25)` | urgent, destructive, errors |
| `info` | `oklch(0.76 0.10 240)` | informational accents (sparingly) |

Strategy: **Restrained** — neutral surfaces carry everything; green/amber/red mark *state only*.
Text on saturated fills: primary buttons use near-black `primary-ink` on the pale green fill
(≥10:1). Never white-on-mid-green.

### Section accents (hue = place, 2026-09-03)

One hue per destination, defined as `--sec-*` in `globals.css` and reached through
`lib/section-accent.ts` (never re-typed as a hex):

| Key | Value | | Key | Value |
|---|---|---|---|---|
| `dashboard` | `#4FD1E0` | | `messages` | `#2FD39E` |
| `work` | `#F0EFEA` | | `marketing` | `#FF5C8A` |
| `learn` | `#9B84FF` | | `comms` | `#A8D74A` |
| `management` | `#6E93FF` | | `admin` | `#F2665E` |
| `debug` | `#F5A93C` | | | |

The keys are NAV keys, not `Section` values: Dashboard and Admin are tabs without a section,
`chat` is called Messages in the nav, and `status` is a gate with no destination and so no colour.
Work is near-white on purpose — it's the default place, and reads as "no colour" beside the rest.

**The rule this buys, and its limit:** hue answers *where am I*; green/amber/red still answer
*what condition is this in*. An accent may tint a selected tab, a page-header rule, a section's own
icon, or a chip that names a section. It may **never** colour a status pill, a button, a focus ring,
or an unread badge — those belong to the state vocabulary below, and a place-colour entering
through that door is how "amber" stops meaning one thing.

In use: sidebar tabs + mobile tiles (selected only), `PageHeader`'s left rule, the dashboard stat
tiles, activity-feed icons, the highlighted command-palette row, and the access chips in
Account/Admin. `SectionAccentScope` publishes the current route's accent as `--section-accent` on
the content column, so a page-level surface never needs a section prop; per-item lists look their
own key up instead.

## State vocabulary

- Debug task states: `open` = neutral outline pill, `in_progress` = amber pill, `done` = green pill.
- Priority: `low` faint · `medium` muted · `high` amber · `urgent` danger.
- Project status: `planning` info · `active` green · `paused` amber · `done` faint.
- Sprint phase (derived): `upcoming` info · `active` green · `past` faint.

## Typography

Geist Sans everywhere (one family, weights 400/500/600); Geist Mono for amounts, dates-in-tables,
counts, IDs. Two tiers (2026-09-24):
- **Body scale:** 12 (`text-xs` meta) · 13 · 15 (body/base) · 16 · **18 (section headings inside a
  page — Reminders, Pinboard, Recent activity; 600, tracking-tight: the step between the display
  title and the body)** · 22 (card/sheet titles, 600).
- **Display tier:** page titles 34 → 48px md+, 600, tracking -0.04em, leading 1.02 (`PageHeader`);
  create surfaces 30 → 40px (`create.tsx`); thread/error titles 28 → 36px; the phone menu's list
  clamp(30px,10vw,44px); the login wordmark clamp(44px,14vw,72px); the intro's greeting
  clamp(56px,11vw,168px); dashboard figures 28 → 34px **mono**. Display type sits at thresholds
  (page start, navigation, a form's top, the day's first open) — never inside content. Every
  display line rises out of a mask (`RiseText`) and most carry an `AccentRule` beneath.
- **Casing rule:** fixed words are UPPERCASE at display size and in nav/tab labels (section names,
  "Brainstorm", commands in ⌘K, tab labels); user-written text keeps its case (project, contract,
  client and people names, greetings, content hits). `PageHeader`/`TabbedPanels` take `text` to
  opt a user-written title out of uppercase. Small labels (≤13px) follow normal case.

Prose capped at ~70ch; tables may run dense.

## Layout

App shell: fixed left sidebar (`surface`, 1px `line` border-right, collapsible to icons on mobile)
+ scrollable content column with a page header (title + primary action right-aligned). Content
max-width ~72rem. Spacing rhythm: 4/8/12/16/24/32. Tables are the default list affordance;
cards only where the item is a destination (dashboard section cards).

## Components (`src/components/ui/`)

Button (primary / outline / ghost / danger; sm & md; every state incl. disabled + pending),
Input/Textarea/Select (native, on `raised` fill, `line` border), Field (label + control + error),
Badge (state pills above), Panel, EmptyState (teaches the section, never blank), Skeleton,
ConfirmDialog (native `<dialog>`; modals only for destructive confirms — everything else inline).

## Motion — macOS feel (Parsa rule, 2026-07-16)

Curve: `--ease-mac: cubic-bezier(0.32, 0.72, 0, 1)` (Apple's sheet curve) on everything.
- Popovers (dropdown, date picker): `animate-pop-in` — 180ms scale 0.96→1 + fade, origin at trigger.
- Fullscreen create overlays: `animate-overlay-in` — 220ms scale 0.985→1 + fade.
- Route changes: `(app)/template.tsx` wraps pages in `animate-page-in` — 250ms fade + 4px rise.
- Buttons: `active:scale-[0.98]` micro-press; hovers 150ms.
- Transient surfaces (menus, popovers, overlays) get frosted translucency (`bg-raised/90
  backdrop-blur-md`) — macOS material identity. NEVER on cards/panels (glassmorphism ban holds).
- **Staggered reveal language** (after React Bits' StaggeredMenu, pure CSS, no GSAP): coloured
  layers `wipe-in` ahead of a `panel-in` surface; type `line-rise`s out of an overflow-hidden mask
  (translateY 140% + rotate 10°, origin-bottom, pb for descenders); accent fills `wipe-x` from the
  left; exits use `--ease-mac-in`. Used at thresholds only: the phone menu, the daily intro, page
  titles (+ their accent rule), the sidebar's labels on load and its active-row fill, and the
  sidebar's collapse (labels `line-sink` 150ms, THEN the width goes over 300ms, while a
  section-accent `rail-sweep` crosses the rail; expand re-mounts the labels so they rise).
  Shared primitives: `components/ui/rise-text.tsx` (`RiseText` — with `folding` for the reverse
  — and `AccentRule`), `components/ui/tab-strip.tsx` (`TabStrip`: uppercase tabs, ONE underline
  in the section accent that slides to the selected tab; panels fade in on switch). Selected-row
  fills everywhere (sidebars, inbox, ⌘K) mount on the active row and `wipe-x` in. Toasts slide in
  from the page edge (sm+) and draw a 3px tone bar across their top. Loading skeletons use
  `PageHeaderSkeleton` so the header's real height is reserved. Type never animates
  inside content — the one exception is a chat message arriving live (`msg-in`, below).
- **Messages (restyled 2026-09-24).** Full-bleed (SectionAccentScope `bleedClassName`; the only
  route that leaves the max-w-6xl column). Inbox: display "MESSAGES" + accent rule, names in 22px
  uppercase rising in turn, presence dot ringed in the person's colour, unread as an accent
  superscript, active row fill `wipe-x`. Thread: display-size name rising per switch; bold
  bubbles — **yours filled with `--sec-messages`** (`text-primary-ink`, RichText
  `tone="onAccent"`), theirs `bg-raised`, `rounded-2xl` with a tail corner only on the last line
  of a run; group avatars on the last line of a run; time once per run; day labels as pills;
  typing dots. **Accent exception:** in Messages the section hue may fill your own bubbles and
  the unread superscripts/divider — deliberate, Messages only; elsewhere the rule below holds.
- Motion conveys state only; `prefers-reduced-motion` collapses everything (global rule).

## Bans (project-specific)

No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no identical
icon-card grids, no eyebrow kickers, no custom scrollbars/controls, no decorative motion.
