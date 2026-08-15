-- 0063: the unit of work is a video.
--
-- 0007 gave Marketing a `marketing_posts` row: a title, a channel, a date, and
-- three states (draft / scheduled / published). That is a content calendar, and
-- it describes a thing that already exists. A video does not already exist. It
-- is an idea, then a script, then a shoot day, then an edit, then something a
-- client has to say yes to, then a scheduled post, then a live one — three
-- people passing it between them for two or three weeks, with a gate in the
-- middle held by someone outside the company.
--
-- So `creatives` replaces `marketing_posts` rather than extending it. The old
-- table is dropped at the bottom of this file (see section 8 — read it before
-- applying if there is any doubt about what is in it).
--
-- ── Two structural decisions worth the space ────────────────────────────────
--
-- 1. VARIANTS. `parent_creative_id` points at another creative. One concept
--    spawns three hook variants as siblings, and "which creative won" becomes a
--    question about three cuts of the same idea instead of a comparison between
--    unrelated videos, which is a question about noise. Per-creative ad
--    tracking (0065, later) is only meaningful with this column present.
--
-- 2. TENANT INTEGRITY IS A FOREIGN KEY, NOT A CONVENTION. A creative carries
--    `client_id` and also points at a campaign and possibly a parent creative.
--    Nothing in a plain FK stops it pointing at ANOTHER client's campaign, and
--    that mistake is invisible: the row renders fine in the pipeline, and the
--    leak surfaces months later on a report or in a portal. So both references
--    are COMPOSITE — `(campaign_id, client_id)` and `(parent_creative_id,
--    client_id)` — against unique keys that include the tenant. Cross-tenant
--    linkage is then not a bug that review has to catch; it is an error the
--    database refuses to store.

-- ---------------------------------------------------------------------------
-- 1. Campaigns learn who they belong to, and what they were for
-- ---------------------------------------------------------------------------
-- Nullable, because rows predating this migration have no client and inventing
-- one would be a lie. The consequence is deliberate and useful: the composite
-- FK below cannot match a NULL, so a legacy client-less campaign can never hold
-- a creative. Old rows stay readable and are structurally inert.
alter table public.marketing_campaigns
  add column client_id uuid references public.clients (id) on delete cascade,

  -- `channel` (0007) says where the content goes. `platform` says where the
  -- MONEY goes, and they are not the same axis: a video posted to Instagram can
  -- be promoted through Meta Ads, and the CSV import in a later phase keys on
  -- the ad platform, not the content channel.
  add column platform text
    check (platform is null or platform in ('meta', 'tiktok', 'google', 'other')),

  -- What this campaign is FOR, as a number it either hit or missed. A campaign
  -- with a budget and no goal can only be reported on as "we spent it".
  add column goal_metric text
    check (goal_metric is null or goal_metric in ('reach', 'leads', 'sales', 'followers')),
  add column goal_target numeric(14, 2) check (goal_target is null or goal_target >= 0),

  -- Distinct from `budget`: what was planned versus what actually went out.
  -- Populated from the ad import, never typed by hand.
  add column spend_actual numeric(14, 2) not null default 0 check (spend_actual >= 0),

  -- The two highest-value fields in this section. A campaign that closes
  -- without them teaches nothing, and the knowledge leaves with whoever ran it.
  add column retro_worked text,
  add column retro_avoid text;

create index marketing_campaigns_client_idx
  on public.marketing_campaigns (is_demo, client_id, status);

-- The referenced side of the composite FK below. `id` is already the primary
-- key, so this adds no meaningful constraint of its own — it exists purely so
-- that (campaign_id, client_id) has something unique to point at.
alter table public.marketing_campaigns
  add constraint marketing_campaigns_id_client_key unique (id, client_id);

-- ---------------------------------------------------------------------------
-- 2. creatives
-- ---------------------------------------------------------------------------
create table public.creatives (
  id uuid primary key default gen_random_uuid(),

  -- NOT NULL, and first in the table for the same reason it is first in every
  -- policy: it is the only column that decides who may see this row.
  client_id uuid not null references public.clients (id) on delete cascade,
  campaign_id uuid,

  title text not null default 'Untitled video',
  -- The first two seconds, written down. Kept separate from `script` because it
  -- is what the variants differ on and what the Ads screen compares.
  hook text,
  script text,

  -- Two people, two jobs. The producer owns the video end to end; the editor is
  -- who has it right now during the edit. Separate columns because "my queue"
  -- has to answer both "what am I responsible for" and "what is on my desk".
  owner_id uuid references public.profiles (id) on delete set null,
  editor_id uuid references public.profiles (id) on delete set null,

  -- Shoot logistics as FIELDS, not a separate object. Per the scoping
  -- interview: there is no shoot entity, no call sheet, no location record. The
  -- shoot-week view is a query over these two columns (see 0063 note in
  -- MARKETING.md D6), which means there is no second thing to keep in sync.
  shoot_date date,
  footage_url text,
  cut_url text,

  channel text not null default 'instagram',
  -- Organic post or paid creative. Decides whether ad numbers are expected
  -- against it at all.
  kind text not null default 'organic' check (kind in ('organic', 'ad')),

  publish_on date,
  published_url text,

  status text not null default 'idea' check (status in (
    'idea', 'scripted', 'shot', 'editing', 'internal_review',
    'client_review', 'changes_requested', 'approved', 'scheduled', 'live'
  )),

  -- Self-reference: the concept this is a variant of. Null for the concept
  -- itself. Composite FK below keeps a variant inside its parent's tenant.
  parent_creative_id uuid,

  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The referenced side for a variant's composite FK (see section 1's note).
  unique (id, client_id),

  -- A campaign a creative points at must belong to the SAME client. Deleting a
  -- campaign orphans its videos rather than deleting them — the footage
  -- outlives the campaign that commissioned it.
  --
  -- ⚠️ The COLUMN LIST on `set null` is not decoration. A bare `on delete set
  -- null` against a two-column key nulls BOTH columns, and `client_id` is NOT
  -- NULL — so deleting a campaign would fail outright with a constraint
  -- violation on rows that merely referenced it. Naming the column confines the
  -- null to `campaign_id`, which is the only one that should ever be cleared.
  -- (Requires PostgreSQL 15+, which Supabase has been on since 2022.)
  constraint creatives_campaign_same_client
    foreign key (campaign_id, client_id)
    references public.marketing_campaigns (id, client_id)
    on delete set null (campaign_id),

  -- A variant belongs to the same client as its concept. Deleting the concept
  -- promotes its variants to standalone concepts; same column-list reasoning.
  constraint creatives_parent_same_client
    foreign key (parent_creative_id, client_id)
    references public.creatives (id, client_id)
    on delete set null (parent_creative_id),

  -- A row cannot be its own parent. (Deeper cycles are blocked by the trigger
  -- in section 3 — a plain check can only see this row.)
  constraint creatives_parent_not_self check (parent_creative_id is null or parent_creative_id <> id)
);

-- The three reads this table exists to serve, in the order they matter.
--
-- (a) My queue — the first screen built and the one opened most. Across ALL
--     clients, so client_id is deliberately absent from this index.
create index creatives_queue_idx
  on public.creatives (is_demo, owner_id, status, publish_on);
-- (b) The pipeline board: one client, grouped by column.
create index creatives_pipeline_idx
  on public.creatives (is_demo, client_id, status, updated_at desc);
-- (c) Shoot week: everything with a shoot date in the next fortnight. Partial,
--     because the overwhelming majority of rows have no shoot date and an index
--     over them is dead weight on every write.
create index creatives_shoot_idx
  on public.creatives (is_demo, shoot_date)
  where shoot_date is not null;
-- Variants of a concept, for the sibling strip on the detail page.
create index creatives_parent_idx
  on public.creatives (parent_creative_id)
  where parent_creative_id is not null;
-- The editor's half of "what's on my desk" — owner_id is covered by (a).
create index creatives_editor_idx
  on public.creatives (is_demo, editor_id, status)
  where editor_id is not null;

create trigger creatives_updated_at
before update on public.creatives
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Variants are one level deep
-- ---------------------------------------------------------------------------
-- The model is "a concept, and the cuts of it" — a flat sibling set. A variant
-- of a variant has no meaning here and quietly breaks every read that assumes
-- two levels: the detail page's sibling strip, and the per-creative comparison
-- that variants exist to make possible. A composite FK cannot express this and
-- a check constraint cannot see the other row, so it is a trigger.
create or replace function private.creatives_flat_variants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_creative_id is not null then
    if exists (
      select 1 from public.creatives c
      where c.id = new.parent_creative_id and c.parent_creative_id is not null
    ) then
      raise exception
        'a variant cannot have variants — point % at the original concept instead',
        new.parent_creative_id;
    end if;
    -- And nothing may become a parent's parent: if this row already has
    -- children, it is a concept and cannot also be a variant.
    if exists (select 1 from public.creatives c where c.parent_creative_id = new.id) then
      raise exception 'this creative already has variants, so it cannot become one';
    end if;
  end if;
  return new;
end;
$$;

create trigger creatives_flat_variants
before insert or update of parent_creative_id on public.creatives
for each row execute function private.creatives_flat_variants();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.creatives enable row level security;

-- ── What a client may see, and why it is less than "their own rows" ─────────
--
-- The obvious policy is `client_id = private.client_id()`. It is wrong, and
-- wrong in a way that would never produce an error: it shows the client every
-- idea in the backlog, every unfinished script, every internal note about
-- videos that may never be made. The portal's promise is "what's waiting on
-- you, and what's live" — so a client sees a creative from the moment it is
-- handed to them and never before.
--
-- `changes_requested` is included on purpose: that state is the client's own
-- request in flight, and hiding it would make their feedback appear to vanish.
create policy creatives_select on public.creatives
  for select to authenticated
  using (
    private.is_member('marketing')
    or (
      client_id = private.client_id()
      and status in ('client_review', 'changes_requested', 'approved', 'scheduled', 'live')
    )
    or (is_demo and private.in_showcase())
  );

create policy creatives_insert on public.creatives
  for insert to authenticated
  with check (private.can_write('marketing') and created_by = (select auth.uid()));

create policy creatives_update on public.creatives
  for update to authenticated
  using (private.can_write('marketing'))
  with check (private.can_write('marketing'));

create policy creatives_delete on public.creatives
  for delete to authenticated
  using (private.can_write('marketing'));

-- ---------------------------------------------------------------------------
-- 5. Campaign visibility follows the same rule
-- ---------------------------------------------------------------------------
-- 0007's campaign SELECT policy is `is_member('marketing') or (is_demo and
-- in_showcase())`, which is now incomplete in one direction and too wide in
-- another: a client cannot read the campaign behind a video they are being
-- shown, and would read every campaign if that were fixed carelessly.
--
-- Clients get campaign rows for their own tenant only. Campaign-level numbers
-- (budget, spend, retro notes) are not exposed to them by any query the portal
-- runs; this policy is what lets a creative render its campaign NAME.
drop policy marketing_campaigns_select on public.marketing_campaigns;
create policy marketing_campaigns_select on public.marketing_campaigns
  for select to authenticated
  using (
    private.is_member('marketing')
    or client_id = private.client_id()
    or (is_demo and private.in_showcase())
  );

-- ---------------------------------------------------------------------------
-- 6. Realtime
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['creatives'];
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
-- 7. Notifications for the hand-offs
-- ---------------------------------------------------------------------------
-- Three people share this work; the whole point of the status ladder is that it
-- changes hands. A video moving into editing is news to the editor. Full list
-- copied forward from 0061, which last set this constraint.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change', 'message', 'debug_note', 'learn_proof', 'learn_review',
    'creative_assigned', 'creative_status'
  ));

-- ---------------------------------------------------------------------------
-- 8. ⚠️ Retiring the shell
-- ---------------------------------------------------------------------------
-- `marketing_posts` is replaced by `creatives`: same job, a real production
-- life instead of three states, and a client dimension. `marketing_items` is a
-- flat bookmark list with no client dimension at all; per-client reference
-- material returns as `assets` in a later phase, attached to the client it
-- belongs to.
--
-- Both are dropped rather than left in place. Two dead tables carrying RLS
-- policies, showcase filters and check:demo entries are not free — they are
-- exactly the kind of thing someone later mistakes for the live model.
--
-- ⚠️ THIS IS IRREVERSIBLE AND IT IS THE ONLY DESTRUCTIVE STATEMENT IN THE
-- SEQUENCE. It rests on one claim: nothing in this section is in real use, so
-- there is no user data to preserve. Verify before applying —
--
--     select count(*) from public.marketing_posts;
--     select count(*) from public.marketing_items;
--
-- — and if either is non-zero and the rows matter, stop here and export them
-- first. CASCADE takes the policies and indexes with them; nothing else in the
-- schema references either table.
drop table if exists public.marketing_posts cascade;
drop table if exists public.marketing_items cascade;

-- ---------------------------------------------------------------------------
-- 9. Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) 0062's guarantee, re-asserted because this migration added policies.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- (b) Still nothing a client can write. creative_reviews (0064) will be the
  --     first and only exception; until then this must stay at zero.
  select string_agg(format('%s.%s (%s)', schemaname, tablename, policyname), ', ')
    into bad
  from pg_policies
  where schemaname = 'public'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(with_check, '') like '%client_id()%';
  if bad is not null then
    raise exception 'client-writable policy exists before creative_reviews: %', bad;
  end if;

  -- (c) Every table a client can SELECT from must gate on client_id(). Catches
  --     the specific mistake of adding a marketing table with a copied policy
  --     that says `is_member('marketing') or true`, or one that forgets the
  --     tenant arm entirely and so is invisible to the portal.
  select string_agg(tablename, ', ') into bad
  from (
    select distinct tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('clients', 'creatives', 'marketing_campaigns')
      and cmd = 'SELECT'
      and coalesce(qual, '') not like '%client_id()%'
  ) t;
  if bad is not null then
    raise exception 'marketing table(s) with a SELECT policy blind to the tenant: %', bad;
  end if;
end $$;
