-- Team presence: a self-set status + "available to call" flag on profiles,
-- shown in the dashboard's team widget next to last_seen_at (0025).
--
-- Same per-column grant pattern as 0015/0025: profiles UPDATE is revoked from
-- `authenticated` (0001) and re-granted per column. The profiles_update_own RLS
-- policy already scopes updates to id = auth.uid(), so a user can only ever set
-- their OWN status.

alter table public.profiles
  add column status_kind text not null default 'none'
    constraint profiles_status_kind_check check (
      status_kind in (
        'none', 'working', 'focus', 'meeting', 'break',
        'unavailable', 'off', 'custom'
      )
    ),
  add column status_text text
    constraint profiles_status_text_len check (char_length(status_text) <= 80),
  add column available_to_call boolean not null default false;

grant update (status_kind, status_text, available_to_call)
  on table public.profiles to authenticated;
