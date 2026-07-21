-- Reminders can carry a due date.
--
-- Until now a reminder was text + scope + done, with no notion of WHEN — so
-- nothing could sort by urgency and the dashboard's "Needs you" strip had no
-- way to surface one that had slipped. A reminder you forget is a reminder that
-- didn't work.
--
-- Nullable on purpose, and that nullability carries meaning:
--
--   due_on IS NULL      → a note to self. Exactly what every existing row is,
--                         and what most reminders should stay — the composer
--                         does not require a date.
--   due_on IS NOT NULL  → something with a deadline. Sorts first, reads in the
--                         danger tone once past, and counts toward "Needs you".
--
-- No backfill (every current row is legitimately undated) and no RLS change:
-- the owner/team policies from 0008 gate the ROW, and this adds a column to a
-- row that is already correctly gated.
--
-- ⚠️ Deliberately NO notification on the due date (Parsa, 2026-07-21). Reminders
-- are personal notes; a system that pings you about them is how people learn to
-- ignore the app's notifications entirely. Show and sort only.

alter table public.reminders
  add column due_on date;

-- The dashboard counts overdue reminders per person on every load.
create index reminders_due_idx on public.reminders (due_on) where due_on is not null;
