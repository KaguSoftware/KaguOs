-- 0074: the other two thirds of the client portal — money and progress.
--
-- 0072/0073 gave a client account exactly one thing to do: fill in the input
-- pack for a project shared with them. That is the half of the relationship
-- where the client owes Kagu something. This migration is the other half —
-- what Kagu owes the client back, and it is the two questions every client of
-- every agency asks on the phone instead:
--
--     "where are you up to?"   ->  public.project_milestones
--     "what do I owe?"         ->  public.project_invoices
--
-- Both are READ-ONLY to the client, and that is the whole security story of
-- this file. 0072 §7(b) asserts that the three `project_intake_*` tables are
-- the ONLY client-writable tables in the database; nothing here weakens that,
-- because every policy below that mentions `private.client_project_ids()` is a
-- SELECT. §5 re-runs 0072's assertion verbatim to prove it.
--
-- ── Why new tables rather than opening the existing ones ────────────────────
--
-- The obvious cheap move is to point the portal at `transactions` (money) and
-- `debug_tasks` (progress) with a tenant arm bolted on. Both are wrong for the
-- same reason `projects` was wrong in 0072 §2: an RLS arm is an all-or-nothing
-- grant on EVERY COLUMN of a row, and those two tables are full of columns a
-- client must never read.
--
--   `transactions` carries Kagu's expenses, its margins, and every other
--   client's income, keyed only by a free-text `client` string. One arm on that
--   table is one typo away from showing business A what business B pays.
--
--   `debug_tasks` is the engineering board. It says "auth is broken in prod"
--   and "revert Ahmed's migration". It is written in the register colleagues
--   use with each other, which is not the register you use with a customer.
--
-- So a client-facing milestone is a DIFFERENT OBJECT from an internal task, and
-- a client-facing invoice is a different object from a ledger row. Writing them
-- separately costs the team a deliberate act of publishing — which is exactly
-- the property that makes the portal safe to leave open.

-- ---------------------------------------------------------------------------
-- 1. project_milestones — the build, as the client sees it
-- ---------------------------------------------------------------------------
create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  -- One paragraph in the client's language, not a commit message.
  detail text check (detail is null or length(detail) <= 4000),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'done', 'blocked')),
  -- Both plain dates: a milestone is a calendar fact the client and the team
  -- have to agree on, and a timestamptz would make "due today" depend on who
  -- is asking and from where (see todayInIstanbul in lib/utils.ts).
  target_on date,
  done_on date,
  sort integer not null default 0,
  -- The publishing seam. A producer sketching next quarter's plan is drafting,
  -- not announcing; false keeps the row on the member side until it is true.
  -- Default TRUE because the common case is a plan being agreed with the
  -- client, and a default that hides things is a default that produces "I can't
  -- see anything in the portal" support calls.
  visible_to_client boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_milestones_project_idx
  on public.project_milestones (project_id, sort, created_at);

create trigger project_milestones_updated_at
before update on public.project_milestones
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. project_invoices — what was billed, and what landed
-- ---------------------------------------------------------------------------
-- This is NOT an accounting system and must not grow into one. It is the
-- statement a client is entitled to see: what we billed, when, for what, and
-- whether it is settled. Kagu's own books stay in `transactions`, where the
-- expenses and the margins live.
create table public.project_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- The human reference both sides quote at each other ("INV-014"). Free text
  -- rather than a sequence: the numbers come from whatever Kagu already issues
  -- them in, and a database-generated counter would immediately disagree with
  -- the PDF the client is holding.
  number text not null check (length(number) between 1 and 40),
  title text check (title is null or length(title) <= 200),
  amount numeric(14, 2) not null check (amount > 0),
  -- IQD joins the app's three (lib/types.ts) HERE and nowhere else. Kagu bills
  -- a Baghdad client in dinars; `transactions` deliberately keeps its narrower
  -- list, because that table feeds TRY conversion through `fx_rates` and adding
  -- a currency with no rate there would silently drop rows out of the totals.
  currency text not null default 'USD'
    check (currency in ('TRY', 'USD', 'EUR', 'IQD')),
  issued_on date not null default current_date,
  due_on date,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'void')),
  paid_on date,
  -- Shown to the client verbatim. Anything you would not say to their face
  -- belongs on the project's internal notes, not here.
  note text check (note is null or length(note) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_invoices_project_idx
  on public.project_invoices (project_id, issued_on desc);

create trigger project_invoices_updated_at
before update on public.project_invoices
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.project_milestones enable row level security;
alter table public.project_invoices enable row level security;

-- The arms are spelled out on every policy rather than hidden behind a helper,
-- for 0072 §4's reason: a policy is read far more often than it is written, and
-- the tenant arm is the line a reviewer has to be able to check at a glance.
--
-- Read is `is_member(...)` so a view-only member still sees the plan and the
-- statement. Write is `can_write(...)` so that same member cannot publish.
--
-- ⚠️ The client arm carries a SECOND condition in both cases, and it is not
-- decoration. Without `visible_to_client` / `status <> 'draft'` the portal shows
-- a half-typed milestone the moment someone starts a sentence in it, and an
-- invoice the moment its number is keyed in — both of which are things the team
-- says to itself, mid-thought, before it has decided to say them to a customer.

create policy project_milestones_select on public.project_milestones
  for select to authenticated
  using (
    private.is_member('work')
    or private.is_member('management')
    or (
      project_id = any (private.client_project_ids())
      and visible_to_client
    )
  );

create policy project_milestones_insert on public.project_milestones
  for insert to authenticated
  with check (private.can_write('work') or private.can_write('management'));

create policy project_milestones_update on public.project_milestones
  for update to authenticated
  using (private.can_write('work') or private.can_write('management'))
  with check (private.can_write('work') or private.can_write('management'));

create policy project_milestones_delete on public.project_milestones
  for delete to authenticated
  using (private.can_write('work') or private.can_write('management'));

create policy project_invoices_select on public.project_invoices
  for select to authenticated
  using (
    private.is_member('work')
    or private.is_member('management')
    or (
      project_id = any (private.client_project_ids())
      and status <> 'draft'
    )
  );

create policy project_invoices_insert on public.project_invoices
  for insert to authenticated
  with check (private.can_write('work') or private.can_write('management'));

create policy project_invoices_update on public.project_invoices
  for update to authenticated
  using (private.can_write('work') or private.can_write('management'))
  with check (private.can_write('work') or private.can_write('management'));

create policy project_invoices_delete on public.project_invoices
  for delete to authenticated
  using (private.can_write('work') or private.can_write('management'));

-- Stated rather than inherited — 0072's note applies unchanged: a table RLS
-- protects perfectly but PostgREST cannot reach fails as a blanket 403, which
-- from the portal is indistinguishable from "this account is broken".
grant select, insert, update, delete on table public.project_milestones to authenticated;
grant select, insert, update, delete on table public.project_invoices to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Realtime
-- ---------------------------------------------------------------------------
-- Same reasoning as 0072 §6: two audiences watch these rows at once — the
-- producer marking a milestone done, and the client who asked when it would be.
do $$
declare
  t text;
  tables text[] := array['project_milestones', 'project_invoices'];
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

-- ---------------------------------------------------------------------------
-- 5. Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) 0072 §7(b), re-run verbatim. This migration is the first since 0072 to
  --     mention client_project_ids() in a policy at all, which makes it exactly
  --     the migration where a stray write arm would slip in. The allow-list is
  --     unchanged: the intake pack is still the only thing a client writes.
  select string_agg(format('%s.%s (%s)', schemaname, tablename, policyname), ', ')
    into bad
  from pg_policies
  where schemaname = 'public'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(with_check, '') || coalesce(qual, '') like '%client_project_ids()%'
    and tablename not in (
      'project_intake', 'project_intake_answers', 'project_intake_rows'
    );
  if bad is not null then
    raise exception 'client-writable policy outside the intake pack: %', bad;
  end if;

  -- (b) The two new client-readable tables must BOTH carry their publishing
  --     gate. Asserted rather than trusted because the failure is silent: drop
  --     the draft arm and everything still works, it just shows customers
  --     invoices nobody has decided to send.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_milestones'
      and cmd = 'SELECT'
      and qual like '%client_project_ids()%'
      and qual not like '%visible_to_client%'
  ) then
    raise exception
      'project_milestones is readable by clients without the visible_to_client gate';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_invoices'
      and cmd = 'SELECT'
      and qual like '%client_project_ids()%'
      and qual not like '%draft%'
  ) then
    raise exception 'project_invoices is readable by clients without the draft gate';
  end if;

  -- (c) 0053's standing rule — no write policy may be gated by is_member(),
  --     which would grant a view-only member the ability to change things.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- (d) The four doors still refuse a client (0062 §4 / 0072 §7(a)). Cheap, and
  --     this migration hands a client two new things to read.
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

  -- (e) `projects` stays closed to clients. Both new tables carry project_id,
  --     which is the moment somebody reaches for a join and then for a policy.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and cmd = 'SELECT'
      and coalesce(qual, '') like '%client_project_ids()%'
  ) then
    raise exception
      'projects SELECT was widened to clients — use my_client_projects() instead (0072 §2)';
  end if;
end $$;
