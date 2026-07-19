-- Debug focus: several items at once, not one blended sentence.
--
-- 0031 shipped debug_focus as ONE active row holding one sentence. That forces
-- every qualifier to smear across every project: "Focus on Pet app and Site —
-- fixes and features" tells nobody which board needs which. The real situation
-- is usually two fronts at once — Pet app needs its bugs cleared, Site needs
-- features shipped — and those are two DIFFERENT instructions.
--
-- So the unit becomes a focus ITEM: one board (or the whole board) plus that
-- board's own qualifiers. Several can be active together, ordered by rank.
--
-- Safe to reshape in place: debug_focus has zero rows in prod (checked before
-- writing this), so there is nothing to migrate and no back-compat to keep.

-- `body` stays the rendered sentence — it is what everyone reads, and keeping
-- it means the banner never has to re-derive prose from parts.
alter table public.debug_focus
  -- Which board this item is about. Null = the whole board (a general
  -- instruction like "ship week, finish what you claimed").
  add column project_id uuid references public.projects (id) on delete cascade,
  -- The structured picks behind the sentence, so an item can be re-opened and
  -- edited later instead of retyped. Shape: {kinds,states,priorities,order}
  -- (project lives in project_id). jsonb, not columns: it is opaque to the DB,
  -- read only by the composer, and the vocabulary will keep moving.
  add column parts jsonb not null default '{}'::jsonb,
  -- Hand-ordered: the top item is what the team should look at first.
  add column rank integer not null default 0;

-- The banner reads "every active item, in rank order" on every board load.
drop index if exists debug_focus_active_idx;
create index debug_focus_active_rank_idx
  on public.debug_focus (active, rank, created_at);

-- One item per board at a time — re-focusing a board replaces its item rather
-- than stacking duplicates. Partial so retired rows don't collide, and so the
-- null-project ("whole board") item is exempt: NULLs never conflict in a
-- unique index, which is the behaviour we want anyway.
create unique index debug_focus_one_per_project_idx
  on public.debug_focus (project_id)
  where active and project_id is not null;
