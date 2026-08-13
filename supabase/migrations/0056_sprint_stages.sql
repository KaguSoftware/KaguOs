-- 0056: Learn sprints gain stages — a sprint is no longer a flat goal list but
-- an ordered run of stages, each holding its own goals and ending in a "proof"
-- (the one goal that says you actually cleared it). Progression is legible
-- without being a game: no points, no badges, no streaks. A stage is cleared
-- when every goal in it is ticked, which the app derives from rows that already
-- exist — nothing new to keep in sync.
--
-- Gating is SOFT by design. Nothing here refuses an out-of-order tick; stages
-- ahead of you render quiet and collapsed, and that's the whole mechanism. A
-- hard lock would be the ten-click flow the product principles ban.
--
-- Backwards compatible on purpose: `stage_id` is nullable, so every sprint that
-- exists today keeps working untouched and its goals render as one implicit
-- stage. No backfill, no downtime.

create table public.sprint_stages (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  title text not null,
  -- The lead line under the stage title. Prose, not a goal.
  summary text,
  -- The gate, in words ("Route 3 real tasks to the right surface + model").
  -- Rendered under a PROOF rule; the matching goal row carries is_proof.
  proof text,
  kind text not null default 'stage' check (kind in ('stage', 'capstone')),
  -- Day range within the sprint (1-based, inclusive). Both null = undated.
  day_from smallint check (day_from is null or day_from >= 1),
  day_to smallint check (day_to is null or day_to >= 1),
  -- Effort estimate, e.g. 4–5 hrs. Both null = unestimated.
  hours_low smallint check (hours_low is null or hours_low >= 0),
  hours_high smallint check (hours_high is null or hours_high >= 0),
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (day_to is null or day_from is null or day_to >= day_from),
  check (hours_high is null or hours_low is null or hours_high >= hours_low)
);
create index sprint_stages_demo_sprint_idx
  on public.sprint_stages (is_demo, sprint_id, sort_order);

-- A goal now belongs to a stage. Null = legacy/unstaged, shown in an implicit
-- stage at the top. `on delete cascade`: deleting a stage takes its goals with
-- it, matching how deleting a sprint takes its goals today.
alter table public.sprint_goals
  add column stage_id uuid references public.sprint_stages (id) on delete cascade;
create index sprint_goals_stage_idx on public.sprint_goals (stage_id);

-- The proof goal of a stage: same ticking machinery, different chrome, and it's
-- what "cleared" hinges on visually. At most one per stage.
alter table public.sprint_goals
  add column is_proof boolean not null default false;
create unique index sprint_goals_one_proof_per_stage
  on public.sprint_goals (stage_id) where is_proof;

-- Resources scope to a stage so the Landscape links sit inside Landscape.
-- Null = sprint-wide, shown on the general shelf.
alter table public.sprint_resources
  add column stage_id uuid references public.sprint_stages (id) on delete set null;
create index sprint_resources_stage_idx on public.sprint_resources (stage_id);

-- ---- RLS: mirrors sprint_goals exactly (members read, admins write) plus the
-- showcase split from 0016 — a demo sprint's stages are visible in showcase.
alter table public.sprint_stages enable row level security;

create policy sprint_stages_select on public.sprint_stages
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

create policy sprint_stages_admin_write on public.sprint_stages
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---- Realtime: same treatment as every other user-facing list (0029).
alter table public.sprint_stages replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sprint_stages'
  ) then
    alter publication supabase_realtime add table public.sprint_stages;
  end if;
end $$;
