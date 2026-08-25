-- 0075: the two questions 0074 answered too coarsely.
--
-- 0074 gave the portal a plan and a statement. Both are honest and both are
-- blunt, and the bluntness shows up in the same place: they can only count.
--
--   "where are you up to?"  ->  4 of 9 milestones done  ->  44%
--   "what do I owe?"        ->  three invoices, one overdue
--
-- Neither is how the work is actually shaped.
--
-- -- Progress: a plan is not a checklist -------------------------------------
--
-- A build has phases, and phases are not the same size. "Discovery" is two
-- weeks of conversation; "Build the ordering flow" is two months. Counting them
-- as one row each tells a client that finishing the kick-off call moved the
-- project as far as shipping checkout will -- which is wrong in the direction
-- that hurts most, because it front-loads the bar and then strands it at 80%
-- for a month while the biggest phase grinds through.
--
-- So a milestone gains two numbers:
--
--   weight      what share of the WHOLE build this phase is worth (0..100)
--   completion  how far through THIS phase we are                 (0..100)
--
-- and the project's headline is the sum of `weight * completion / 100`. A 20%
-- phase sitting at 80% contributes 16 points, and that arithmetic is the entire
-- feature. It lives in TypeScript (`milestoneProgress`, lib/data/portal.ts) and
-- not in a generated column here, because the same function has to cope with
-- legacy rows that carry no weights at all -- see 1(c).
--
-- -- Finance: an invoice is a bill, a plan is a promise ----------------------
--
-- `project_invoices` records what has already been billed. It cannot express
-- "$1,200 a month for a year", which is how most of Kagu's client money is
-- actually agreed, and the gap has a cost on both sides: the client cannot see
-- what is coming, and Kagu re-derives the schedule by hand every month from a
-- sentence in a contract.
--
-- Section 2 adds the promise as its own object -- a plan, and the payments it
-- is made of -- and deliberately does NOT try to replace the invoice table. A
-- payment becomes real when somebody issues an invoice for it, and the two are
-- linked by `invoice_id` rather than merged. Keeping them separate is what lets
-- the portal say "you owe 1 invoice now, and 11 payments are scheduled after
-- it" instead of running the two numbers together.
--
-- Everything here inherits 0074's security shape unchanged: client-readable,
-- client-never-writable, behind a publishing gate. Section 3 re-asserts it.

-- ---------------------------------------------------------------------------
-- 1. Weighted phases
-- ---------------------------------------------------------------------------

-- (a) The two numbers.
alter table public.project_milestones
  add column weight numeric(6, 2) not null default 0
    check (weight >= 0 and weight <= 100),
  add column completion numeric(5, 2) not null default 0
    check (completion >= 0 and completion <= 100);

comment on column public.project_milestones.weight is
  'Share of the whole build this phase is worth, 0..100. 0 means unweighted: a project whose phases are all 0 falls back to equal shares (see milestoneProgress).';
comment on column public.project_milestones.completion is
  'How far through this phase we are, 0..100. Multiplied by weight to give the phase''s contribution to the headline figure.';

-- (b) Anything already finished is 100% finished. Run BEFORE the trigger below
--     exists so it is a plain backfill and not a cascade of status rewrites.
update public.project_milestones set completion = 100 where status = 'done';

-- (c) Deliberately NOT backfilling weights. A weight is a judgement about how
--     big a piece of work is, and inventing one here would be this migration
--     guessing at somebody's project -- silently, and in a number a customer
--     then reads as fact. Left at 0, which `milestoneProgress` treats as "this
--     project has not been weighted", falling back to equal shares. That is
--     exactly the behaviour these projects have today, so nobody's bar moves
--     when this deploys, and it starts meaning something the moment a producer
--     types the first weight in.

-- (d) Status and completion are two views of one fact, so they are not allowed
--     to disagree.
--
--     The rule is small and its edges all point the same way: a status the
--     writer SET wins over a completion they left alone, and vice versa.
--     Without it you get a phase marked Done sitting at 30% -- which reads on
--     the client's timeline as a finished step that moved the bar by a third.
create or replace function private.milestone_completion_sync()
returns trigger
language plpgsql
as $$
declare
  completion_changed boolean;
  status_changed boolean;
begin
  -- Spelled out rather than folded into the declarations: on INSERT `old` is
  -- unassigned, and SQL does not promise to short-circuit an OR before
  -- touching it.
  if tg_op = 'INSERT' then
    completion_changed := true;
    status_changed := true;
  else
    completion_changed := new.completion is distinct from old.completion;
    status_changed := new.status is distinct from old.status;
  end if;

  if status_changed and new.status = 'done' then
    -- Marked done: it is finished, whatever the slider said a moment ago.
    new.completion := 100;
  elsif completion_changed and new.completion >= 100 then
    -- Dragged to the end: that IS done, and making somebody then also change a
    -- dropdown is how a plan ends up full of 100%-but-in-progress rows.
    new.status := 'done';
  elsif completion_changed and new.completion > 0 and new.status = 'planned' then
    -- Work has started on something still labelled "planned".
    new.status := 'in_progress';
  elsif tg_op = 'UPDATE' and status_changed and old.status = 'done'
        and new.status <> 'done' and not completion_changed
        and new.completion >= 100 then
    -- Reopened. A phase that is no longer done cannot still be 100%, and
    -- leaving it there would bounce it straight back to done on the next
    -- write. Zeroed rather than guessed at: the honest figure is whatever the
    -- person reopening it types next.
    new.completion := 0;
  end if;

  -- A done phase with no date reads as one nobody is sure about. Filled, never
  -- overwritten -- a deliberately back-dated completion survives.
  if new.status = 'done' then
    new.done_on := coalesce(new.done_on, current_date);
  end if;

  return new;
end $$;

create trigger project_milestones_completion
before insert or update on public.project_milestones
for each row execute function private.milestone_completion_sync();

-- ---------------------------------------------------------------------------
-- 2. Payment plans
-- ---------------------------------------------------------------------------

-- (a) The agreement.
create table public.project_payment_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Named, because a project can hold more than one at once: a build fee paid
  -- in thirds AND a monthly retainer that starts when it ships.
  title text not null check (length(title) between 1 and 160),
  -- 'installments' ends; 'recurring' is a retainer that may not. The only real
  -- difference is what the client is told -- the payments themselves are the
  -- same rows either way -- so this is a label on the plan, not two tables.
  kind text not null default 'installments'
    check (kind in ('installments', 'recurring')),
  -- Same four as `project_invoices`, and for the same reason (0074 s2): a plan
  -- is quoted in the currency the client is billed in, never converted.
  currency text not null default 'USD'
    check (currency in ('TRY', 'USD', 'EUR', 'IQD')),
  -- What each payment is, when they are all the same. Null on a hand-built
  -- schedule where every row differs; the rows are the truth either way and
  -- this is only ever the headline ("$1,200 / month").
  amount_each numeric(14, 2) check (amount_each is null or amount_each > 0),
  cadence text not null default 'monthly'
    check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  starts_on date not null default current_date,
  -- Null on an open-ended retainer. Not a constraint on the payments -- a plan
  -- can be extended past it -- but it is what the client is shown.
  ends_on date check (ends_on is null or ends_on >= starts_on),
  status text not null default 'active'
    check (status in ('draft', 'active', 'completed', 'cancelled')),
  note text check (note is null or length(note) <= 2000),
  -- 0074's publishing seam, unchanged. Two gates rather than one because they
  -- mean different things: 'draft' is "not agreed yet", visible_to_client is
  -- "agreed, but we are not showing it in the portal".
  visible_to_client boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_payment_plans_project_idx
  on public.project_payment_plans (project_id, starts_on);

create trigger project_payment_plans_updated_at
before update on public.project_payment_plans
for each row execute function private.set_updated_at();

-- (b) The payments it is made of.
create table public.project_payment_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null
    references public.project_payment_plans (id) on delete cascade,
  -- Denormalised from the plan, and load-bearing rather than convenient: the
  -- client's RLS arm is `project_id = any (client_project_ids())`, and without
  -- the column every policy check on this table would be a join.
  -- `installment_matches_plan()` below keeps the copy honest.
  project_id uuid not null references public.projects (id) on delete cascade,
  seq integer not null default 1,
  -- "Deposit", "On delivery", "March". Optional -- a monthly schedule reads
  -- perfectly well as a column of dates.
  label text check (label is null or length(label) between 1 and 160),
  amount numeric(14, 2) not null check (amount > 0),
  due_on date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'invoiced', 'paid', 'waived')),
  paid_on date,
  -- The seam between the promise and the bill. Set when an invoice is raised
  -- for this payment; `on delete set null` so deleting an invoice unlinks the
  -- payment rather than deleting a row out of an agreed schedule.
  invoice_id uuid references public.project_invoices (id) on delete set null,
  note text check (note is null or length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_payment_installments_plan_idx
  on public.project_payment_installments (plan_id, due_on, seq);
create index project_payment_installments_project_idx
  on public.project_payment_installments (project_id, due_on);

create trigger project_payment_installments_updated_at
before update on public.project_payment_installments
for each row execute function private.set_updated_at();

-- The denormalised tenant key, kept true. A payment filed under the wrong
-- project is not a display bug -- it is one client's schedule appearing in
-- another client's portal, which is the exact failure 0074's header is about.
create or replace function private.installment_matches_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner uuid;
begin
  select project_id into owner
  from public.project_payment_plans
  where id = new.plan_id;

  if owner is null then
    raise exception 'payment plan % does not exist', new.plan_id;
  end if;
  if new.project_id is distinct from owner then
    raise exception
      'installment project_id (%) does not match its plan project (%)',
      new.project_id, owner;
  end if;
  return new;
end $$;

create trigger project_payment_installments_match_plan
before insert or update of plan_id, project_id
on public.project_payment_installments
for each row execute function private.installment_matches_plan();

-- (c) RLS. Same shape as 0074 s3: members read, writers write, clients read a
--     published subset and write nothing anywhere.
alter table public.project_payment_plans enable row level security;
alter table public.project_payment_installments enable row level security;

create policy project_payment_plans_select on public.project_payment_plans
  for select to authenticated
  using (
    private.is_member('work')
    or private.is_member('management')
    or (
      project_id = any (private.client_project_ids())
      and visible_to_client
      and status <> 'draft'
    )
  );

create policy project_payment_plans_insert on public.project_payment_plans
  for insert to authenticated
  with check (private.can_write('work') or private.can_write('management'));

create policy project_payment_plans_update on public.project_payment_plans
  for update to authenticated
  using (private.can_write('work') or private.can_write('management'))
  with check (private.can_write('work') or private.can_write('management'));

create policy project_payment_plans_delete on public.project_payment_plans
  for delete to authenticated
  using (private.can_write('work') or private.can_write('management'));

-- The payment rows carry no gate of their own -- they inherit their plan's, via
-- the EXISTS below. Written that way rather than copying `visible_to_client`
-- onto every row because two copies of one decision is two things to forget:
-- un-publishing a plan has to take its twelve payments with it, always.
create policy project_payment_installments_select
  on public.project_payment_installments
  for select to authenticated
  using (
    private.is_member('work')
    or private.is_member('management')
    or (
      project_id = any (private.client_project_ids())
      and exists (
        select 1
        from public.project_payment_plans pp
        where pp.id = plan_id
          and pp.visible_to_client
          and pp.status <> 'draft'
      )
    )
  );

create policy project_payment_installments_insert
  on public.project_payment_installments
  for insert to authenticated
  with check (private.can_write('work') or private.can_write('management'));

create policy project_payment_installments_update
  on public.project_payment_installments
  for update to authenticated
  using (private.can_write('work') or private.can_write('management'))
  with check (private.can_write('work') or private.can_write('management'));

create policy project_payment_installments_delete
  on public.project_payment_installments
  for delete to authenticated
  using (private.can_write('work') or private.can_write('management'));

grant select, insert, update, delete
  on table public.project_payment_plans to authenticated;
grant select, insert, update, delete
  on table public.project_payment_installments to authenticated;

-- (d) Realtime -- 0074 s4's reasoning, unchanged: a payment marked received is
--     watched by the person marking it and by the person who paid it.
do $$
declare
  t text;
  tables text[] := array[
    'project_payment_plans', 'project_payment_installments'
  ];
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
-- 3. Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) 0072 s7(b) / 0074 s5(a), re-run verbatim. This migration adds two more
  --     tables that name client_project_ids() in a policy, which makes it
  --     exactly the migration where a stray write arm would slip in.
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

  -- (b) A plan reaches a client only when it is BOTH published and not a
  --     draft. Asserted because the failure is silent: drop either arm and
  --     everything still works, it just shows a customer a schedule nobody has
  --     agreed to yet.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_payment_plans'
      and cmd = 'SELECT'
      and qual like '%client_project_ids()%'
      and (qual not like '%visible_to_client%' or qual not like '%draft%')
  ) then
    raise exception
      'project_payment_plans is readable by clients without both publishing gates';
  end if;

  -- (c) And the payments inherit it. A client arm on that table which does not
  --     consult the plan is twelve rows of a hidden schedule in the portal.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_payment_installments'
      and cmd = 'SELECT'
      and qual like '%client_project_ids()%'
      and qual not like '%project_payment_plans%'
  ) then
    raise exception
      'project_payment_installments is readable by clients without its plan gate';
  end if;

  -- (d) 0053's standing rule: no write policy gated by is_member(), which
  --     would hand a view-only member the ability to change things.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- (e) The phase arithmetic's two columns exist and are bounded. The app
  --     clamps as well, but a percentage is read by a customer as a fact and
  --     the last line of defence against a 4000% phase is a check constraint.
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'project_milestones'
      and column_name in ('weight', 'completion')
  ) <> 2 then
    raise exception 'project_milestones is missing weight/completion';
  end if;

  if (
    select count(*) from pg_constraint
    where conrelid = 'public.project_milestones'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) like '%weight%'
           or pg_get_constraintdef(oid) like '%completion%')
  ) < 2 then
    raise exception 'weight/completion are not both bounded by a check constraint';
  end if;

  -- (f) A done phase is a 100% phase, everywhere in the table. The trigger
  --     enforces it going forward; this catches a backfill that missed.
  if exists (
    select 1 from public.project_milestones
    where status = 'done' and completion < 100
  ) then
    raise exception 'done milestones exist below 100%% completion';
  end if;
end $$;
