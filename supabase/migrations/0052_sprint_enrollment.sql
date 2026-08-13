-- 0052: Sprints can be open to join.
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

create policy sprint_participants_self_join on public.sprint_participants
  for insert to authenticated
  with check (
    private.is_member('learn')
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
create policy sprint_participants_self_leave on public.sprint_participants
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sprints s
      where s.id = sprint_id
        and s.join_mode = 'open'
        and s.starts_on > (now() at time zone 'Europe/Istanbul')::date
    )
  );
