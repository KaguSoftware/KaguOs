-- Ideas can now belong to a PROJECT.
--
-- "Ideas" until today meant one thing: a proposal for a new project, sitting in
-- the company-wide pipeline where enough unanimous upvotes turn it into one.
-- But the team also wants somewhere to suggest things INSIDE a project — a
-- feature, a name, a change — and that has nowhere to live: filing it in the
-- global pipeline claims it should become its own project, and the debug board
-- is for work that's already been decided on.
--
-- Rather than a second, parallel ideas system (two tables, two vocabularies,
-- two places to look for the same act of suggesting something), this scopes the
-- EXISTING one. `project_id` is nullable and that nullability carries the
-- meaning:
--
--   project_id IS NULL      → a company idea. Exactly what exists today; every
--                             current row keeps this value and keeps behaving
--                             identically. The /work Ideas tab filters on it.
--   project_id IS NOT NULL  → a suggestion for that project.
--
-- ⚠️ Auto-promote is DISABLED for project-scoped ideas (enforced in
-- maybeAutoPromote, not here): promotion turns an idea into a NEW project,
-- which is meaningless for "rename this screen" inside an existing one and
-- would spawn junk projects. Voting still applies — it's how the team says
-- which suggestion it actually wants.
--
-- No RLS change: the ideas policies gate on Work membership, and a
-- project-scoped idea is still a Work idea. `on delete cascade` because a
-- suggestion about a deleted project is orphaned by definition (unlike
-- debug_tasks.found_by, where the discovered work outlives its audit).

alter table public.ideas
  add column project_id uuid references public.projects (id) on delete cascade;

-- The project ideas view filters by this column on every load.
create index ideas_project_idx on public.ideas (project_id);
