-- Manual FX rates for the Finance tab. TRY is the base currency; a rate says
-- how many TRY one unit of the foreign currency is worth. Entered by hand,
-- stored until changed.

create table public.fx_rates (
  currency text primary key check (currency in ('USD', 'EUR')),
  rate_to_try numeric(12, 4) not null check (rate_to_try > 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger fx_rates_updated_at
before update on public.fx_rates
for each row execute function private.set_updated_at();

alter table public.fx_rates enable row level security;

create policy fx_rates_all on public.fx_rates
  for all to authenticated
  using (private.is_member('management'))
  with check (private.is_member('management'));
