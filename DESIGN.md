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

## State vocabulary

- Debug task states: `open` = neutral outline pill, `in_progress` = amber pill, `done` = green pill.
- Priority: `low` faint · `medium` muted · `high` amber · `urgent` danger.
- Project status: `planning` info · `active` green · `paused` amber · `done` faint.
- Sprint phase (derived): `upcoming` info · `active` green · `past` faint.

## Typography

Geist Sans everywhere (one family, weights 400/500/600); Geist Mono for amounts, dates-in-tables,
counts, IDs. Fixed rem scale (no clamp): 12 (`text-xs` meta) · 13 · 15 (body/base) · 16 · 18
(section titles, 600) · 22 (page titles, 600). Prose capped at ~70ch; tables may run dense.

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

## Motion

150–200ms, `ease-out`, state feedback only (hover fills, row highlight on realtime update,
dialog fade). No page-load choreography. `prefers-reduced-motion` collapses all of it (global rule
in globals.css).

## Bans (project-specific)

No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no identical
icon-card grids, no eyebrow kickers, no custom scrollbars/controls, no decorative motion.
