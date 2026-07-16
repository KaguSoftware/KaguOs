-- Fix: 0014 added profiles.showcase_mode but never granted UPDATE on it.
-- profiles has UPDATE revoked from `authenticated` (0001), re-granted per-column
-- for full_name (0001) and color (0006). Toggling showcase mode therefore hit
-- "permission denied for table profiles". Grant the column, same pattern as color.
-- (The profiles_update_own RLS policy already restricts the row to id = auth.uid().)

grant update (showcase_mode) on table public.profiles to authenticated;
