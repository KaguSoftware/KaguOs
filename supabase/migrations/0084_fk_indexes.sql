-- Foreign-key indexes the perf audit found missing, plus one duplicate.
--
-- Postgres never indexes a foreign key for you. Without one, every delete on
-- the parent (a profile, a project) scans the child table to cascade or null
-- it out, and any "all rows for this person" lookup reads the whole table. At
-- today's row counts neither is felt; these are cheap to add now and would be
-- a slow-page mystery later.
--
-- A composite primary key (goal_id, user_id) only helps lookups that lead
-- with goal_id, so the user_id side of each progress/vote table needs its own.

create index if not exists transactions_project_idx
  on public.transactions (project_id) where project_id is not null;

create index if not exists contacts_owner_idx
  on public.contacts (owner_id) where owner_id is not null;

-- unique (stage_id, user_id) already covers stage_id.
create index if not exists sprint_proof_submissions_user_idx
  on public.sprint_proof_submissions (user_id);

create index if not exists sprint_goal_progress_user_idx
  on public.sprint_goal_progress (user_id);

create index if not exists sprint_resource_progress_user_idx
  on public.sprint_resource_progress (user_id);

create index if not exists idea_votes_user_idx
  on public.idea_votes (user_id);

create index if not exists notifications_actor_idx
  on public.notifications (actor_id) where actor_id is not null;

-- 0018 added notifications_recipient_created_idx on exactly the columns 0009's
-- notifications_recipient_idx already had. Two identical indexes cost a write
-- each on every notification fan-out and buy nothing.
drop index if exists public.notifications_recipient_idx;
