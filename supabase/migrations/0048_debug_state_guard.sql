-- State needs a holder: an unclaimed task's state can't change.
--
-- The board tracks state as "how far along is the person on it" — open, in
-- progress, done. With nobody on it there is no progress to report, yet the
-- state pills (and the 1/2/3 keys, and the bulk dropdown) happily flipped
-- unclaimed rows. The server actions now refuse this; the trigger makes the
-- database agree, the same app/DB split as 0035's unclaim guard.
--
-- Same shape as 0035 and for the same reason: "state CHANGED while the task
-- is unclaimed" compares the old row with the new one, and RLS clauses can't
-- do that — `using` sees the old row, `with check` the new, never both.
--
-- Deliberately no admin bypass: the rule is about what state MEANS, not about
-- permission. Claiming first is one click.
--
-- Untouched flows, checked against the other triggers:
--   * INSERT — a new task is born open and unclaimed; this fires on UPDATE.
--   * Claim + state in ONE write is allowed: the row gains its holder in the
--     same statement, so NEW.assignee_id is set.
--   * The auto-archiver (0024) writes archived_at, never state.

create or replace function private.debug_guard_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state is distinct from old.state and new.assignee_id is null then
    raise exception 'Claim the task before changing its state'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger debug_tasks_guard_state
before update on public.debug_tasks
for each row execute function private.debug_guard_state();
