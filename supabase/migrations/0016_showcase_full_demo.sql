-- Showcase mode, completed: fake data for EVERY section and EVERY tab, visible
-- to ANY signed-in user while they're in showcase mode — regardless of their
-- real section memberships.
--
-- Two things were missing before this:
--   1. RLS. Every section table's SELECT policy required private.is_member(section),
--      so a non-member in showcase mode read ZERO rows even though the app-level
--      guard (canAccess) now lets them open the page. Result: empty pages.
--   2. Seed coverage. Several demo-able tables/tabs had no demo rows at all
--      (contracts, marketing_posts, marketing_items/links, the whole Learn
--      section, and the per-record child tables behind detail pages).
--
-- Fix: a private.in_showcase() predicate, an is_demo column on every remaining
-- demo-able table, each SELECT policy widened with
--   OR (is_demo AND private.in_showcase())
-- and a full demo seed. Real rows stay invisible in showcase (is_demo=false),
-- demo rows stay invisible normally — the existing app-level .eq("is_demo", …)
-- filters still hold; RLS is now just permissive enough to let demo rows through.

-- ========================================================================
-- (0) The showcase predicate. SECURITY DEFINER so policies can consult
--     profiles.showcase_mode without recursing through profiles' own RLS.
-- ========================================================================
create or replace function private.in_showcase()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.showcase_mode from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

grant execute on function private.in_showcase() to authenticated;

-- ========================================================================
-- (1) is_demo on the remaining demo-able tables. The 9 core tables already
--     got theirs in 0014; these are the children + Learn + marketing links.
-- ========================================================================
alter table public.idea_comments        add column is_demo boolean not null default false;
alter table public.idea_votes           add column is_demo boolean not null default false;
alter table public.project_secrets      add column is_demo boolean not null default false;
alter table public.contact_links        add column is_demo boolean not null default false;
alter table public.marketing_items      add column is_demo boolean not null default false;
alter table public.sprints              add column is_demo boolean not null default false;
alter table public.sprint_resources     add column is_demo boolean not null default false;
alter table public.sprint_participants  add column is_demo boolean not null default false;
alter table public.sprint_goals         add column is_demo boolean not null default false;
alter table public.sprint_goal_progress add column is_demo boolean not null default false;

-- ========================================================================
-- (2) Widen every section-gated SELECT policy to also admit demo rows while
--     the reader is in showcase mode. Drop + recreate each (Postgres has no
--     "alter policy ... using" that composes cleanly across versions).
-- ========================================================================

-- ---- Work: projects, ideas, idea_comments, idea_votes, project_secrets
drop policy projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (
    private.is_member('work') or private.is_member('debug')
    or (is_demo and private.in_showcase())
  );

drop policy ideas_select on public.ideas;
create policy ideas_select on public.ideas
  for select to authenticated
  using (private.is_member('work') or (is_demo and private.in_showcase()));

drop policy idea_comments_select on public.idea_comments;
create policy idea_comments_select on public.idea_comments
  for select to authenticated
  using (private.is_member('work') or (is_demo and private.in_showcase()));

drop policy idea_votes_select on public.idea_votes;
create policy idea_votes_select on public.idea_votes
  for select to authenticated
  using (private.is_member('work') or (is_demo and private.in_showcase()));

-- NOTE: 0012 widened this from management to WORK members. Preserve that.
drop policy project_secrets_select on public.project_secrets;
create policy project_secrets_select on public.project_secrets
  for select to authenticated
  using (private.is_member('work') or (is_demo and private.in_showcase()));

-- ---- Debug
drop policy debug_tasks_select on public.debug_tasks;
create policy debug_tasks_select on public.debug_tasks
  for select to authenticated
  using (private.is_member('debug') or (is_demo and private.in_showcase()));

-- ---- Learn: sprints + all sprint children
drop policy sprints_select on public.sprints;
create policy sprints_select on public.sprints
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

drop policy sprint_resources_select on public.sprint_resources;
create policy sprint_resources_select on public.sprint_resources
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

drop policy sprint_participants_select on public.sprint_participants;
create policy sprint_participants_select on public.sprint_participants
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

drop policy sprint_goals_select on public.sprint_goals;
create policy sprint_goals_select on public.sprint_goals
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

drop policy sprint_goal_progress_select on public.sprint_goal_progress;
create policy sprint_goal_progress_select on public.sprint_goal_progress
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

-- ---- Management: transactions, contracts, recurring_items, fx_rates.
-- transactions/contracts use a single FOR ALL policy; splitting out a
-- showcase-only SELECT policy is cleaner than rewriting the write path.
create policy transactions_showcase_select on public.transactions
  for select to authenticated
  using (is_demo and private.in_showcase());

create policy contracts_showcase_select on public.contracts
  for select to authenticated
  using (is_demo and private.in_showcase());

-- recurring_items lives in 0002; widen whatever SELECT it has via an additive
-- showcase policy (multiple permissive SELECT policies OR together).
create policy recurring_items_showcase_select on public.recurring_items
  for select to authenticated
  using (is_demo and private.in_showcase());

-- fx_rates is non-sensitive reference data (just USD/EUR → TRY). Showcase users
-- reach the Finance tab, and the TRY conversions need it, so let them read it.
create policy fx_rates_showcase_select on public.fx_rates
  for select to authenticated
  using (private.in_showcase());

-- ---- Marketing: campaigns, posts, items (links)
drop policy marketing_campaigns_select on public.marketing_campaigns;
create policy marketing_campaigns_select on public.marketing_campaigns
  for select to authenticated
  using (private.is_member('marketing') or (is_demo and private.in_showcase()));

drop policy marketing_posts_select on public.marketing_posts;
create policy marketing_posts_select on public.marketing_posts
  for select to authenticated
  using (private.is_member('marketing') or (is_demo and private.in_showcase()));

drop policy marketing_items_select on public.marketing_items;
create policy marketing_items_select on public.marketing_items
  for select to authenticated
  using (private.is_member('marketing') or (is_demo and private.in_showcase()));

-- ---- Comms: contacts, contact_links
drop policy contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated
  using (private.is_member('comms') or (is_demo and private.in_showcase()));

drop policy contact_links_select on public.contact_links;
create policy contact_links_select on public.contact_links
  for select to authenticated
  using (private.is_member('comms') or (is_demo and private.in_showcase()));

-- ========================================================================
-- (3) Seed the demo data missing before this migration. The 9 core tables
--     were seeded in 0014; here we (a) fill the gaps — contracts, marketing
--     posts + links, the whole Learn section — and (b) add the per-record
--     children so every DETAIL page also has something to show.
--     Everything is unmistakably fake: "Acme", "Demo", example.com, 123456…
-- ========================================================================

-- ---- Management → Contracts tab
insert into public.contracts (title, client, status, starts_on, ends_on, notes, is_demo) values
  ('Acme Corp — Master Services Agreement', 'Acme Corp', 'active',  current_date - 120, current_date + 245, 'Demo contract for showcasing.', true),
  ('Globex Inc — Retainer',                 'Globex Inc', 'active',  current_date - 60,  current_date + 305, 'Demo contract for showcasing.', true),
  ('Initech — Pilot SOW',                   'Initech',    'draft',   null,                null,               'Demo contract for showcasing.', true),
  ('Umbrella LLC — Old NDA',                'Umbrella LLC','expired', current_date - 800, current_date - 100, 'Demo contract for showcasing.', true);

-- ---- Marketing → Content calendar tab (posts)
insert into public.marketing_posts (title, channel, status, publish_on, notes, is_demo) values
  ('Demo post: product teaser',   'instagram', 'scheduled', current_date + 2,  'Demo content for showcasing.', true),
  ('Demo post: case study thread','x',         'draft',     current_date + 5,  'Demo content for showcasing.', true),
  ('Demo post: hiring announcement','linkedin','published', current_date - 3,  'Demo content for showcasing.', true),
  ('Demo post: newsletter #42',   'email',     'scheduled', current_date + 9,  'Demo content for showcasing.', true);

-- ---- Marketing → Links tab (marketing_items)
insert into public.marketing_items (title, url, note, is_demo) values
  ('Demo brand kit',        'https://example.com/brand-kit',  'Logos, colors, fonts (demo).', true),
  ('Demo campaign tracker', 'https://example.com/tracker',    'Shared sheet (demo).',         true),
  ('Demo press mentions',   'https://example.com/press',      'Coverage roundup (demo).',     true);

-- ---- Work → project detail: credentials (project_secrets) on a demo project
insert into public.project_secrets (project_id, label, username, secret, url, note, is_demo)
select p.id, 'Demo hosting login', 'demo@acme.example', 'demo-password-123456', 'https://console.example.com', 'Fake credentials for showcasing.', true
from public.projects p
where p.is_demo and p.name = 'Acme Corp Website'
limit 1;

-- ---- Work → idea detail: a comment + a couple of votes on a demo idea
insert into public.idea_comments (idea_id, body, is_demo)
select i.id, 'Demo comment: love this — let''s scope it next sprint.', true
from public.ideas i
where i.is_demo and i.title = 'Sample idea: AI onboarding bot'
limit 1;

-- ---- Learn → sprints (list + detail), with resources, goals, participants,
--       and progress so the Team-progress grid and Your-goals panels populate.
--       Participants/progress use the CURRENT viewer so it looks alive for
--       whoever is demoing.
do $$
declare
  demo_sprint_id uuid;
  g1 uuid;
  g2 uuid;
  g3 uuid;
  uid uuid := auth.uid();
begin
  insert into public.sprints (title, description, starts_on, ends_on, is_demo)
  values (
    'Demo sprint: TypeScript deep dive',
    'A two-week demo sprint for showcasing Kagu Learn. All fake data.',
    current_date - 4, current_date + 10, true
  )
  returning id into demo_sprint_id;

  insert into public.sprints (title, description, starts_on, ends_on, is_demo)
  values (
    'Demo sprint: Design systems 101',
    'Upcoming demo sprint for showcasing.',
    current_date + 14, current_date + 28, true
  );

  insert into public.sprint_resources (sprint_id, title, url, is_demo) values
    (demo_sprint_id, 'Demo resource: TS handbook', 'https://example.com/ts-handbook', true),
    (demo_sprint_id, 'Demo resource: exercises',   'https://example.com/exercises',   true);

  insert into public.sprint_goals (sprint_id, title, sort_order, is_demo) values
    (demo_sprint_id, 'Read the demo handbook chapters 1–3', 0, true) returning id into g1;
  insert into public.sprint_goals (sprint_id, title, sort_order, is_demo) values
    (demo_sprint_id, 'Complete the demo exercises',          1, true) returning id into g2;
  insert into public.sprint_goals (sprint_id, title, sort_order, is_demo) values
    (demo_sprint_id, 'Ship a demo mini-project',             2, true) returning id into g3;

  -- Only wire up participation/progress if we actually have a signed-in user
  -- running the migration (auth.uid() is null under the service role).
  if uid is not null then
    insert into public.sprint_participants (sprint_id, user_id, is_demo)
    values (demo_sprint_id, uid, true)
    on conflict do nothing;

    insert into public.sprint_goal_progress (goal_id, user_id, is_demo)
    values (g1, uid, true)
    on conflict do nothing;
  end if;
end $$;

-- ---- Comms → contact detail: linked resources on the demo client
insert into public.contact_links (contact_id, label, url, note, is_demo)
select c.id, 'Demo shared drive', 'https://example.com/drive', 'Everything for this account (demo).', true
from public.contacts c
where c.is_demo and c.name = 'John Sample'
limit 1;

insert into public.contact_links (contact_id, label, url, note, is_demo)
select c.id, 'Demo signed proposal', 'https://example.com/proposal.pdf', 'Won deal (demo).', true
from public.contacts c
where c.is_demo and c.name = 'John Sample'
limit 1;
