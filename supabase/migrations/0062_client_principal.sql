-- 0062: a second kind of person.
--
-- Every authenticated user in KaguOs to date is one of the 8. `profiles` +
-- `section_memberships` answers one question — which parts of the company's own
-- system do you belong to — and every policy in the database is written on the
-- assumption that whoever is asking is a Kagu person. Marketing breaks that:
-- the section is an agency arm, its clients approve their own video cuts, and
-- they want to do it inside the panel rather than over WhatsApp. That puts a
-- non-Kagu human behind the login for the first time.
--
-- This migration is ONLY the principal. No creatives, no reviews, no screens —
-- those are 0063 and 0064. It goes first and alone because a tenant column
-- retrofitted across 40+ policies later is the expensive mistake, and because
-- the failure it guards against is silent: a client who can read the team's
-- roster looks exactly like a client who can't, until someone notices.
--
-- ── The shape of the guarantee ──────────────────────────────────────────────
--
-- The obvious implementation is to audit every policy and add "and not a
-- client" to each. That is ~100 edits, it has to be repeated by hand in every
-- future migration, and one omission is a leak. So instead the guard goes in
-- the FOUR functions every policy already funnels through:
--
--     private.is_admin()     private.is_member(s)
--     private.can_write(s)   private.in_showcase()
--
-- After section 4 below, a client account fails all four, unconditionally and
-- everywhere — including in policies written years from now by someone who has
-- never read this file. That is the difference between an invariant and a
-- convention. Section 9 asserts it rather than trusting it.
--
-- The cost is one extra profiles lookup inside functions that were already
-- reading profiles; they stay `stable` and `security definer`, so the planner
-- still evaluates them once per statement rather than once per row.
--
-- ── What a client may do ────────────────────────────────────────────────────
--
-- Read: their own profile row, their own `clients` row, and (from 0063/0064)
-- the creatives and reviews carrying their client_id. Nothing else, ever.
-- Write: exactly one table, `creative_reviews`, and that arrives in 0064.
-- There is deliberately no path in this file by which a client writes anything.

-- ---------------------------------------------------------------------------
-- 1. profiles.kind — the principal type
-- ---------------------------------------------------------------------------
-- Default 'member' so not one existing row changes meaning, and so a profile
-- created by the auth trigger (which knows nothing about this column) is a
-- Kagu person until something deliberately says otherwise. Fail-closed in the
-- direction that matters: the dangerous mistake is a client silently becoming
-- a member, and that cannot happen by omission — only by an explicit UPDATE
-- through the service role.
alter table public.profiles
  add column kind text not null default 'member'
  check (kind in ('member', 'client'));

-- Every gate function below filters on this column, so it is read on virtually
-- every policy evaluation in the database.
create index profiles_kind_idx on public.profiles (kind);

-- A client is not an admin and does not showcase. Enforced here as data rather
-- than only in the functions: section 4 makes is_admin() ignore the flag for a
-- client, but leaving a true `is_admin` sitting on a client row would be a trap
-- for the next person who queries the column directly instead of calling the
-- function.
alter table public.profiles
  add constraint profiles_client_is_not_privileged
  check (kind = 'member' or (is_admin = false and showcase_mode = false));

-- ---------------------------------------------------------------------------
-- 2. clients — the root object of the Marketing section
-- ---------------------------------------------------------------------------
-- Client, not campaign, is the root: every row this section will ever hold
-- belongs to exactly one client, and that is what makes the tenant filter a
-- single column on every table rather than a join path that differs per table.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended')),
  currency text not null default 'TRY'
    check (currency in ('TRY', 'USD', 'EUR')),

  -- The engagement model is genuinely undecided — retainer, project, and a cut
  -- of ad spend are all live options and the first clients are being signed
  -- now. Storing all three answers costs one enum and one nullable integer;
  -- deciding first would cost a schema change later, under time pressure, with
  -- real rows in the table. `monthly_deliverables` is null for project work,
  -- where "how many videos a month" is not a question.
  engagement_kind text not null default 'retainer'
    check (engagement_kind in ('retainer', 'project', 'ad_fee')),
  monthly_deliverables integer
    check (monthly_deliverables is null or monthly_deliverables >= 0),

  -- Whose card gets charged for the ads. Today this is always 'client' — we
  -- manage spend inside their own ad account, so it never touches the Kagu
  -- ledger and is a performance number only. The column exists because the day
  -- one client asks Kagu to front the spend, that stops being true, and the
  -- Ads screen has to know which kind of number it is showing.
  ad_account_owner text not null default 'client'
    check (ad_account_owner in ('client', 'kagu')),

  brand_notes text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_list_idx on public.clients (is_demo, status, name);

create trigger clients_updated_at
before update on public.clients
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. client_users — which human belongs to which client
-- ---------------------------------------------------------------------------
-- A client user belongs to exactly ONE client (primary key on user_id, not the
-- pair). Multi-client access is a real thing in agency tools and deliberately
-- not modelled: with one row per user the tenant lookup is a single scalar,
-- which is what lets `client_id = private.client_id()` be the whole filter on
-- every table in the section. A set-valued lookup turns each of those into an
-- IN clause, and every future policy into an opportunity to write it wrong.
--
-- `approver` may decide on a cut; `viewer` may only look. The distinction is
-- enforced in 0064 where the review policy lands — there is nothing here for
-- either role to write.
create table public.client_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  role text not null default 'approver' check (role in ('approver', 'viewer')),
  created_at timestamptz not null default now()
);

create index client_users_client_idx on public.client_users (client_id);

-- ---------------------------------------------------------------------------
-- 4. The gate functions
-- ---------------------------------------------------------------------------

-- The tenant scalar. Null for members, for signed-out requests, and for a
-- client account whose client_users row is missing — so a half-provisioned
-- client sees nothing rather than everything. `kind = 'client'` is required as
-- well as the membership row: the principal type is the authoritative bit, and
-- requiring both means neither table alone can promote someone into a tenant.
create or replace function private.client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cu.client_id
  from public.client_users cu
  join public.profiles p on p.id = cu.user_id
  where cu.user_id = (select auth.uid())
    and p.kind = 'client';
$$;

grant execute on function private.client_id() to authenticated;

-- Deliberately reads profiles.kind and NOT client_users: "is this person an
-- outsider" must be answerable even when their tenant row is missing, because
-- that is exactly the state in which getting the answer wrong is worst.
create or replace function private.is_client()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.kind = 'client' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

grant execute on function private.is_client() to authenticated;

-- ---- The four doors, closed --------------------------------------------
-- Bodies are otherwise byte-for-byte their previous definitions (0001, 0016,
-- 0053). The added clause is the same in each, and it is placed FIRST so the
-- common member case short-circuits on a single lookup.

-- is_admin: a client cannot be an admin whatever the column says. The check
-- constraint in section 1 already forbids the row; this makes the function
-- correct even if that constraint is ever dropped.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_admin and p.kind = 'member'
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

-- is_member: THE read gate for every section. A client has no section and must
-- never acquire one; this makes a stray section_memberships row inert rather
-- than catastrophic.
create or replace function private.is_member(s text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_client() and (
    private.is_admin() or exists (
      select 1
      from public.section_memberships m
      where m.user_id = (select auth.uid()) and m.section = s
    )
  );
$$;

-- can_write: the write gate. A client must never satisfy can_write('marketing')
-- — that is the check standing between "approve my video" and "edit the
-- agency's pipeline", and 0064's review policy is written NOT to use it.
create or replace function private.can_write(s text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_client() and (
    private.is_admin() or exists (
      select 1
      from public.section_memberships m
      where m.user_id = (select auth.uid())
        and m.section = s
        and m.access = 'write'
    )
  );
$$;

-- in_showcase: the demo tour. Showcase widens every SELECT policy in the app
-- with `or (is_demo and private.in_showcase())` and lets a member roam sections
-- they don't belong to — an arm that must not be reachable from outside the
-- company. The check constraint in section 1 forbids the flag on a client row;
-- this makes the function refuse it regardless.
create or replace function private.in_showcase()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.showcase_mode and p.kind = 'member'
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. The roster is not public any more
-- ---------------------------------------------------------------------------
-- `profiles_select` has been `using (true)` since 0001 — correct while every
-- account belonged to one of 8 colleagues, and a straight leak the moment one
-- doesn't. Without this a client reads every teammate's name, email, last-seen
-- timestamp, and current status note ("On a break till 15:00") straight out of
-- the table. Nothing in the UI would show it to them; `select *` would.
--
-- Members keep the unrestricted roster they have always had. A client sees
-- exactly one row: their own.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or not private.is_client());

-- Same reasoning: section_memberships maps every colleague to the parts of the
-- company they work in, which is org-chart information and none of a client's
-- business. (Their own row cannot exist — clients have no sections — so unlike
-- profiles there is no self arm to keep.)
drop policy memberships_select on public.section_memberships;
create policy memberships_select on public.section_memberships
  for select to authenticated
  using (not private.is_client());

-- ---- The notification insert, which this migration turns into a hole -------
--
-- `notifications_insert` has been `with check (true)` since 0009, and it was
-- the right call: the sender of a notification is always the app acting for one
-- of 8 colleagues, the recipient list is computed server-side, and a policy
-- tight enough to express "whoever the feature says" would have to re-derive
-- every feature's audience in SQL.
--
-- Adding an outside principal is what breaks it. `with check (true)` means an
-- authenticated CLIENT can insert a notification row for any Kagu person, with
-- a title and an `href` of their choosing — a message in the team's own bell,
-- carrying a link, apparently from the company's own system. That is a
-- phishing surface, not a data leak, which is why an audit of SELECT policies
-- would not have found it.
--
-- The fix keeps 0009's reasoning intact for members and removes the one new
-- case. Clients still generate notifications — a review lands in the producer's
-- bell — but through the SECURITY DEFINER trigger in 0064, which controls the
-- title and the href, rather than by writing the row themselves.
drop policy notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (not private.is_client());

-- ---------------------------------------------------------------------------
-- 6. RLS for the two new tables
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.client_users enable row level security;

-- The shape every table in this section repeats from here on: the Marketing
-- team sees all of it, a client sees their own tenant, showcase sees the demo
-- rows. Written out per table rather than hidden behind a helper because a
-- policy is read far more often than it is written, and the tenant arm is the
-- line a reviewer must be able to check at a glance.
create policy clients_select on public.clients
  for select to authenticated
  using (
    private.is_member('marketing')
    or id = private.client_id()
    or (is_demo and private.in_showcase())
  );

create policy clients_insert on public.clients
  for insert to authenticated
  with check (private.can_write('marketing') and created_by = (select auth.uid()));

create policy clients_update on public.clients
  for update to authenticated
  using (private.can_write('marketing'))
  with check (private.can_write('marketing'));

create policy clients_delete on public.clients
  for delete to authenticated
  using (private.can_write('marketing'));

-- A client user may read their OWN mapping (the portal needs to know which
-- tenant it is showing) and nothing else — not their colleagues on the same
-- account, and certainly not other clients' users.
create policy client_users_select on public.client_users
  for select to authenticated
  using (private.is_member('marketing') or user_id = (select auth.uid()));

-- No insert/update/delete policy at all, on purpose. Adding a client user means
-- creating an auth account, which only the service role can do; that path
-- bypasses RLS entirely and checks `canWrite('marketing')` in the action first
-- (the same shape as admin user creation). Leaving the table with no write
-- policy means there is no OTHER path — a marketing member cannot hand out
-- tenant access by writing a row directly.

-- ---------------------------------------------------------------------------
-- 7. One column of foresight in Management (D2)
-- ---------------------------------------------------------------------------
-- Ad spend never touches the Kagu ledger: clients pay their own ad accounts, so
-- spend is a performance number, not a transaction. The Kagu FEE does touch it,
-- and it is invoiced under a contract. Without this column, answering "what did
-- we bill this client" a year from now means matching contract titles to client
-- names by eye. One nullable FK now; archaeology avoided later.
alter table public.contracts
  add column client_id uuid references public.clients (id) on delete set null;

create index contracts_client_idx on public.contracts (client_id);

-- ---------------------------------------------------------------------------
-- 8. session_context(): ADDITIVE ONLY
-- ---------------------------------------------------------------------------
-- 0053 §6 explains the rule and it has not softened: the currently-deployed
-- bundle reads 'profile', 'sections' and 'access' from this object during the
-- window between the migration landing and the new build going live. Reshaping
-- any one of those throws on every page load for the length of that window.
-- Two keys are added; none is touched.
--
-- 'client_id' rides along rather than being fetched separately: the portal
-- needs it on every request, and this RPC is already the one round-trip every
-- page pays for.
create or replace function public.session_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'sections', coalesce(
      (
        select jsonb_agg(m.section)
        from public.section_memberships m
        where m.user_id = p.id
      ),
      '[]'::jsonb
    ),
    'access', coalesce(
      (
        select jsonb_object_agg(m.section, m.access)
        from public.section_memberships m
        where m.user_id = p.id
      ),
      '{}'::jsonb
    ),
    'kind', p.kind,
    'client_id', (
      select cu.client_id
      from public.client_users cu
      where cu.user_id = p.id and p.kind = 'client'
    )
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Realtime (0029's treatment for every user-facing list)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['clients'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- `client_users` is deliberately absent: it changes once per client account,
-- ever, and putting it on the wire would broadcast tenant membership changes to
-- every subscriber.

-- ---------------------------------------------------------------------------
-- 10. Invariants, checked here rather than trusted
-- ---------------------------------------------------------------------------
-- The whole design rests on four function bodies. If a later migration
-- re-creates one of them from an older copy — which is exactly how 0053's
-- is_member/can_write split could have been undone, and why it left its own DO
-- block behind — the guard disappears silently and every policy in the database
-- reopens to clients at once. Nothing would error; a client would simply start
-- seeing the company. So it is asserted, not reviewed.
do $$
declare
  bad text;
begin
  -- (a) The four doors still consult the client guard. Checked against the
  --     catalog's own copy of each body, so a re-CREATE from stale source is
  --     caught at deploy time rather than in production.
  select string_agg(fn, ', ') into bad
  from unnest(array[
    'private.is_admin()',
    'private.is_member(text)',
    'private.can_write(text)',
    'private.in_showcase()'
  ]) as fn
  where pg_get_functiondef(fn::regprocedure) not like '%is_client%'
    and pg_get_functiondef(fn::regprocedure) not like '%kind = ''member''%';
  if bad is not null then
    raise exception
      'client guard missing from gate function(s): % — a client account would pass them',
      bad;
  end if;

  -- (b) No table in this section may be writable by a client. There is nothing
  --     for a client to write until 0064 adds creative_reviews, so the correct
  --     count of client-writable tables right now is zero. Any write policy
  --     that mentions client_id() is a bug at this point in the sequence.
  select string_agg(format('%s.%s (%s)', schemaname, tablename, policyname), ', ')
    into bad
  from pg_policies
  where schemaname = 'public'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(with_check, '') like '%client_id()%';
  if bad is not null then
    raise exception 'client-writable policy exists before creative_reviews: %', bad;
  end if;

  -- (c) The roster is closed. A `using (true)` on profiles is the single most
  --     likely regression here — it is the natural thing to write, it is what
  --     0001 had, and it hands a client the whole team.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
      and coalesce(qual, '') not like '%is_client%'
  ) then
    raise exception 'profiles SELECT policy no longer excludes clients';
  end if;

  -- (d) 0053's rule, re-checked because this migration rewrote can_write and
  --     added policies. Same block, same reason.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;
end $$;
