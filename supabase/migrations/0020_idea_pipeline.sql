-- Idea pipeline (Phase 1): up/down votes, unanimous auto-promote, funnel stage.
--
-- The Ideas board was a static post + upvote counter. This turns it into a
-- decision funnel:
--   * votes gain a value (+1 / -1) so a downvote is a real signal, not an absence
--   * each idea snapshots how many people must unanimously upvote it to auto-ship
--     (required_count) at the moment it's created — later joiners can't un-pass it
--   * a stage column tracks the funnel (open -> discussing -> accepted -> promoted
--     / rejected), separate from the existing status
--
-- The unanimous denominator is "everyone with Work access" = admins (who reach
-- every section via is_admin()) UNION people with a 'work' section_membership row.
-- That's computed in private.work_access_count(), SECURITY DEFINER so it sees all
-- profiles/memberships regardless of the caller's RLS.

-- ========================================================================
-- Votes gain a value. Existing rows are all upvotes, so default +1 backfills.
-- ========================================================================
alter table public.idea_votes
  add column value smallint not null default 1 check (value in (-1, 1));

-- ========================================================================
-- Ideas gain the unanimous snapshot + the funnel stage, and 'rejected' status.
-- ========================================================================
alter table public.ideas
  add column required_count int,
  add column stage text not null default 'open'
    check (stage in ('open', 'discussing', 'accepted', 'promoted', 'rejected'));

-- Widen status to allow an explicit rejection (mirror of 'promoted').
alter table public.ideas drop constraint ideas_status_check;
alter table public.ideas
  add constraint ideas_status_check
  check (status in ('open', 'promoted', 'archived', 'rejected'));

-- ========================================================================
-- private.work_access_count(): how many distinct people can access Work.
-- The denominator for a unanimous vote. SECURITY DEFINER: it must see every
-- profile + membership, not just the caller's RLS-visible slice.
-- ========================================================================
create or replace function private.work_access_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from (
    select p.id from public.profiles p where p.is_admin
    union
    select m.user_id from public.section_memberships m where m.section = 'work'
  ) as work_people;
$$;

grant execute on function private.work_access_count() to authenticated;

-- PostgREST only exposes the `public` schema, so server actions call this thin
-- public wrapper (supabase.rpc('work_access_count')). Gated to Work members /
-- admins — the count itself is harmless, but there's no reason to expose it wider.
create or replace function public.work_access_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_member('work') or private.is_admin()
    then private.work_access_count()
    else null
  end;
$$;

grant execute on function public.work_access_count() to authenticated;

-- Backfill required_count on existing open ideas from the current access count,
-- so ideas that predate this migration participate in the unanimous rule too.
update public.ideas
  set required_count = private.work_access_count()
  where required_count is null;

-- Keep stage roughly in step with the existing status for old rows.
update public.ideas set stage = 'promoted' where status = 'promoted';
update public.ideas set stage = 'rejected' where status = 'rejected';
