-- 0077: Touch Padel's Phase 1 plan, as the client sees it.
--
-- Source of truth is the signed scope of work (Phase 1, v2.0): four weeks of
-- build run as FOUR PARALLEL TRACKS against a shared foundation, then two
-- weeks for store review, testing, training and handover.
--
-- The tracks are section 15's own structure, not a re-cut of it:
--
--   A · Platform & data      schema, auth, RLS, reservation model, reporting
--   B · Mobile app           padel booking, iOS + Android via Expo EAS
--   C · Website              the cafe guest experience, Next.js on Vercel
--   D · Desktop              till, desk, workspaces, stock, management panel
--
-- Written as `project_milestones` rows rather than as the ten scope modules
-- because a milestone is a thing a client watches MOVE. The modules are what
-- is being built and they are already fixed in writing; the tracks are how the
-- work actually progresses week to week, which is the question the portal's
-- progress bar exists to answer.
--
-- -- Why a fifth row --------------------------------------------------------
--
-- The four tracks cover weeks 1-4 only. Stopping there would show the client a
-- plan that hits 100% two weeks before the phase is accepted -- and those two
-- weeks carry the five-day production run, store review and handover, which is
-- precisely the period where a customer most wants to see something moving.
-- So the review-and-handover window is its own phase. It is section 15's
-- window, not an invention.
--
-- -- Weights ---------------------------------------------------------------
--
-- `milestoneProgress` (lib/data/portal.ts) divides by max(allocated, 100), so
-- weights that sum to less than 100 silently under-read the bar. These sum to
-- exactly 100. They are a judgement about SIZE, taken from the scope's own
-- statements about where the work sits:
--
--   D is the largest single track by a distance -- it carries the till, five
--   workspaces, the management panel AND stock & recipes, which section 15
--   calls "the largest module". A is the foundation everything else waits on
--   (week 1 is foundation-led) and carries the reservation constraint, the
--   reporting layer and degraded mode. B and C are real but narrower: one
--   surface each, both largely rendering data A owns.
--
-- No completion is set anywhere. Every phase starts at 0 and at 'planned',
-- because the down payment had not been received when this was written and the
-- honest figure for unstarted work is zero. The producer moves them.

begin;

-- ⚠️ SUPERSEDED BY 0079.
--
-- This file wrote the five tracks as flat rows. 0079 rewrites the same five
-- with sub-phases underneath them, and 0078's cascade means replaying this file
-- afterwards would delete those twenty children and put the flat plan back --
-- silently, and only on a replay, which is the worst way to find out.
--
-- Guarded on a marker 0079 creates rather than on a version number: if any
-- sub-phase exists on this project, the newer plan is in place and this file
-- has nothing to do. (migration-workflow: a superseded file needs a
-- supersession guard, not just `if not exists`.)
do $$
declare
  superseded boolean;
begin
  -- `parent_id` does not exist until 0078, and on a clean replay this file
  -- runs first. So the column is probed FIRST, and the query that names it is
  -- only ever parsed inside the branch where it exists -- EXECUTE, because
  -- plpgsql parses a plain statement when the block is first run and a
  -- `where parent_id is not null` in open code would raise 42703 on exactly
  -- the replay this guard exists to survive.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_milestones'
      and column_name = 'parent_id'
  ) then
    execute $q$
      select exists (
        select 1 from public.project_milestones
        where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666'
          and parent_id is not null
      )
    $q$ into superseded;

    if superseded then
      raise notice '0077 superseded by 0079 -- sub-phases present, skipping';
      return;
    end if;
  end if;


-- Replay-safe by construction: the delete clears exactly the rows this file
-- inserts, keyed on the project and on the titles below, so re-running it
-- restores this plan rather than duplicating it. Scoped to ONE project id --
-- never widen it, for 0076's reason: any `where` on client name or on a title
-- alone would match a future padel project.
--
-- NOTE this discards producer-entered completion on these five rows. That is
-- the intended behaviour for a seed being re-applied; if the plan has since
-- been worked on, edit it in the app instead of replaying this.
delete from public.project_milestones
where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666'
  and title in (
    'Platform & data',
    'Mobile app — padel booking',
    'Website — cafe guest',
    'Desktop — till & desk',
    'Review, training & handover'
  );

insert into public.project_milestones
  (project_id, title, detail, status, sort, weight, completion, visible_to_client)
values
  (
    '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
    'Platform & data',
    'The foundation the other three tracks stand on. Database schema and migrations, email sign-in, the five staff roles enforced by row-level security, and the bilingual English/Arabic content model. Then the reservation table with the constraint that makes a double booking impossible, the menu and recipe structure, the audit log, tax configuration, the day-close and reporting layer, the promotions engine, and the heartbeat that puts the venue into degraded mode. Closes with backups, point-in-time recovery, monitoring and a load test at twice expected peak.',
    'planned',
    10,
    32,
    0,
    true
  ),
  (
    '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
    'Mobile app — padel booking',
    'The guest app for iOS and Android, built from one codebase through Expo EAS. Court browsing with live availability, a short exclusive hold on a slot while the guest books, booking end to end, push notifications for confirmation, reminder and cancellation, and the cancellation policy. Padel only — the cafe lives on the website. Submitted to both stores at the end of week 4, under Touch''s own developer accounts.',
    'planned',
    20,
    16,
    0,
    true
  ),
  (
    '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
    'Website — cafe guest',
    'The public site on Touch''s own domain, and the whole cafe guest experience with it. Locale routing and right-to-left, the menu rendered live from the same records the till edits, signed table-token binding so a QR code cannot be forged, basket and ordering, one-tap waiter call, and live order status as the kitchen works. Then venue information, search metadata and home-screen install.',
    'planned',
    30,
    16,
    0,
    true
  ),
  (
    '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
    'Desktop — till & desk',
    'The largest track: the application the venue is actually run from. Reception and cashier workspaces, the desk calendar with recurring series, customer search and notes, and the menu editor. Then tabs, splits, promotions and discounts, charging a cafe order to a court booking, the kitchen screen and day close. Finally the manager and owner workspaces, the management panel with CSV export, the local cache and write queue for degraded mode, and stock — ingredients, recipes, goods-in with batch expiry, consumption, counts and variance.',
    'planned',
    40,
    26,
    0,
    true
  ),
  (
    '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
    'Review, training & handover',
    'The two weeks after the build. Apple and Google review the submission; the window holds enough room that one rejection and a resubmission still land inside it. Defect fixing against each module''s acceptance test, including the disconnection drill. Staff training per role, recorded in both languages. Runbook and technical documentation delivered, a real backup and restore test performed together, repositories and accounts handed over. The venue trades on the complete system for five consecutive operating days, which is what acceptance is.',
    'planned',
    50,
    10,
    0,
    true
  );

end $$;

commit;
