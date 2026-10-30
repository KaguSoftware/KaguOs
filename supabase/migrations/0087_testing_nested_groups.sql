-- 0087: Testing — nested groups.
--
-- A check's `area` becomes a path: "Mobile app > Home > Booking card". The
-- app, the page and the component each roll up their own pass count, so every
-- component can be checked and its standing seen at the level above it. A
-- plain "Auth" is a one-level path, so existing rows need no change.
--
-- No new table: groups exist where checks do, and the path rides on the row
-- the debug task already quotes ("Area: Mobile app > Home > Booking card"), so
-- a failure tells the developer exactly where to look.
--
-- The only schema change is room for the path. 60 characters fit one name,
-- not three; 200 matches lib/testing.ts MAX_GROUP_LENGTH.

begin;

alter table public.test_cases drop constraint if exists test_cases_area_check;

alter table public.test_cases
  add constraint test_cases_area_check
  check (area is null or char_length(area) between 1 and 200);

commit;
