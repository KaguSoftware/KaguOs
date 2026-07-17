-- One round-trip for the session context.
--
-- Every page and every server action needs the same three things before it can
-- do anything: the signed-in user's profile, their section memberships, and
-- whether they're in showcase mode. That was two PostgREST queries (profiles +
-- section_memberships). Parallel, so one round-trip in the best case — but the
-- database lives in ap-northeast-1 and the team is in Istanbul, so a round-trip
-- costs ~305ms MEASURED, and it gates every other query on the page. The
-- database itself answers this in well under a millisecond; the cost is the
-- distance, so the only thing worth optimising is the NUMBER of trips.
--
-- This collapses those two queries into one RPC returning a single JSON object.
-- It is a straight latency win, and it gives the app one authoritative place
-- where "who is this user" is answered.
--
-- SECURITY: security definer + a pinned empty search_path, matching the other
-- private.* helpers. It reads ONLY the caller's own row — auth.uid() is taken
-- from the verified JWT inside the function and can't be spoofed by the client,
-- so there is no parameter to tamper with. It returns nothing a user can't
-- already read about themselves under the existing profiles_select_own /
-- memberships RLS policies; it just returns it in one trip instead of two.

create or replace function public.session_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'sections', coalesce(
      (
        select jsonb_agg(m.section)
        from public.section_memberships m
        where m.user_id = p.id
      ),
      '[]'::jsonb
    )
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

-- Callable by signed-in users only. Anonymous callers get auth.uid() = null,
-- which matches no row and returns null anyway, but there's no reason to grant.
revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;
