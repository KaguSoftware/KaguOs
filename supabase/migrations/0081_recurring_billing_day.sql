-- 0081: the day a recurring item actually bills.
--
-- `recurring_items` knew what a subscription costs and how often, but never
-- when the money moves. So the list could say "Vercel Pro · monthly · since
-- 12 Aug" and still not answer the only question anyone asks of that row:
-- when's the next one?
--
-- `started_on` is a bad stand-in for it. It's the day we started PAYING, which
-- is routinely not the day the card gets charged -- a trial that converted on
-- the 1st, a plan moved off someone's personal card mid-month, an annual
-- retainer agreed in March that invoices every 15th. Reading a billing date out
-- of it quietly invents a schedule.
--
-- So the billing day becomes its own fact, and it is NULLABLE on purpose: null
-- means "the day it started", which is exactly what every row written before
-- this migration already implied. No backfill, no rows silently given a
-- schedule nobody entered.
--
-- 1..31 is deliberately allowed. A card billed on the 31st is a real thing, and
-- February is not a reason to refuse to store the fact -- the short months are
-- handled where the schedule is computed (`nextBillingOn` in lib/finance.ts,
-- which clamps to the last day of the month, the same rule as `addMonths` and
-- the same rule the banks use).
--
-- For a yearly item the day pairs with `started_on`'s MONTH: "every 15 March".
-- One column, because the month of a yearly charge is never in doubt the way
-- the day is.

alter table public.recurring_items
  add column billing_day smallint
    check (billing_day is null or billing_day between 1 and 31);

comment on column public.recurring_items.billing_day is
  'Day of month the charge lands (1-31). Null = the day it started. Clamped to the last day in shorter months.';
