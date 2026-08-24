-- 0072: the client role comes back — this time attached to a PROJECT, and with
-- something for a client to actually do.
--
-- ── What changed since 0062/0068 ────────────────────────────────────────────
--
-- 0062 put an outsider behind the login for the Marketing arm: a client
-- approved their own video cuts, and the tenant was a `clients` row. 0068 threw
-- that away — approvals happen on WhatsApp — and dropped `client_users` with
-- it, leaving `profiles.kind` and the four gate functions in place as a seam
-- (0071 then repaired the two callers that seam broke).
--
-- This is that seam reopened for a different, larger job. Kagu builds websites
-- and systems FOR businesses, and every one of those builds starts by asking
-- the business fifty questions: what currency, what tax, what do you sell, what
-- are your hours, who signs off. Today that is a WhatsApp thread and a
-- spreadsheet. It becomes a panel the client fills in themselves, inside the
-- app, against their own project.
--
-- So the tenant is no longer a marketing `clients` row. It is a WORK PROJECT —
-- the thing being built for them — and the mapping is `client_projects`.
--
-- ── The shape of the guarantee (unchanged from 0062 §4) ─────────────────────
--
-- Every policy in this database funnels through four functions:
--
--     private.is_admin()     private.is_member(s)
--     private.can_write(s)   private.in_showcase()
--
-- and all four still refuse a client account unconditionally. Nothing in this
-- migration touches them, and §7 re-asserts it. A client therefore still
-- belongs to no section, sees no roster, roams nothing. What this file adds is
-- ONE narrow, explicitly-enumerated hole: the three `project_intake_*` tables,
-- writable by a client for the projects mapped to them and nothing else.
--
-- `private.client_id()` deliberately keeps answering null. It is 0062's
-- MARKETING tenant scalar, the `clients_select` policy still calls it, and
-- overloading it to mean "project" would silently re-point that policy at a
-- uuid from a different table. A new question gets a new function.

-- ---------------------------------------------------------------------------
-- 1. client_projects — which outsider may see which build
-- ---------------------------------------------------------------------------
-- Unlike 0062's `client_users` (one row per user, tenant as a scalar) this is a
-- SET: a business can have two things being built for it, and a holding company
-- can have two businesses. The cost is that the tenant filter is `= any(...)`
-- rather than `= ...`, which is one character of care per policy and buys a
-- model that doesn't need re-migrating the first time someone signs a second
-- contract.
create table public.client_projects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index client_projects_project_idx on public.client_projects (project_id);

alter table public.client_projects enable row level security;

-- Work members see the mapping (the project page names who can see the pack);
-- a client sees only their own rows. No INSERT/UPDATE/DELETE policy AT ALL, on
-- purpose and for the same reason 0062 §6 gave: assignments are made by an
-- admin through the service role, which bypasses RLS after checking `isAdmin`
-- in the action. Leaving the table with no write policy means there is no OTHER
-- path — a work member cannot hand out project access by writing a row.
create policy client_projects_select on public.client_projects
  for select to authenticated
  using (private.is_member('work') or user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. The tenant lookup
-- ---------------------------------------------------------------------------
-- Empty array for members, for signed-out requests, and for a client account
-- with no assignment yet — so `= any(...)` matches nothing rather than
-- everything, which is the direction a mistake here has to fail in.
--
-- `kind = 'client'` is required as well as the mapping row, exactly as 0062
-- required it: the principal type is the authoritative bit, and demanding both
-- means neither table alone can promote someone into a tenant.
create or replace function private.client_project_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select array_agg(cp.project_id)
      from public.client_projects cp
      join public.profiles p on p.id = cp.user_id
      where cp.user_id = (select auth.uid()) and p.kind = 'client'
    ),
    '{}'::uuid[]
  );
$$;

grant execute on function private.client_project_ids() to authenticated;

-- ---- What a client is allowed to know about their own project --------------
--
-- `projects_select` is deliberately NOT widened. That row carries repo_url,
-- internal notes and the whole build's status — none of it a client's business,
-- and a policy arm is an all-or-nothing grant on every column. So the portal
-- reads its project through this function instead, which returns the two fields
-- a heading needs and cannot be persuaded to return a third.
create or replace function public.my_client_projects()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.name
  from public.client_projects cp
  join public.projects pr on pr.id = cp.project_id
  join public.profiles p on p.id = cp.user_id
  where cp.user_id = (select auth.uid())
    and p.kind = 'client'
    and pr.is_demo = false
  order by pr.name;
$$;

revoke all on function public.my_client_projects() from public, anon;
grant execute on function public.my_client_projects() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The input pack
-- ---------------------------------------------------------------------------
-- The QUESTIONS live in TypeScript (src/lib/intake.ts), not here. That is a
-- deliberate split and worth defending: the catalogue changes every time Kagu
-- learns a better question to ask, it has to be read by the completion meter
-- and the review checklist on both sides of the app, and a schema migration per
-- reworded hint would be absurd. What the database owns is the ANSWERS, their
-- ownership, and who may touch them.
--
-- Two shapes, because the pack has two: scalar answers keyed by a catalogue
-- path ("decisions.currency"), and repeating rows (a price list, a staff list)
-- whose columns are the catalogue's business, not Postgres's.

-- ---- 3a. The pack header: one row per project, holding the "sent" state -----
create table public.project_intake (
  project_id uuid primary key references public.projects (id) on delete cascade,
  -- Null while the client is still filling it in. Set when they press Send,
  -- cleared when they reopen it — the pack is a living document, and a client
  -- who spots a wrong price after sending must be able to fix it without
  -- asking. What "sent" buys is the team's notification and a date to point at.
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger project_intake_updated_at
before update on public.project_intake
for each row execute function private.set_updated_at();

-- ---- 3b. Scalar answers ----------------------------------------------------
-- `value` is text, not jsonb: every answer in the catalogue is a string the
-- browser typed or a token the browser picked, the completion rules only ever
-- ask "is this blank", and jsonb here would buy a type system the catalogue
-- already owns while costing a cast at every read.
create table public.project_intake_answers (
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null check (length(key) between 1 and 120),
  value text not null default '' check (length(value) <= 8000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (project_id, key)
);

-- ---- 3c. Repeating rows ----------------------------------------------------
create table public.project_intake_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Which table in the catalogue this row belongs to ("offerings.items").
  table_key text not null check (length(table_key) between 1 and 120),
  -- column key -> cell text. Bounded so one paste can't become a 2MB row.
  -- Sized through `data::text` rather than pg_column_size(): the jsonb output
  -- cast is immutable, which is what a CHECK constraint is entitled to assume,
  -- and it measures the thing a reader would recognise (the JSON) instead of
  -- the toasted on-disk width.
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and length(data::text) <= 16384),
  sort integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_intake_rows_table_idx
  on public.project_intake_rows (project_id, table_key, sort);

create trigger project_intake_rows_updated_at
before update on public.project_intake_rows
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS on the pack — the one place a client writes
-- ---------------------------------------------------------------------------
alter table public.project_intake enable row level security;
alter table public.project_intake_answers enable row level security;
alter table public.project_intake_rows enable row level security;

-- The two arms repeat on all three tables rather than hiding behind a helper:
-- a policy is read far more often than it is written, and the tenant arm is
-- exactly the line a reviewer has to be able to check at a glance.
--
-- Read is `is_member('work')` — a view-only Work member should be able to READ
-- what the client answered. Write is `can_write('work')`, so that same view-only
-- member cannot edit the client's own answers on their behalf.

create policy project_intake_select on public.project_intake
  for select to authenticated
  using (
    private.is_member('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_insert on public.project_intake
  for insert to authenticated
  with check (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_update on public.project_intake
  for update to authenticated
  using (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  )
  with check (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_answers_select on public.project_intake_answers
  for select to authenticated
  using (
    private.is_member('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_answers_insert on public.project_intake_answers
  for insert to authenticated
  with check (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_answers_update on public.project_intake_answers
  for update to authenticated
  using (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  )
  with check (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_answers_delete on public.project_intake_answers
  for delete to authenticated
  using (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_rows_select on public.project_intake_rows
  for select to authenticated
  using (
    private.is_member('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_rows_insert on public.project_intake_rows
  for insert to authenticated
  with check (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_rows_update on public.project_intake_rows
  for update to authenticated
  using (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  )
  with check (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

create policy project_intake_rows_delete on public.project_intake_rows
  for delete to authenticated
  using (
    private.can_write('work')
    or project_id = any (private.client_project_ids())
  );

-- ---- Table privileges, stated rather than inherited --------------------------
--
-- Every earlier migration relies on Supabase's default privileges to expose a
-- new public table to the API roles, and on the hosted project that has always
-- worked. It is on its way out: `auto_expose_new_tables` in config.toml notes
-- that unset now means NOT auto-exposed, and that the setting disappears in
-- October 2026. A table that RLS protects perfectly but PostgREST cannot reach
-- fails as a blanket 403 on every request — indistinguishable, from the client
-- portal, from "this account is broken".
--
-- So these four say it out loud. Where the defaults already grant it, this is a
-- no-op; where they don't, it is the difference between a working portal and an
-- outage. RLS decides what comes back — the grants only decide whether the
-- request is answered at all.
grant select on table public.client_projects to authenticated;
-- The assignment table has no write POLICY at all (§1), so the only writer is
-- the service role in actions/admin.ts. That path bypasses RLS but not grants.
grant select, insert, delete on table public.client_projects to service_role;
grant select, insert, update, delete on table public.project_intake to authenticated;
grant select, insert, update, delete on table public.project_intake_answers to authenticated;
grant select, insert, update, delete on table public.project_intake_rows to authenticated;

-- ---------------------------------------------------------------------------
-- 4b. One new notification kind
-- ---------------------------------------------------------------------------
-- The bell the team actually wants: a client has finished filling in their pack
-- and pressed Send. Nothing else a client does is worth interrupting anyone
-- for — they type into their own form all week — which is why this is the only
-- kind added here.
--
-- The ROW is still written by the server, never by the client: `notifications`
-- refuses an INSERT from a client account outright (0062 §5), because a
-- `with check (true)` there let an outsider plant a link-carrying message in a
-- colleague's bell that appeared to come from the company's own system. The
-- 0063/0064 kinds go with `creatives`, which 0068 dropped; they stay in the
-- list because rows carrying them may still exist in the table and a narrowed
-- check constraint is validated against every one of them.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change', 'message', 'debug_note', 'learn_proof', 'learn_review',
    'creative_assigned', 'creative_status', 'creative_review',
    'client_intake'
  ));

-- ---------------------------------------------------------------------------
-- 5. session_context(): ADDITIVE ONLY
-- ---------------------------------------------------------------------------
-- 0053 §6's rule, restated once more because it is the one that bites: the
-- currently-deployed bundle reads 'profile', 'sections', 'access', 'kind' and
-- 'client_id' from this object during the window between this migration landing
-- and the new build going live. Reshaping any of them throws on every page load
-- for the length of that window — which is exactly how 0068 produced a redirect
-- loop for every signed-in user (see 0071).
--
-- One key is added. 'client_id' keeps answering null: it is the marketing
-- tenant, it has no rows, and the app's isClient() path already reads null
-- there for members.
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
    'client_id', null,
    'client_project_ids', coalesce(
      (
        select jsonb_agg(cp.project_id)
        from public.client_projects cp
        where cp.user_id = p.id and p.kind = 'client'
      ),
      '[]'::jsonb
    )
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Realtime (0029's treatment for every user-facing list)
-- ---------------------------------------------------------------------------
-- The pack is the one screen two different kinds of person watch at once: the
-- client typing into it and the producer reading it. `client_projects` is
-- deliberately absent for 0062's reason — it changes once per assignment, and
-- putting it on the wire would broadcast tenant membership to every subscriber.
do $$
declare
  t text;
  tables text[] := array[
    'project_intake', 'project_intake_answers', 'project_intake_rows'
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
-- 7. Invariants, checked here rather than trusted
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) 0062's four doors still refuse a client. This migration hands a client
  --     a write for the first time since 0064, which makes it exactly the
  --     migration where a weakened gate function would go unnoticed.
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

  -- (b) THE NEW RULE, replacing 0068's "nothing is client-writable". A client
  --     may write the three intake tables and NOTHING else. 0068's blanket
  --     assertion is superseded rather than dropped: the same query runs, with
  --     an explicit allow-list, so the next migration that hands a client a
  --     write to some other table still has to come here and say why.
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

  -- (c) The marketing tenant scalar stays retired. If someone re-points
  --     client_id() at a project id, `clients_select` (0062 §6) starts
  --     comparing a projects.id to a clients.id — which never matches, so the
  --     bug presents as "the marketing client list is empty", three sections
  --     away from the change that caused it.
  if (select private.client_id()) is not null then
    raise exception 'private.client_id() no longer answers null — see 0072 §1';
  end if;

  -- (d) The roster is still closed (0062 §5). A `using (true)` on profiles is
  --     the single most likely regression in this whole sequence: it is the
  --     natural thing to write, it is what 0001 had, and it hands a client
  --     every colleague's name, email and status note.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
      and coalesce(qual, '') not like '%is_client%'
  ) then
    raise exception 'profiles SELECT policy no longer excludes clients';
  end if;

  -- (e) A client must not be able to read `projects` itself — the portal goes
  --     through my_client_projects() precisely so that repo urls and internal
  --     notes stay on the member side of the line.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and cmd = 'SELECT'
      and coalesce(qual, '') like '%client_project_ids()%'
  ) then
    raise exception
      'projects SELECT was widened to clients — use my_client_projects() instead (0072 §2)';
  end if;

  -- (f) 0053's standing rule, re-checked because this migration wrote nine new
  --     write policies.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- (g) Prove the new plumbing runs, the way 0071 proved its repair. A SQL
  --     function body is not validated against a missing relation until it is
  --     CALLED, which is how 0068 shipped a broken session_context.
  perform private.client_project_ids();
  perform public.session_context();
  perform count(*) from public.my_client_projects();
end $$;
