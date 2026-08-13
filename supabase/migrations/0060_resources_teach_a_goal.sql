-- 0060: A resource hangs off the goal it teaches.
--
-- 0059 gave resources a `group_label` so the eighteen prompting techniques
-- could render as their own panel, a numbered run grouped by Framing /
-- Specification / Structure / Iteration. That panel then sat beside the stage
-- that teaches exactly those four things: the playbook's "Framing — set the
-- scene" and the stage's "Framing — role, goal, audience, constraints" are one
-- idea written twice, in two places on one page, each keeping its own ticks.
--
-- So the link goes one level deeper than the stage. A resource now points at
-- the goal it teaches, and its videos render underneath that goal inside the
-- stage — the goal's own title is the heading, and there is one Framing on the
-- page instead of two.
--
-- `on delete set null`, not cascade: rewording a goal retires it (see the seed
-- script's `reconcile`), and a retired goal must not take four working videos
-- down with it. Such a resource keeps its `stage_id` and falls back to that
-- stage's reading list, which is where an unattached resource renders already.
alter table public.sprint_resources
  add column goal_id uuid references public.sprint_goals (id) on delete set null;

-- Read one stage at a time, so the partial index is the whole working set:
-- ordinary resources carry no goal and never appear in this lookup.
create index sprint_resources_goal_idx
  on public.sprint_resources (goal_id, sort_order) where goal_id is not null;

-- `goal_id` supersedes `group_label` rather than joining it. Two ways to group
-- one resource is two ways for it to render, and the loser is a heading with no
-- work behind it — the exact duplication above. Dropped rather than left in
-- place unread, so the next person doesn't wire the panel back up.
drop index if exists public.sprint_resources_group_idx;
alter table public.sprint_resources drop column if exists group_label;
