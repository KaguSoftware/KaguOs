-- 0057: Sprints can be open to join.
--
-- Until now the roster was admin-assigned only: a sprint appeared for you
-- because someone put you in it. `join_mode = 'open'` lets any learn member add
-- themselves, which is what makes /learn a catalogue you browse rather than a
-- list you're handed. 'assigned' stays the default, so nothing that exists
-- changes behaviour.

alter table public.sprints
  add column join_mode text not null default 'assigned'
    check (join_mode in ('assigned', 'open'));

-- ---- Self-enrollment. These sit alongside sprint_participants_admin_write
-- (policies are OR'd), so admins keep full control of every roster.
--
-- Gated on can_write, not is_member (0053): a roster is section content, and a
-- view-only Learn member who joined themselves would sit in the standings
-- unable to tick a single goal. It also keeps the invariant 0053 checks — no
-- write policy may consult is_member().

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

-- Leaving is only allowed before the sprint starts. Once it's running you're in
-- the standings, and quietly deleting yourself would erase ticks other people
-- have already seen. Admins can still remove anyone at any time.
-- Same can_write gate as joining: the two halves of one decision.
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

-- ---- Invariant, re-checked rather than trusted (same rule as 0053 §7).
-- 0053 enforced "no write policy consults is_member()" at its own migration
-- time, which cannot see policies added afterwards. These two are the first
-- write policies written since, so the check is repeated here — cheap, and it
-- catches the exact mistake this migration nearly shipped.
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
