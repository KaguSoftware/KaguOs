-- 0068: the marketing section is rebuilt as an agency dashboard — simple posts
-- per client, no client logins, no approval portal.
--
-- The 2026-08-21 decision, second pass. Client stays the root object (Kagu's
-- marketing team works for other companies), but the heavyweight production
-- machinery from 0063–0064 goes: the ten-rung creative ladder, the timecoded
-- review thread, and the client login accounts that existed to click Approve.
-- Approvals happen over WhatsApp; what the team needs is a schedule, budgets,
-- and a record of what went out — per client.
--
-- ⚠️ DESTRUCTIVE. Drops `creatives`, `creative_reviews` and `client_users`.
-- Same claim as 0063 §8 made for `marketing_posts` v1: nothing in this section
-- is in real use. Verify before applying —
--
--     select count(*) from public.creatives;
--     select count(*) from public.creative_reviews;
--     select count(*) from public.client_users;
--
-- — and if any is non-zero and the rows matter, export first. CASCADE takes
-- policies, triggers and indexes with them. `clients` and
-- `marketing_campaigns` are NOT dropped — they are the model's spine.
--
-- The client-principal plumbing from 0062 (profiles.kind, private.client_id(),
-- is_client(), the session_context keys) stays in the database: session_context
-- is additive-only by rule (0053 §6), the functions are harmless with no
-- client rows, and if client logins ever return the seam is still there.

drop table if exists public.creative_reviews cascade;
drop table if exists public.creatives cascade;
drop table if exists public.client_users cascade;

-- ---------------------------------------------------------------------------
-- The new unit of work: a post
-- ---------------------------------------------------------------------------
-- One row per thing that goes out for a client. Four states, not ten: the
-- old ladder encoded a production process (script → shoot → edit → review)
-- that the team coordinates off-app; the section only needs to know whether a
-- post is an idea, being made, dated, or out.
create table public.marketing_posts (
  id uuid primary key default gen_random_uuid(),

  -- The tenant, first in the table for the same reason it is first in every
  -- policy question: everything in this section belongs to a client.
  client_id uuid not null references public.clients (id) on delete cascade,
  -- The campaign it ran under, if any. Plain FK (no composite tenant key):
  -- with no client principals reading these rows, a mislinked campaign is an
  -- internal data bug, not a leak — the form only offers same-client options.
  campaign_id uuid references public.marketing_campaigns (id) on delete set null,

  title text not null default 'Untitled post',
  channel text not null default 'instagram',

  status text not null default 'idea'
    check (status in ('idea', 'making', 'scheduled', 'posted')),

  publish_on date,
  -- The live link once it's out.
  url text,

  owner_id uuid references public.profiles (id) on delete set null,
  notes text,

  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The two reads the section serves: one client's board, and the cross-client
-- schedule by date.
create index marketing_posts_client_idx
  on public.marketing_posts (is_demo, client_id, status, publish_on);
create index marketing_posts_schedule_idx
  on public.marketing_posts (is_demo, publish_on)
  where publish_on is not null;

create trigger marketing_posts_updated_at
before update on public.marketing_posts
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — members only. No client principals read this section any more.
-- ---------------------------------------------------------------------------
alter table public.marketing_posts enable row level security;

create policy marketing_posts_select on public.marketing_posts
  for select to authenticated
  using (private.is_member('marketing') or (is_demo and private.in_showcase()));

create policy marketing_posts_insert on public.marketing_posts
  for insert to authenticated
  with check (private.can_write('marketing') and created_by = (select auth.uid()));

create policy marketing_posts_update on public.marketing_posts
  for update to authenticated
  using (private.can_write('marketing'))
  with check (private.can_write('marketing'));

create policy marketing_posts_delete on public.marketing_posts
  for delete to authenticated
  using (private.can_write('marketing'));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  execute 'alter table public.marketing_posts replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'marketing_posts'
  ) then
    execute 'alter publication supabase_realtime add table public.marketing_posts';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- 0053's standing rule holds after the drops and the new policies.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- With client_users gone, NOTHING may be client-writable any more.
  select string_agg(format('%s.%s (%s)', schemaname, tablename, policyname), ', ')
    into bad
  from pg_policies
  where schemaname = 'public'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(with_check, '') like '%client_id()%';
  if bad is not null then
    raise exception 'client-writable policy survived the teardown: %', bad;
  end if;
end $$;
