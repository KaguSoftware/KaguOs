-- 0068: the marketing section pivots to Kagu's own brand.
--
-- The 2026-08-21 decision: the first (and for now only) "client" of the
-- marketing arm is Kagu itself. The client machinery from 0062–0064 stays —
-- every tenant FK, every RLS policy and the portal keep working, so a real
-- external client can return without a second build — but the section's own
-- work needs a row to hang creatives on, because `creatives.client_id` is NOT
-- NULL by design and relaxing it would gut the composite tenant keys.
--
-- So: a HOUSE client. One canonical "Kagu" row per demo flag, found by a
-- boolean rather than by name (names are data, flags are structure). The UI
-- defaults to it and hides the client picker while it is the only client; the
-- status ladder skips the client-approval rung for its videos (there is no
-- client to wait on — see nextStatus() in src/lib/creatives.ts).

alter table public.clients
  add column is_house boolean not null default false;

-- Exactly one house client per mode (real / showcase). A second one would make
-- "the house client" ambiguous in every form default and every ladder check.
create unique index clients_one_house_per_mode
  on public.clients (is_demo)
  where is_house;

-- The rows themselves. `created_by` stays null — this client belongs to the
-- company, not to whoever ran the migration.
insert into public.clients (name, status, currency, engagement_kind, ad_account_owner, is_house, is_demo)
values
  ('Kagu', 'active', 'TRY', 'project', 'kagu', true, false),
  ('Kagu', 'active', 'TRY', 'project', 'kagu', true, true);

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  -- Both modes have their house row, and only one each.
  select count(*) into n from public.clients where is_house and not is_demo;
  if n <> 1 then
    raise exception 'expected exactly 1 real house client, found %', n;
  end if;
  select count(*) into n from public.clients where is_house and is_demo;
  if n <> 1 then
    raise exception 'expected exactly 1 demo house client, found %', n;
  end if;
end $$;
