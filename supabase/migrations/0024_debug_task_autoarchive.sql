-- Auto-archive debug tasks that have sat in 'done' for 7 days.
--
-- "Soft archive", not delete: the row stays (history is kept, reversible), it
-- just drops off the board. Two timestamps:
--   * done_at    — when the task entered 'done'. Set/cleared by a trigger so it's
--                  airtight no matter how the state changes. Editing a done task's
--                  title/priority does NOT touch done_at, so the 7-day clock only
--                  tracks time-in-done, exactly as intended.
--   * archived_at — when the daily job archived it (null = live). The board filters
--                  these out.
-- A daily pg_cron job archives anything done_at older than 7 days.

alter table public.debug_tasks
  add column done_at timestamptz,
  add column archived_at timestamptz;

-- Backfill: existing done tasks get a done_at so they enter the cycle. Best guess
-- is updated_at (their last change); undated ones fall back to created_at.
update public.debug_tasks
  set done_at = coalesce(updated_at, created_at)
  where state = 'done' and done_at is null;

-- Maintain done_at on every state transition into/out of 'done'.
create or replace function private.debug_track_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.state = 'done' and (old.state is distinct from 'done') then
    new.done_at := now();          -- just became done
  elsif new.state <> 'done' then
    new.done_at := null;           -- left done (reopened / back to in_progress)
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE so the computed done_at is written in the same row write.
create trigger debug_tasks_track_done_at
before update on public.debug_tasks
for each row execute function private.debug_track_done_at();

-- Also handle a task inserted straight as 'done' (unusual, but valid).
create or replace function private.debug_set_done_at_insert()
returns trigger
language plpgsql
as $$
begin
  if new.state = 'done' and new.done_at is null then
    new.done_at := now();
  end if;
  return new;
end;
$$;

create trigger debug_tasks_set_done_at_insert
before insert on public.debug_tasks
for each row execute function private.debug_set_done_at_insert();

-- The archiver: soft-archive tasks done for more than 7 days. SECURITY DEFINER
-- so the scheduled job (no user context) can write regardless of RLS.
create or replace function private.archive_stale_done_tasks()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.debug_tasks
    set archived_at = now()
    where state = 'done'
      and archived_at is null
      and done_at is not null
      and done_at < now() - interval '7 days';
$$;

-- Schedule it daily at 03:00 UTC via pg_cron.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'archive-stale-done-debug-tasks',
  '0 3 * * *',
  $$ select private.archive_stale_done_tasks(); $$
);
