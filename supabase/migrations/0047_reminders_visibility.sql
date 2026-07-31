-- Re-assert reminders visibility: a personal ("Just me") reminder is readable
-- by its owner ONLY; team ones by everyone.
--
-- This is exactly the rule 0008 created — restated so a database whose policy
-- has drifted from the repo (edited by hand in the dashboard, restored from an
-- old dump) heals on the next migration run. Personal reminders are private
-- notes, and this is the wall that keeps them that way; the dashboard query
-- and the panel now state the same filter, but RLS is the layer that cannot
-- be bypassed by a future caller forgetting to.

alter table public.reminders enable row level security;

drop policy if exists reminders_select on public.reminders;
create policy reminders_select on public.reminders
  for select to authenticated
  using (
    scope = 'team' or owner_id = (select auth.uid())
  );
