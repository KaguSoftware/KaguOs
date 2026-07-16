-- Per-member identity colors: everyone picks from a curated set (UI-enforced),
-- admins can override. Members may update their own color (column grant, same
-- pattern as full_name).

alter table public.profiles add column color text;

grant update (color) on table public.profiles to authenticated;
