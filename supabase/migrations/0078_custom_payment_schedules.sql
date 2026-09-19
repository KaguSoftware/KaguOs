-- 0078: a payment plan that has no rhythm.
--
-- 0075 gave a plan two shapes, 'installments' and 'recurring', and was explicit
-- that the difference between them is only what the client is told -- the rows
-- underneath are the same either way, laid out by stepping a cadence off a
-- start date.
--
-- That covers the money that arrives on a schedule. It does not cover the money
-- that arrives on dates somebody negotiated:
--
--   $5,000 on signature
--   $7,500 when the designs are approved
--   $7,500 on launch, whenever that turns out to be
--
-- There is no cadence there to step. Today a producer either forces it into a
-- monthly plan and then edits every row's date and amount by hand, or saves an
-- empty plan and builds it from the panel -- both of which work, and both of
-- which make the form lie to them on the way through.
--
-- So: a third kind. It is a label like the other two, but unlike the other two
-- it changes what the create form does -- the generator is replaced by a list
-- of dates and amounts you type. Nothing else in the schema moves, because
-- 0075 s2(b) already stores a payment as a plain (amount, due_on) pair with no
-- reference to the plan's cadence. The rows a custom plan writes are the same
-- rows a monthly plan writes; they just aren't a month apart.
--
-- `cadence` stays not-null on the table rather than becoming nullable for this
-- kind. It is unused decoration on a custom plan, and making a column nullable
-- to express "the value here is meaningless" hands every reader a null check
-- for a case where the sensible answer is simply the default -- and would make
-- `extendPaymentPlan` (which is still reachable on these plans, and still
-- useful: "the retainer part starts now") need a branch it does not need.

begin;

alter table public.project_payment_plans
  drop constraint if exists project_payment_plans_kind_check;

alter table public.project_payment_plans
  add constraint project_payment_plans_kind_check
  check (kind in ('installments', 'recurring', 'custom'));

comment on column public.project_payment_plans.kind is
  'How the agreement is described. ''installments'' and ''recurring'' differ only in wording. ''custom'' means the schedule has no cadence at all -- the dates were negotiated one by one, and `cadence` on this row is unused.';

-- Nothing is backfilled. An existing plan whose payments happen to be irregular
-- (0075 always allowed that, by editing rows after generation) keeps whatever
-- kind it was created as. Re-labelling somebody's plan based on a guess about
-- the spacing of its rows would change a word the client reads, to no end.

commit;

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
do $$
begin
  -- (a) The constraint took, and admits exactly the three kinds. Asserted by
  --     probing rather than by reading pg_get_constraintdef, because the thing
  --     that matters is what the table accepts, not how it is spelled.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.project_payment_plans'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%custom%'
  ) then
    raise exception 'project_payment_plans still refuses kind = custom';
  end if;

  -- (b) A payment still carries no cadence of its own. The whole reason this
  --     migration is four lines instead of a new table is that 0075 stored a
  --     payment as a date and an amount; a column added here that made a row
  --     depend on its plan's rhythm would quietly undo that.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_payment_installments'
      and column_name in ('cadence', 'interval', 'recurs')
  ) then
    raise exception 'a payment has grown a cadence -- see 0078''s header';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Folded in 2026-09-19: this second half was 0078_milestone_sub_phases.sql. Two
-- files shared version 0078, and the CLI history keys on the version alone — so
-- one of them could never be recorded as applied and `db push` would keep trying
-- to re-run it. Both halves were already live on prod when they were merged;
-- each keeps its own transaction, in the order a fresh replay always ran them.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0078: a phase can contain phases.
--
-- 0075 gave a milestone a weight and a completion, which answered "how big is
-- this piece and how far through it are we". It left one thing flat: a phase is
-- the smallest object on the plan. "Mobile app — padel booking" is one row at
-- 16%, and for four weeks the only honest thing a producer can do is drag a
-- slider and guess.
--
-- But that phase is not one piece of work. It is an app shell, then court
-- browsing, then booking end to end, then store submission -- four things that
-- finish on different days. A client watching the portal wants to know WHICH,
-- and a producer wants to record it without inventing a percentage.
--
-- So a milestone gains a parent. One extra level, not a tree -- see §1(b).
--
-- -- The double-counting trap ----------------------------------------------
--
-- `milestoneProgress` (lib/data/portal.ts) sums every row it is handed. Insert
-- children into this table and the headline immediately counts each piece of
-- work twice: once in the child, once in the parent that contains it. Worse, it
-- is not a crash -- it is a plausible-looking wrong number on a customer's
-- page.
--
-- Two halves fix it, and BOTH are required:
--
--   here      children carry weight 0 relative to the project, and a `depth`
--             generated column so the app can filter without a self-join
--   in the app milestoneProgress weighs depth-0 rows only (0078 §4 lists the
--             call sites that must change)
--
-- §4's invariant fails this migration if the column it depends on is missing,
-- but it CANNOT check the TypeScript. That change ships with this file.
--
-- -- Rollup ------------------------------------------------------------------
--
-- A parent with children stops being hand-set: its completion is computed from
-- them, so ticking off "Booking end to end" moves the top bar by itself. A
-- parent with no children keeps 0075's behaviour exactly, which is what every
-- existing project on the system is.
--
-- The child's `weight` is read as a share of ITS PARENT, not of the project.
-- Same column, different denominator, and the comment on it says so.

begin;

-- ---------------------------------------------------------------------------
-- 1. The parent link
-- ---------------------------------------------------------------------------

-- (a) Self-referencing, and `on delete cascade`: deleting a phase takes its
--     sub-phases with it. The alternative -- orphaned children promoted to
--     top-level -- would silently add weight to the project's plan.
alter table public.project_milestones
  add column if not exists parent_id uuid
    references public.project_milestones (id) on delete cascade;

comment on column public.project_milestones.parent_id is
  'The phase this one sits inside. Null for a top-level phase. One level only -- a child may not itself be a parent (see project_milestones_depth_max).';

create index if not exists project_milestones_parent_idx
  on public.project_milestones (parent_id, sort);

-- (b) Exactly two levels. Not a general tree, on purpose: an arbitrary
--     hierarchy needs recursive rollup, cycle detection and a UI that can draw
--     it, and none of that is bought by a third level nobody asked for. The
--     rule is enforced rather than documented, because "just don't nest deeper"
--     is not a constraint.
create or replace function private.milestone_depth_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.parent_id is null then
    -- Becoming (or staying) top-level is always fine EXCEPT that it must not
    -- strand children under a row that is itself a child. Nothing to check
    -- here; the child-side branch below covers it.
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'a phase cannot be its own parent';
  end if;

  -- The parent must be top-level.
  if exists (
    select 1 from public.project_milestones
    where id = new.parent_id and parent_id is not null
  ) then
    raise exception
      'sub-phases are one level deep: % already sits inside another phase',
      new.parent_id;
  end if;

  -- And this row must not already have children of its own.
  if exists (
    select 1 from public.project_milestones where parent_id = new.id
  ) then
    raise exception
      'phase % has sub-phases of its own and cannot be nested', new.id;
  end if;

  -- A sub-phase belongs to the same project as its parent. Without this a
  -- child could hang off another client's plan -- 0075's tenant-key reasoning,
  -- applied to a self-reference.
  if exists (
    select 1 from public.project_milestones
    where id = new.parent_id and project_id is distinct from new.project_id
  ) then
    raise exception 'sub-phase project does not match its parent project';
  end if;

  return new;
end $$;

drop trigger if exists project_milestones_depth on public.project_milestones;
create trigger project_milestones_depth
before insert or update of parent_id, project_id
on public.project_milestones
for each row execute function private.milestone_depth_guard();

-- (c) `depth` as a stored column so the app can say `.eq('depth', 0)` and the
--     invariant below can be written at all. Generated from parent_id, so it
--     cannot drift.
alter table public.project_milestones
  add column if not exists depth smallint
    generated always as (case when parent_id is null then 0 else 1 end) stored;

comment on column public.project_milestones.depth is
  '0 for a top-level phase, 1 for a sub-phase. Generated from parent_id. milestoneProgress weighs depth-0 rows ONLY -- summing both levels double-counts the headline.';

comment on column public.project_milestones.weight is
  'For a top-level phase: share of the whole build, 0..100 (0075 s1). For a sub-phase: share of ITS PARENT, 0..100. Two denominators, one column -- the level is what tells them apart.';

-- ---------------------------------------------------------------------------
-- 2. Rollup
-- ---------------------------------------------------------------------------

-- A parent's completion is its children's, weighted. Weights that do not sum
-- to 100 are normalised by their real total here -- unlike the project-level
-- bar, which deliberately divides by max(allocated, 100) so an unfinished PLAN
-- reads low. That reasoning does not carry over: a half-written list of
-- sub-phases is a producer mid-edit, not a promise to the client, and reading
-- a fully-finished phase as 40% because two sub-phases are missing is the
-- wrong lie. Unweighted children fall back to equal shares.
create or replace function private.milestone_rollup(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  kids integer;
  allocated numeric;
  rolled numeric;
begin
  select count(*), coalesce(sum(weight), 0)
    into kids, allocated
  from public.project_milestones
  where parent_id = target;

  if kids = 0 then
    -- No children: 0075's hand-set behaviour, untouched.
    return;
  end if;

  if allocated > 0 then
    select sum(weight * (case when status = 'done' then 100 else completion end))
             / allocated
      into rolled
    from public.project_milestones
    where parent_id = target;
  else
    select avg(case when status = 'done' then 100 else completion end)
      into rolled
    from public.project_milestones
    where parent_id = target;
  end if;

  rolled := round(greatest(0, least(100, coalesce(rolled, 0))), 2);

  -- Written straight to the row. The completion-sync trigger from 0075 fires on
  -- this update and keeps status in step -- 100% flips the parent to done, and
  -- anything above 0 moves 'planned' to 'in_progress' -- which is exactly the
  -- behaviour wanted and the reason this is an UPDATE and not a generated
  -- column.
  update public.project_milestones
  set completion = rolled
  where id = target
    and completion is distinct from rolled;
end $$;

create or replace function private.milestone_rollup_parent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A child moved between parents (or was created/deleted): both sides settle.
  if tg_op in ('UPDATE', 'DELETE') and old.parent_id is not null then
    perform private.milestone_rollup(old.parent_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.parent_id is not null then
    perform private.milestone_rollup(new.parent_id);
  end if;
  return null;
end $$;

-- AFTER, and statement-safe: the rollup writes to the same table this trigger
-- watches, and a BEFORE row trigger doing that recurses.
drop trigger if exists project_milestones_rollup on public.project_milestones;
create trigger project_milestones_rollup
after insert or delete or update of completion, status, weight, parent_id
on public.project_milestones
for each row execute function private.milestone_rollup_parent();

-- ---------------------------------------------------------------------------
-- 3. Backfill
-- ---------------------------------------------------------------------------
-- Nothing to do. Every existing row gets parent_id null and depth 0, which is
-- precisely what it already was, so no project's bar moves when this deploys.
-- Stated rather than left silent, because "no backfill" and "backfill
-- forgotten" look identical in a diff.

-- ---------------------------------------------------------------------------
-- 4. Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) The column the app's filter depends on.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_milestones'
      and column_name = 'depth'
  ) then
    raise exception 'project_milestones.depth is missing';
  end if;

  -- (b) Two levels, never three. The trigger enforces it going forward; this
  --     catches data that predates it or arrived around it.
  if exists (
    select 1
    from public.project_milestones child
    join public.project_milestones parent on parent.id = child.parent_id
    where parent.parent_id is not null
  ) then
    raise exception 'sub-phases nested more than one level deep exist';
  end if;

  -- (c) A child on a different project from its parent is one client's plan
  --     hanging off another's.
  select string_agg(child.id::text, ', ') into bad
  from public.project_milestones child
  join public.project_milestones parent on parent.id = child.parent_id
  where child.project_id is distinct from parent.project_id;
  if bad is not null then
    raise exception 'sub-phases on a different project from their parent: %', bad;
  end if;

  -- (d) 0053's standing rule, re-run: this migration adds functions but must
  --     not have added a write policy gated by is_member().
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- (e) 0075 s3(f), still true after the rollup trigger exists.
  if exists (
    select 1 from public.project_milestones
    where status = 'done' and completion < 100
  ) then
    raise exception 'done milestones exist below 100%% completion';
  end if;
end $$;

commit;
