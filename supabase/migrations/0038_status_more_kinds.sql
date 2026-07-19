-- More status presets: the existing five only covered the working day, so
-- there was no honest way to say "I'm asleep" or "I'm just chilling" other
-- than a custom status. Adds four everyday states — eating, away ("Not home"),
-- chilling, sleeping — bringing the picker to nine chips (a clean 3x3 grid).
--
-- Presets remain SHORTCUTS (0030): each one only seeds an emoji, a label and a
-- default available_to_call. Nothing here changes the shape of the data, so
-- this is purely a widening of the kind CHECK — no backfill, no data movement.
-- Existing rows are untouched and every old kind stays valid.

alter table public.profiles
  drop constraint profiles_status_kind_check;

alter table public.profiles
  add constraint profiles_status_kind_check check (
    status_kind in (
      'none', 'working', 'focus', 'meeting', 'break',
      'eating', 'away', 'chilling', 'sleeping', 'off', 'custom'
    )
  );
