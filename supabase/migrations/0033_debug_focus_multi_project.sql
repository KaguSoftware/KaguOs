-- Debug focus: one item can cover SEVERAL boards.
--
-- 0032 made focus a list of items but pinned each item to ONE project. That's
-- half the model: "Pet app and Site both need their bugs cleared" is a single
-- instruction about two boards, and forcing it into two identical items is
-- duplication the admin has to keep in sync by hand.
--
-- So an item's target becomes a SET of project ids:
--   []            → the whole board (what project_id IS NULL meant)
--   [a]           → one board (what 0032 supported)
--   [a, b, c]     → these boards share one instruction
--
-- Still safe to reshape in place: debug_focus has no rows worth keeping
-- (checked before writing), so `project_id` is dropped rather than backfilled.

alter table public.debug_focus
  add column project_ids uuid[] not null default '{}';

-- The partial unique index from 0032 enforced one-item-per-project. It cannot
-- express "these arrays must not overlap", and the rule is no longer wanted
-- anyway: two items may legitimately name the same board (say a broad "Pet app
-- — fixes" plus a sharper "Pet app — the login crash first"). Ordering by rank
-- is what disambiguates them now.
drop index if exists debug_focus_one_per_project_idx;

alter table public.debug_focus drop column if exists project_id;

-- Read path is unchanged: "every active item, in rank order".
