-- 0079: the four Touch Padel tracks, opened up week by week.
--
-- 0077 wrote the plan at track level: four tracks and the handover window, five
-- rows. 0078 made a phase able to contain phases. This fills them in.
--
-- The sub-phases are the scope of work's OWN week-by-week table (section 15,
-- "Build -- weeks 1 to 4"), one sub-phase per track per week, plus the four
-- workstreams that make up the review window. Nothing here is invented: each
-- child is a cell of that table, written out in the client's language.
--
-- Weights are a share of THE PARENT, not of the project (0078 s1c). Each
-- track's four weeks are weighted by how much of that track's work actually
-- sits in them, not 25/25/25/25 -- week 4 of the desktop track carries stock,
-- the management panel and two workspaces, and calling that a quarter of the
-- track would strand the bar exactly where the scope says the risk is.
--
-- Each track's children sum to 100. Parent completion is now computed from
-- them, so this migration does not set completion anywhere: 0078's rollup
-- writes it, and every child starts at 0.

begin;

-- ---------------------------------------------------------------------------
-- Precondition: 0078 must already be applied.
--
-- Everything below names `parent_id`, which does not exist until 0078 adds it.
-- Without this check the failure is a bare `42703: column "parent_id" does not
-- exist` pointing at a DELETE, which says nothing about the actual cause --
-- that a migration was run out of order. Checked rather than documented,
-- because a comment cannot stop a file being run.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_milestones'
      and column_name = 'parent_id'
  ) then
    raise exception
      '0079 requires 0078: project_milestones.parent_id does not exist. Apply 0078_milestone_sub_phases.sql first, then re-run this file.';
  end if;
end $$;

-- ⚠️ SUPERSEDED BY 0080.
--
-- 0080 replaces these five week-tracks with four systems ('Mobile app',
-- 'Desktop app', 'Website', 'Management panel'). Its delete removes the five
-- titles below, so on a replay of THIS file the delete matches nothing and the
-- insert would put the five tracks back beside the four systems -- nine bars
-- on the client's page, weights summing to 200. Guarded on a marker 0080
-- creates rather than on a version number (migration-workflow): if the
-- 'Management panel' system exists on this project, the newer plan is in place
-- and this file has nothing to do. The precondition above already proved
-- `parent_id` exists, so the column can be named in open code here.
--
-- The delete and the insert sit INSIDE this block (0077's structure) so that
-- `return` genuinely skips them -- a guard in its own block followed by bare
-- statements would only ever skip itself.
do $$
begin
  if exists (
    select 1 from public.project_milestones
    where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666'
      and parent_id is null
      and title = 'Management panel'
  ) then
    raise notice '0079 superseded by 0080 -- the four-system plan is in place, skipping';
    return;
  end if;

-- Replay-safe, and ordered: children are deleted via the parents' cascade
-- (0078 s1a), so clearing the five top-level rows clears the whole plan. Same
-- single-project scoping as 0076 and 0077 -- never widen it.
delete from public.project_milestones
where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666'
  and parent_id is null
  and title in (
    'Platform & data',
    'Mobile app — padel booking',
    'Website — cafe guest',
    'Desktop — till & desk',
    'Review, training & handover'
  );

with parents as (
  insert into public.project_milestones
    (project_id, title, detail, status, sort, weight, completion, visible_to_client)
  values
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Platform & data',
      'The foundation the other three tracks stand on: the database, who may touch it, and the rules that make a double booking impossible. Runs a few days ahead of everything else through week 1, because nothing else can go deep until it lands.',
      'planned', 10, 32, 0, true
    ),
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Mobile app — padel booking',
      'The guest app for iOS and Android, built from one codebase through Expo EAS. Padel only — the cafe lives on the website, because a guest at a table will not install an app to order a coffee.',
      'planned', 20, 16, 0, true
    ),
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Website — cafe guest',
      'The public site on Touch''s own domain, carrying the whole cafe guest experience — scan a table code, read the menu, order, call a waiter. Nothing to install and no account to create.',
      'planned', 30, 16, 0, true
    ),
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Desktop — till & desk',
      'The largest track: the application the venue is actually run from. One build, five role workspaces, and the stock system underneath it.',
      'planned', 40, 26, 0, true
    ),
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Review, training & handover',
      'The two weeks after the build: store review, a real trading week, training, documentation and acceptance.',
      'planned', 50, 10, 0, true
    )
  returning id, title
)

insert into public.project_milestones
  (project_id, parent_id, title, detail, status, sort, weight, completion, visible_to_client)
select
  '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
  parents.id,
  child.title,
  child.detail,
  'planned',
  child.sort,
  child.weight,
  0,
  true
from parents
join (values
  -- ── A · Platform & data ────────────────────────────────────────────────
  -- Week 1 carries the most: it is the foundation the other three tracks are
  -- waiting on, and it is the one genuine sequencing constraint in the plan.
  ('Platform & data', 10, 30,
   'Week 1 — Foundations',
   'Database schema and migration history, sign-in by email with verification and password reset, the five staff roles, and permissions enforced by row-level security at the database rather than in the interface. The bilingual English/Arabic content model, so a menu item or court name is one record holding both languages. Staging and production environments, and the deployment pipeline for all three clients.'),
  ('Platform & data', 20, 25,
   'Week 2 — Reservations & menu data',
   'The reservation model, with the database constraint that makes two overlapping bookings impossible to store — an overlap becomes a write that fails, not a bug to be caught later. Delivered with concurrency tests that fire simultaneous requests at one slot and assert exactly one succeeds. Then the menu and recipe structure, and the realtime channels that push tickets to the kitchen and released courts back onto the grid.'),
  ('Platform & data', 30, 27,
   'Week 3 — Money, rules & degraded mode',
   'The append-only audit log recording who did what, before and after, with a reason on every discount, void, override and adjustment. Configurable tax per item group. The day-close model and the reporting layer every figure in the management panel is calculated from. The promotions engine, and the heartbeat that marks the venue degraded and locks guest writes when the desk loses its connection.'),
  ('Platform & data', 40, 18,
   'Week 4 — Backups & load',
   'Automated daily backups with point-in-time recovery on Touch''s own project, error tracking and uptime monitoring on the booking and ordering paths, and a load test at twice expected peak.'),

  -- ── B · Mobile app ─────────────────────────────────────────────────────
  ('Mobile app — padel booking', 10, 22,
   'Week 1 — Shell & sign-in',
   'The app shell and the Expo EAS build pipeline, authentication screens, and the right-to-left foundation the rest of the app is laid out on.'),
  ('Mobile app — padel booking', 20, 26,
   'Week 2 — Courts & availability',
   'Court browsing with photographs and detail, the day view of live availability per court showing the price for that specific slot, and the short exclusive hold that reserves a slot while a guest finishes booking and returns it automatically if they do not.'),
  ('Mobile app — padel booking', 30, 32,
   'Week 3 — Booking end to end',
   'Booking from first tap to confirmation, visible immediately in the guest''s account and on the desk calendar. Push notifications for confirmation, reminder and cancellation, and guest-initiated cancellation inside the policy Touch configures.'),
  ('Mobile app — padel booking', 40, 20,
   'Week 4 — Store submission',
   'Polish, store listing copy and screenshots, then submitted to both Apple and Google under Touch''s own developer accounts. Review timing sits with the stores; acceptance is on submission of a working build.'),

  -- ── C · Website ────────────────────────────────────────────────────────
  ('Website — cafe guest', 10, 24,
   'Week 1 — Shell, domain & TLS',
   'The Next.js application and its deploy pipeline, locale routing with full right-to-left, and Touch''s domain live with TLS and DNS configured. A preview deployment per change, so Touch reviews before anything goes public.'),
  ('Website — cafe guest', 20, 26,
   'Week 2 — Menu & table binding',
   'The menu rendered from the same records the till edits, so a price change at the desk is live on the site within seconds and there is no second copy to keep in step. Printed QR code per table carrying a signed token rather than a plain table number, so the binding cannot be forged by editing a web address.'),
  ('Website — cafe guest', 30, 32,
   'Week 3 — Ordering & waiter call',
   'Basket, review and send to the bound table, anonymous by default with no sign-up required. Live order status on the page as the kitchen works — sent, being prepared, ready. One-tap waiter call with a reason, rate-limited per table and moving through raised, acknowledged and resolved.'),
  ('Website — cafe guest', 40, 18,
   'Week 4 — Venue pages & install',
   'Venue information, opening hours and map link, search-engine metadata and social preview images, a link through to the mobile app for padel, and home-screen install so a regular returns without scanning.'),

  -- ── D · Desktop ────────────────────────────────────────────────────────
  -- Week 4 is the heaviest week in the whole plan: two workspaces, the
  -- management panel, the write queue AND the entire stock module.
  ('Desktop — till & desk', 10, 15,
   'Week 1 — Shell & staff sign-in',
   'The Windows wrapper that opens on boot and cannot be closed like a browser tab, role-based routing, and staff sign-in with short-lived sessions on shared machines and a PIN for sensitive actions. The wrapper choice is confirmed this week against thermal-printer support.'),
  ('Desktop — till & desk', 20, 26,
   'Week 2 — Reception & the desk calendar',
   'The reception workspace and today''s board. Day and week calendar across all courts, create a booking for a walk-in, move, shorten, extend and cancel. Recurring series created in one action — every Tuesday 20:00–22:00 for a stated number of weeks — with clashes shown before the series is created. Customer search on partial phone number, name or email, staff-only internal notes, and the bilingual menu and content editor.'),
  ('Desktop — till & desk', 30, 26,
   'Week 3 — Till, kitchen & day close',
   'The cashier workspace: item grid built for speed, open tabs by table or by court, merge and split bills, and charging a cafe order to a court booking so a group settles courts and drinks in one payment. Promotions and discounts, with overrides behind an authorised PIN and a reason code. The kitchen screen with ticket ages and colour changes past target time. Day close, with cash and card reconciled and the variance stated.'),
  ('Desktop — till & desk', 40, 33,
   'Week 4 — Management, stock & the write queue',
   'The manager and owner workspaces, and the advanced management panel — revenue, occupancy, margin, stock and staff activity, every figure opening down to the transactions behind it, with CSV export throughout. The local cache and durable write queue that keep the till trading through an outage. Then stock: ingredients, recipes, goods-in with an expiry date per batch, automatic consumption as orders are confirmed, physical counts and the variance report.'),

  -- ── Review & handover ──────────────────────────────────────────────────
  ('Review, training & handover', 10, 34,
   'Five operating days in production',
   'The venue trades on the complete system for five consecutive operating days with no unresolved major issue. This is what acceptance is — not a demonstration. Days the venue is closed do not count and do not break the sequence; a major issue pauses the count and it resumes from where it paused once fixed.'),
  ('Review, training & handover', 20, 22,
   'Store review & defect fixing',
   'Apple and Google assess the submission on their own timetable. Two weeks are held so one rejection and a resubmission still land inside the window. Alongside it, defect fixing against each module''s acceptance test, including the disconnection drill that proves the till keeps trading and every queued item reappears exactly once.'),
  ('Review, training & handover', 30, 22,
   'Training & documentation',
   'Staff training for each of the five roles, recorded in both English and Arabic. Runbook, staff guide and technical handover documentation delivered — written so another developer could take the system over without contacting Kagu.'),
  ('Review, training & handover', 40, 22,
   'Backup test & handover',
   'A real backup and restore test performed together, restoring to a separate environment and confirming the data is intact — an acceptance condition, not a claim. Then repositories, the Supabase project, the domain and both store listings confirmed in Touch''s name, and sign-off.')
) as child(parent_title, sort, weight, title, detail)
  on child.parent_title = parents.title;

end $$;

commit;
