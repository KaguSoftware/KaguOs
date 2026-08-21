-- 0069: marketing money stays in THE ledger — it just gets a lens.
--
-- The temptation was a second transactions table inside marketing. That is how
-- two totals stop agreeing. Instead the existing `transactions` table gains a
-- `category` (check-constrained; 'marketing' is the first and so far only
-- value) and an optional link to the campaign the money served. The Budget tab
-- in /marketing is a filtered view over the same rows the Finance tab shows —
-- one source of truth, two lenses.
--
-- `marketing_campaigns.spend_actual` is untouched and remains the ad-import
-- column (money spent inside ad platforms, on the client's card — see
-- MARKETING.md D2/D3). Ledger rows are Kagu's own pocket: gear, boosts we pay
-- for ourselves, freelancers. The Budget screen labels the two apart.

alter table public.transactions
  add column category text
    check (category is null or category in ('marketing')),
  add column campaign_id uuid
    references public.marketing_campaigns (id) on delete set null;

-- The Budget tab's read: marketing rows by date. Partial — the overwhelming
-- majority of ledger rows have no category and would be dead weight.
create index transactions_marketing_idx
  on public.transactions (is_demo, category, occurred_on desc)
  where category is not null;

-- ---------------------------------------------------------------------------
-- RLS: the marketing team can see and write ITS OWN slice of the ledger
-- ---------------------------------------------------------------------------
-- Without these the Budget tab fails in the worst way 0053 warns about: not
-- "permission denied" but an empty page, because the transactions policies are
-- management-only. Marketing gets exactly the marketing-category rows —
-- reading the whole company ledger from this section would widen the finance
-- gate through a side door.
--
-- Write policies gate on can_write (0053's read-tier rule) and INSERT pins
-- created_by, same as every other section. UPDATE/DELETE are confined to
-- marketing rows too: a typo'd expense should be fixable where it was logged.
-- The `with check` on UPDATE keeps the category — a marketing member must not
-- be able to relabel a row OUT of the slice they're allowed to touch.

create policy transactions_marketing_select on public.transactions
  for select to authenticated
  using (private.is_member('marketing') and category = 'marketing');

create policy transactions_marketing_insert on public.transactions
  for insert to authenticated
  with check (
    private.can_write('marketing')
    and category = 'marketing'
    and created_by = (select auth.uid())
  );

create policy transactions_marketing_update on public.transactions
  for update to authenticated
  using (private.can_write('marketing') and category = 'marketing')
  with check (private.can_write('marketing') and category = 'marketing');

create policy transactions_marketing_delete on public.transactions
  for delete to authenticated
  using (private.can_write('marketing') and category = 'marketing');

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- 0053's standing rule: no write policy may gate on is_member().
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- Every marketing-facing transactions policy must be confined to the
  -- category. A policy on this table naming 'marketing' membership without the
  -- category filter would hand the section the whole company ledger.
  select string_agg(policyname, ', ') into bad
  from pg_policies
  where schemaname = 'public' and tablename = 'transactions'
    and coalesce(qual, '') || coalesce(with_check, '') like '%''marketing''%'
    and coalesce(qual, '') || coalesce(with_check, '') not like '%category%';
  if bad is not null then
    raise exception 'marketing transactions policy blind to category: %', bad;
  end if;
end $$;
