-- Only the assignee (or an admin) may release a claim.
--
-- The board's claim rule was only ever half-enforced. `debug_tasks_insert` and
-- `debug_tasks_update` both check the NEW assignee_id ("you may only assign to
-- yourself"), which stops you taking a task for someone else — but nothing
-- looked at the OLD one, so clearing a teammate's claim passed every check.
-- Any Debug member could quietly unclaim anyone's work.
--
-- Why a trigger and not the policy: RLS splits the two rows across two clauses
-- — `using` sees the old row, `with check` sees the new one — and neither can
-- compare them. "assignee_id CHANGED from someone else's to something else" is
-- a statement about both rows at once, so it belongs in a before-update
-- trigger, which is the only place both are in scope.
--
-- Deliberately narrow: this guards the assignee column ONLY. Everyone in Debug
-- can still edit anyone's title, priority, board, and state — the board is
-- collaborative and that part is working as intended. What it stops is one
-- person's claim being taken away by another.

create or replace function private.debug_guard_unclaim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nothing to police unless the claim itself is moving.
  if new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  -- An unclaimed task is fair game (that's `claimTask`, first click wins), and
  -- admins can reassign anything.
  if old.assignee_id is null or private.is_admin() then
    return new;
  end if;

  if old.assignee_id <> (select auth.uid()) then
    raise exception 'Only the assignee can release this claim'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger debug_tasks_guard_unclaim
before update on public.debug_tasks
for each row execute function private.debug_guard_unclaim();
