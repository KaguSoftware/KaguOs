-- Finance tab: recurring money flows (subscriptions we pay, retainers we receive)
-- alongside one-time transactions. Management-only, same as transactions.

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  name text not null,
  counterparty text,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  cadence text not null default 'monthly' check (cadence in ('monthly', 'yearly')),
  started_on date not null,
  canceled_on date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (canceled_on is null or canceled_on >= started_on)
);
create index recurring_items_type_idx on public.recurring_items (type);

alter table public.recurring_items enable row level security;

create policy recurring_items_all on public.recurring_items
  for all to authenticated
  using (private.is_member('management'))
  with check (private.is_member('management'));
