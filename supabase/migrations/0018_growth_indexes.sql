-- Indexes shaped like the queries the app actually runs.
--
-- Two problems with what was there before:
--
--   1. 0014 indexed is_demo ALONE, on 7 tables. A standalone index on a boolean
--      is close to useless: with two possible values it cannot narrow a scan
--      much, so the planner ignores it and seq-scans anyway (verified with
--      EXPLAIN on prod). Every real query pairs is_demo with something else —
--      `is_demo + created_at desc` for the lists, `is_demo + state/status/kind`
--      for the dashboard counts — so the index has to carry that second column
--      to earn its keep.
--   2. 0016 added is_demo to 10 MORE tables and indexed none of them, and 0014
--      itself missed marketing_posts and contracts.
--
-- To be honest about the payoff: at today's row counts (single digits per
-- table) NONE of this changes a measurable millisecond — a seq scan of 9 rows
-- is ~0.1ms and unbeatable. These exist so the app stays fast when the tables
-- reach thousands of rows, which is the point at which adding indexes is a
-- panicked afternoon rather than a quiet migration.
--
-- The old single-column is_demo indexes are dropped: each composite below has
-- is_demo as its leading column, so it serves every query the old one did.
-- Keeping both would just cost write throughput for nothing.

-- ========================================================================
-- Lists: "everything on this board, newest first"
-- ========================================================================
create index if not exists debug_tasks_demo_created_idx
  on public.debug_tasks (is_demo, created_at desc);
create index if not exists ideas_demo_created_idx
  on public.ideas (is_demo, created_at desc);
create index if not exists projects_demo_created_idx
  on public.projects (is_demo, created_at desc);
create index if not exists marketing_posts_demo_publish_idx
  on public.marketing_posts (is_demo, publish_on desc);
create index if not exists transactions_demo_occurred_idx
  on public.transactions (is_demo, occurred_on desc);
create index if not exists contracts_demo_created_idx
  on public.contracts (is_demo, created_at desc);

-- ========================================================================
-- Dashboard counts: is_demo + the status column each one filters on
-- ========================================================================
create index if not exists debug_tasks_demo_state_idx
  on public.debug_tasks (is_demo, state);
create index if not exists projects_demo_status_idx
  on public.projects (is_demo, status);
create index if not exists ideas_demo_status_idx
  on public.ideas (is_demo, status);
create index if not exists marketing_campaigns_demo_status_idx
  on public.marketing_campaigns (is_demo, status);
create index if not exists contacts_demo_kind_idx
  on public.contacts (is_demo, kind);

-- "my open tasks" — the one dashboard stat scoped to a person.
create index if not exists debug_tasks_demo_assignee_idx
  on public.debug_tasks (is_demo, assignee_id)
  where assignee_id is not null;

-- Active recurring items: the finance card sums these on every dashboard load.
create index if not exists recurring_items_demo_active_idx
  on public.recurring_items (is_demo)
  where canceled_on is null;

-- Sprints active *today* — a range scan over both date columns.
create index if not exists sprints_demo_dates_idx
  on public.sprints (is_demo, starts_on, ends_on);

-- ========================================================================
-- The 0016 tables that never got an is_demo index. These are all read as
-- children of a parent row, so is_demo pairs with the parent's foreign key.
-- ========================================================================
create index if not exists idea_comments_demo_idea_idx
  on public.idea_comments (is_demo, idea_id);
create index if not exists idea_votes_demo_idea_idx
  on public.idea_votes (is_demo, idea_id);
create index if not exists contact_links_demo_contact_idx
  on public.contact_links (is_demo, contact_id);
create index if not exists project_secrets_demo_project_idx
  on public.project_secrets (is_demo, project_id);
create index if not exists marketing_items_demo_idx
  on public.marketing_items (is_demo);
create index if not exists sprint_resources_demo_sprint_idx
  on public.sprint_resources (is_demo, sprint_id);
create index if not exists sprint_participants_demo_sprint_idx
  on public.sprint_participants (is_demo, sprint_id);
create index if not exists sprint_goals_demo_sprint_idx
  on public.sprint_goals (is_demo, sprint_id);
create index if not exists sprint_goal_progress_demo_goal_idx
  on public.sprint_goal_progress (is_demo, goal_id);

-- ========================================================================
-- Non-demo tables the app hits on every single page load.
-- ========================================================================
-- The sidebar bell: this user's notifications, newest first.
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
-- The dashboard's reminder list ordering.
create index if not exists reminders_done_created_idx
  on public.reminders (done, created_at desc);

-- ========================================================================
-- Retire the superseded single-column is_demo indexes (see header).
-- ========================================================================
drop index if exists public.projects_demo_idx;
drop index if exists public.ideas_demo_idx;
drop index if exists public.debug_tasks_demo_idx;
drop index if exists public.transactions_demo_idx;
drop index if exists public.recurring_items_demo_idx;
drop index if exists public.marketing_campaigns_demo_idx;
drop index if exists public.contacts_demo_idx;
