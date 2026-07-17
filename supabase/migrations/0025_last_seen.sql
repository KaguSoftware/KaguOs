-- "Last seen" presence: when each user was last active in the app.
--
-- profiles has UPDATE revoked from `authenticated` (0001) and re-granted per
-- column (full_name 0001, color 0006, showcase_mode 0015). Same pattern here:
-- add the column, then GRANT it so a user can stamp their OWN row. The existing
-- profiles_update_own RLS already scopes the row to id = auth.uid(), so this
-- can't be used to touch anyone else's timestamp.
--
-- The write is throttled in getSessionContext (only when stale by >5 min) and
-- runs fire-and-forget, so this costs at most one tiny update per user per 5 min.

alter table public.profiles add column last_seen_at timestamptz;

grant update (last_seen_at) on table public.profiles to authenticated;
