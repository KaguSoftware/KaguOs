-- 0059: A sprint can carry a whole program, not just a goal list.
--
-- Kagu Learn shipped its two syllabi as standalone HTML decks in `public/learn`.
-- A deck is a thing you read once and lose; the ticks in it were browser-local
-- and evaporated on refresh. This migration gives the sprint tables the few
-- shapes those decks needed, so the program renders inside the app and every
-- tick lands in the same per-person progress store the goals already use.
--
-- Three additions, each the smallest one that works:
--
--   1. Resources learn what they ARE (video / read) and where they come from,
--      plus an optional `group_label` — a labelled run of resources is exactly
--      what the "prompting playbook" is (18 techniques, one video each, grouped
--      by Framing / Specification / Structure / Iteration).
--   2. `sprint_resource_progress` — the same tick machinery as goals, for
--      "watched". Mirrors sprint_goal_progress row for row, policy for policy.
--   3. `sprint_practices` — the prose blocks a program carries that aren't
--      goals: the study rules, the shape of a daily session, the capstone build
--      timeline. One table, three kinds, because they're all label + copy.
--
-- Nothing here is required. A sprint with none of it renders exactly as it does
-- today, which is what keeps every existing sprint working untouched.

-- ---- 1. Resources gain kind, source, grouping and order -------------------
--
-- `kind` is about the affordance, not the file: a video row gets a play mark
-- and reads "watch this", a read row doesn't. 'link' stays the default so every
-- existing row keeps its current, unopinionated rendering.
alter table public.sprint_resources
  add column kind text not null default 'link'
    check (kind in ('link', 'video', 'read')),
  -- Who made it — "IBM Technology", "freeCodeCamp · § goal". Shown small and
  -- right-aligned, because the technique matters more than the channel.
  add column source text,
  -- Non-null = this resource belongs to a named run (the playbook). The label
  -- is the group heading and the grouping key at once; ordering inside a group
  -- is sort_order. Null = an ordinary resource on its stage or the shelf.
  add column group_label text,
  add column sort_order integer not null default 0;

-- Resources were previously ordered by created_at alone. Explicit order matters
-- once they're a numbered playbook.
create index sprint_resources_order_idx
  on public.sprint_resources (is_demo, sprint_id, sort_order);
create index sprint_resources_group_idx
  on public.sprint_resources (sprint_id, group_label) where group_label is not null;

-- ---- 2. "Watched" ticks ---------------------------------------------------
--
-- Deliberately a twin of sprint_goal_progress (0001) rather than a generic
-- progress table: same primary key shape, same participant gate, same delete
-- rule. A generic table would need a polymorphic target column and would lose
-- the foreign key that makes `on delete cascade` clean up after a deleted
-- resource for free.
create table public.sprint_resource_progress (
  resource_id uuid not null references public.sprint_resources (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_demo boolean not null default false,
  completed_at timestamptz not null default now(),
  primary key (resource_id, user_id)
);
create index sprint_resource_progress_demo_idx
  on public.sprint_resource_progress (is_demo, resource_id);

alter table public.sprint_resource_progress enable row level security;

create policy sprint_resource_progress_select on public.sprint_resource_progress
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

-- can_write, not is_member (0053): a view-only Learn member reads the program
-- but cannot tick it. Participation is required for the same reason it is on
-- goals — progress belongs to a run you're actually in.
create policy sprint_resource_progress_insert on public.sprint_resource_progress
  for insert to authenticated
  with check (
    private.can_write('learn')
    and user_id = (select auth.uid())
    and is_demo = false
    and exists (
      select 1
      from public.sprint_resources r
      join public.sprint_participants sp on sp.sprint_id = r.sprint_id
      where r.id = resource_id and sp.user_id = (select auth.uid())
    )
  );

create policy sprint_resource_progress_delete on public.sprint_resource_progress
  for delete to authenticated
  using (
    private.can_write('learn')
    and user_id = (select auth.uid())
  );

-- ---- 3. The program's prose blocks ----------------------------------------
--
-- Three kinds share one table because they share one shape (a label and some
-- copy), and three near-identical tables would be three sets of policies to
-- keep in step:
--
--   rule    — a study rule. label "70 / 30", title "Use it live", body why.
--   session — one block of the daily session. label "REVIEW", minutes 15.
--   build   — a line of the capstone timeline. label "D12", body what to do.
--
-- `minutes` is only read for 'session'; it drives a proportional day meter, so
-- it's a number rather than a string parsed out of the label at render time.
create table public.sprint_practices (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  kind text not null check (kind in ('rule', 'session', 'build')),
  label text not null,
  title text,
  body text,
  minutes smallint check (minutes is null or minutes > 0),
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index sprint_practices_demo_sprint_idx
  on public.sprint_practices (is_demo, sprint_id, kind, sort_order);

alter table public.sprint_practices enable row level security;

create policy sprint_practices_select on public.sprint_practices
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

create policy sprint_practices_admin_write on public.sprint_practices
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---- 4. The two lines a program says about itself -------------------------
--
-- `tagline` sits under the title ("Using Claude — the beginner program");
-- `outro` is the sign-off at the foot of the run. Both nullable: an ordinary
-- sprint has neither and renders without the chrome.
alter table public.sprints
  add column tagline text,
  add column outro text;

-- ---- 5. Realtime: same treatment as every other user-facing list (0029) ----
-- sprint_resources was never published, which is why adding a resource never
-- reached an open page. It does now, alongside the two new tables.
do $$
declare
  t text;
  tables text[] := array[
    'sprint_resources', 'sprint_resource_progress', 'sprint_practices'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---- 6. Invariant, re-checked rather than trusted (same rule as 0053 §7) ---
-- 0053 enforced "no write policy consults is_member()" at its own migration
-- time, which cannot see policies added afterwards. Repeated here because this
-- migration adds write policies.
do $$
declare
  bad text;
begin
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;
end $$;
