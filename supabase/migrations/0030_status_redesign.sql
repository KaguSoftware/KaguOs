-- Status redesign: presets as shortcuts, not modes.
--
-- The presence model becomes three honest signals: a live online dot (client
-- presence channels — no schema), this manual status, and available_to_call.
-- The status itself is now emoji + optional note that ANY preset can carry —
-- there's no longer a special "custom" mode that alone unlocks free text.
--
-- Changes:
--   1. `status_emoji` — the emoji shown on the avatar badge. Preset-seeded
--      (🛠️ working, 🧠 focus, …) or user-picked for a custom status. Null/'' =
--      no emoji. Short: a couple codepoints, capped defensively at 16 chars.
--   2. Drop the `unavailable` preset from the kind CHECK — it's redundant now
--      that available_to_call=false IS unavailability. Any rows still on it are
--      migrated to 'none' first so the new CHECK can be applied.
--
-- Same per-column grant pattern as 0027/0028: profiles UPDATE is revoked from
-- `authenticated` (0001) and re-granted per column; profiles_update_own already
-- scopes writes to id = auth.uid(), so a user only ever sets their OWN status.

alter table public.profiles
  add column status_emoji text
    constraint profiles_status_emoji_len check (char_length(status_emoji) <= 16);

grant update (status_emoji) on table public.profiles to authenticated;

-- Retire the 'unavailable' kind. Move any existing rows off it before tightening
-- the CHECK (a status that was "unavailable" becomes no status — the user's
-- available_to_call flag now carries that meaning).
update public.profiles
  set status_kind = 'none', status_text = null, status_until = null
  where status_kind = 'unavailable';

alter table public.profiles
  drop constraint profiles_status_kind_check;

alter table public.profiles
  add constraint profiles_status_kind_check check (
    status_kind in ('none', 'working', 'focus', 'meeting', 'break', 'off', 'custom')
  );

-- Backfill emoji for existing preset statuses so they render with a badge
-- immediately (custom rows keep whatever they had, i.e. none).
update public.profiles set status_emoji = '🛠️' where status_kind = 'working'  and status_emoji is null;
update public.profiles set status_emoji = '🧠' where status_kind = 'focus'    and status_emoji is null;
update public.profiles set status_emoji = '📅' where status_kind = 'meeting'  and status_emoji is null;
update public.profiles set status_emoji = '☕' where status_kind = 'break'    and status_emoji is null;
update public.profiles set status_emoji = '🌙' where status_kind = 'off'      and status_emoji is null;
