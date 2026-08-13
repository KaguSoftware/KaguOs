-- 0058: Repair the self-enrollment policies in prod.
--
-- Drift, not a new idea. Self-enrollment shipped as migration 0052; `learn 2.1`
-- then corrected it — `is_member` → `can_write`, plus a write gate on leaving —
-- and renamed the file to 0057 in the same breath. But 0052 had already been
-- applied. Editing an applied migration changes the repo and nothing else, so
-- prod kept the original policies and the fix existed only on disk.
--
-- What prod actually had:
--
--   self_join   with_check: private.is_member('learn') AND ...
--   self_leave  using:      user_id = auth.uid() AND ...   (no write gate)
--
-- The consequence is the one 0053 exists to prevent: a Learn member with read
-- but not write could add themselves to any open sprint, then sit in the
-- standings unable to tick a single goal. Nothing has exploited it yet only
-- because no real sprint has ever had join_mode = 'open'. Both Kagu Learn
-- programs are about to, which is what makes this urgent rather than tidy.
--
-- On a database built from scratch these policies are already correct (0057
-- creates them this way), so this migration is a no-op replay there. Kept as
-- its own numbered step rather than folded into 0057, because pretending a
-- migration was always right is how the drift happened in the first place.

drop policy if exists sprint_participants_self_join on public.sprint_participants;
create policy sprint_participants_self_join on public.sprint_participants
  for insert to authenticated
  with check (
    private.can_write('learn')
    and user_id = (select auth.uid())
    and is_demo = false
    and exists (
      select 1 from public.sprints s
      where s.id = sprint_id
        and s.join_mode = 'open'
        and s.is_demo = false
        -- No joining a sprint that already ended: the record of who did it is
        -- closed once the last day passes.
        and s.ends_on >= (now() at time zone 'Europe/Istanbul')::date
    )
  );

drop policy if exists sprint_participants_self_leave on public.sprint_participants;
create policy sprint_participants_self_leave on public.sprint_participants
  for delete to authenticated
  using (
    private.can_write('learn')
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.sprints s
      where s.id = sprint_id
        and s.join_mode = 'open'
        and s.starts_on > (now() at time zone 'Europe/Istanbul')::date
    )
  );

-- ---- The same invariant 0053 §7 states, checked where it can actually fail.
-- This is the assertion that caught the drift: it refused to let the next
-- migration apply until the policies above were put right.
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
