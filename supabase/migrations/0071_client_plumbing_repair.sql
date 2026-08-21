-- 0071: repair the client plumbing 0068 quietly broke.
--
-- 0068 dropped `client_users`, claiming the 0062 functions were "harmless with
-- no client rows". They were not: a SQL function body is not validated when a
-- table it references is dropped — it fails at CALL time with "relation does
-- not exist". Two callers broke:
--
--   * public.session_context() — its 'client_id' key subqueries client_users,
--     so the RPC errored for EVERY signed-in user. The app reads a failed
--     session_context as "signed out" and redirects to /login; the proxy sees
--     the still-valid JWT on /login and redirects back to /. Result:
--     ERR_TOO_MANY_REDIRECTS for everyone, on every page, while anonymous
--     visitors saw nothing wrong.
--   * private.client_id() — still called by the clients_select policy (0062),
--     so any read of `clients` errored too.
--
-- Both are redefined against the world after 0068: no client principals exist.
-- The session_context keys stay in place (additive-only rule, 0053 §6) — they
-- just answer null, which is exactly what the app's isClient() path already
-- reads for members. If client logins ever return, these bodies are the seam
-- to reopen.

create or replace function private.client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select null::uuid;
$$;

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
    ),
    'access', coalesce(
      (
        select jsonb_object_agg(m.section, m.access)
        from public.section_memberships m
        where m.user_id = p.id
      ),
      '{}'::jsonb
    ),
    'kind', p.kind,
    'client_id', null
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

-- Prove the repair: both functions must now plan and run without touching a
-- dropped relation. Errors here abort the migration.
do $$
begin
  perform private.client_id();
  perform public.session_context();
end $$;
