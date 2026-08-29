-- 0082: the third thing a client asks for — "can I see it?"
--
-- 0074 gave the portal a plan and a statement. 0075 and 0078 made the plan
-- honest, and 0080 made it legible as four systems side by side. All of that
-- answers "how far are you" with a number and a sentence, which is the best
-- anyone can do IN WORDS.
--
-- It is not what a client actually wants. What they want is the thing itself:
-- the staging site on its .vercel.app address, the TestFlight invite that puts
-- the half-built app on their own phone, the Figma board the screens live on.
-- Kagu already sends those — in WhatsApp messages that scroll away, in emails
-- nobody can find three weeks later, and always after somebody asks. So the
-- link becomes a row: published deliberately, sitting on the portal next to the
-- bar it belongs to, still there in a month.
--
-- ── Why its own table and not a column on project_milestones ────────────────
--
-- Because the two have different lifetimes and different cardinality. A preview
-- URL outlives the phase that produced it and usually belongs to the project as
-- a whole ("the website is here"), while a system can easily have two links at
-- once — a TestFlight build AND the App Store page it graduates to. A `url`
-- column on a milestone would force one link per phase and delete the address
-- the client bookmarked the day the phase was reworded.
--
-- ── Why it is not `project_secrets` ─────────────────────────────────────────
--
-- 0011's secrets table is the opposite object: credentials, member-only, and
-- deliberately awkward to read. This is the public face — things Kagu WANTS a
-- customer to open — and mixing "the staging password" into the same table as
-- "the staging address" is exactly how one ends up rendered on a portal page.
--
-- ── The security-relevant part of this file ─────────────────────────────────
--
-- `url` is rendered into an <a href> on a page shown to a customer. A row
-- reading `javascript:...` would be stored XSS with a member as the author, so
-- the scheme is constrained in the DATABASE and not only in the action: the
-- action is one code path and the table is the thing that has to still be true
-- after the next one is written. §5(d) asserts the constraint is present.
--
-- Everything else is 0074's shape, deliberately: the same publishing gate, the
-- same pair of write arms, the same realtime treatment, and §5(a) re-runs
-- 0072 §7(b) to prove this migration did not hand a client a write.

begin;

-- ---------------------------------------------------------------------------
-- 1. project_links — what the client can go and look at
-- ---------------------------------------------------------------------------
create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,

  -- Which system this belongs to, when it belongs to one. Null means "the
  -- project as a whole", which is the common case for a marketing site.
  --
  -- `on delete set null` rather than cascade: a phase gets renamed, split and
  -- re-planned over the life of a build, and the address the client bookmarked
  -- must not disappear because the plan was tidied. The link survives its
  -- phase, unattached. §2 keeps it on the SAME project.
  milestone_id uuid references public.project_milestones (id) on delete set null,

  -- What the reader is being asked to do with it, which is the whole reason
  -- this is a column: "open" and "install on your phone" are different acts,
  -- and a list that says "Open" next to a TestFlight invite is a list that
  -- gets a support message back. Not an exhaustive taxonomy — five buckets
  -- that each change the verb and the icon.
  kind text not null default 'preview'
    check (kind in ('preview', 'install', 'design', 'document', 'other')),

  -- What it is called on the client's page. Their words: "Your website
  -- (in progress)", not "web-prod-preview".
  label text not null check (length(label) between 1 and 120),

  -- ⚠️ Rendered into an href on a customer-facing page. http/https only —
  -- see the header, and §5(d), which asserts this constraint still exists.
  -- 2000 is the length every browser and proxy agrees to carry.
  url text not null check (
    length(url) between 8 and 2000
    and (url like 'https://%' or url like 'http://%')
  ),

  -- The paragraph that makes the link usable: which Apple ID to send us, that
  -- the site is rebuilt nightly, that the login is on the invoice. Shown
  -- verbatim, so anything you would not say to their face belongs elsewhere.
  detail text check (detail is null or length(detail) <= 2000),

  sort integer not null default 0,

  -- 0074 §1's publishing gate, unchanged and for the same reason: a preview
  -- URL is pasted in the moment it exists, which is routinely a week before it
  -- is worth anybody looking at. Default TRUE — the common case is adding a
  -- link precisely because you want it seen, and a default that hides things
  -- produces "I can't see it in the portal" messages.
  visible_to_client boolean not null default true,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_links_project_idx
  on public.project_links (project_id, sort, created_at);

-- The portal groups a project's links under their system, so the lookup is by
-- milestone as often as by project.
create index project_links_milestone_idx
  on public.project_links (milestone_id)
  where milestone_id is not null;

create trigger project_links_updated_at
before update on public.project_links
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. A link may only hang off a phase of its OWN project
-- ---------------------------------------------------------------------------
-- A composite foreign key (milestone_id, project_id) would say this in one
-- line, and it is the wrong tool here: `on delete set null` on a composite key
-- nulls BOTH columns, and project_id is not null, so deleting a phase would
-- error instead of orphaning the link. A trigger says the same thing and keeps
-- the nulling behaviour §1 asks for.
--
-- Without it, a caller passing an arbitrary milestone id gets one client's
-- preview link filed under another client's system. RLS does not catch that —
-- both rows are writable by the same member.
create or replace function private.project_links_milestone_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.milestone_id is not null and not exists (
    select 1
    from public.project_milestones m
    where m.id = new.milestone_id
      and m.project_id = new.project_id
  ) then
    raise exception
      'project_links.milestone_id % is not a phase of project %',
      new.milestone_id, new.project_id;
  end if;
  return new;
end;
$$;

create trigger project_links_milestone_matches
before insert or update of milestone_id, project_id on public.project_links
for each row execute function private.project_links_milestone_matches();

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
-- 0074 §3's shape, spelled out rather than hidden behind a helper: read on
-- `is_member` so a view-only member sees what the client sees, write on
-- `can_write('work') OR can_write('management')` so they cannot publish, and a
-- client arm carrying the publishing gate as its second condition.
alter table public.project_links enable row level security;

create policy project_links_select on public.project_links
  for select to authenticated
  using (
    private.is_member('work')
    or private.is_member('management')
    or (
      project_id = any (private.client_project_ids())
      and visible_to_client
    )
  );

create policy project_links_insert on public.project_links
  for insert to authenticated
  with check (private.can_write('work') or private.can_write('management'));

create policy project_links_update on public.project_links
  for update to authenticated
  using (private.can_write('work') or private.can_write('management'))
  with check (private.can_write('work') or private.can_write('management'));

create policy project_links_delete on public.project_links
  for delete to authenticated
  using (private.can_write('work') or private.can_write('management'));

-- Stated rather than inherited — 0072's note applies unchanged: a table RLS
-- protects perfectly but PostgREST cannot reach fails as a blanket 403, which
-- from the portal is indistinguishable from "this account is broken".
grant select, insert, update, delete on table public.project_links to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Realtime
-- ---------------------------------------------------------------------------
-- Same reasoning as 0074 §4. The producer pasting a fresh TestFlight URL and
-- the client refreshing the portal because they were told it was coming are
-- routinely the same thirty seconds.
do $$
begin
  execute 'alter table public.project_links replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_links'
  ) then
    execute 'alter publication supabase_realtime add table public.project_links';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) 0072 §7(b), re-run verbatim. This migration mentions
  --     client_project_ids() in a new policy, which makes it exactly the
  --     migration where a stray write arm would slip in. The intake pack is
  --     still the only thing a client writes.
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

  -- (b) The publishing gate, asserted rather than trusted — 0074 §5(b)'s
  --     reason: drop the arm and nothing breaks, the portal simply starts
  --     showing customers addresses nobody decided to share.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_links'
      and cmd = 'SELECT'
      and qual like '%client_project_ids()%'
      and qual not like '%visible_to_client%'
  ) then
    raise exception
      'project_links is readable by clients without the visible_to_client gate';
  end if;

  -- (c) 0053's standing rule — no write policy gated by is_member(), which
  --     would hand a view-only member the ability to publish.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- (d) The scheme constraint. This is the one line in the file that stands
  --     between a member's typo and stored XSS on a customer's page, and a
  --     later migration widening `url` is the plausible way it goes missing.
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.project_links'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%https://%'
  ) then
    raise exception 'project_links.url lost its scheme constraint';
  end if;

  -- (e) No link filed under another project's phase. The trigger enforces it
  --     going forward; this is the assertion that the trigger is actually
  --     attached, run against real rows.
  select string_agg(l.id::text, ', ') into bad
  from public.project_links l
  join public.project_milestones m on m.id = l.milestone_id
  where m.project_id is distinct from l.project_id;
  if bad is not null then
    raise exception 'project_links attached to another project''s phase: %', bad;
  end if;
end $$;

commit;
