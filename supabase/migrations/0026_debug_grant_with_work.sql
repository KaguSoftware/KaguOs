-- Company rule: everyone in Work is ALWAYS also in Debug (same rule as Learn).
-- Work members were only seeing the Debug board if someone remembered to grant
-- the debug section by hand — most had no membership row, so the sidebar link,
-- the /debug page guard, and the debug_tasks RLS select all shut them out.

-- (a) granting work auto-grants learn AND debug (extends the 0001 function;
-- the existing memberships_grant_learn_with_work trigger keeps calling it)
create or replace function private.grant_learn_with_work()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.section = 'work' then
    insert into public.section_memberships (user_id, section)
    values (new.user_id, 'learn'), (new.user_id, 'debug')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- (b) neither learn nor debug can be removed while work is held (checked at
-- commit so removing all in one statement, or deleting a whole user, still works)
create or replace function private.check_work_implies_learn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.section in ('learn', 'debug') and exists (
    select 1 from public.section_memberships w
    where w.user_id = old.user_id and w.section = 'work'
  ) and not exists (
    select 1 from public.section_memberships s
    where s.user_id = old.user_id and s.section = old.section
  ) then
    raise exception 'Work members must also be in % — remove Work first', old.section;
  end if;
  return old;
end;
$$;

-- (c) backfill: every current work member gets debug (and learn, for any row
-- that predates the 0001 trigger)
insert into public.section_memberships (user_id, section)
select w.user_id, s.section
from public.section_memberships w
cross join (values ('learn'), ('debug')) as s (section)
where w.section = 'work'
on conflict do nothing;
