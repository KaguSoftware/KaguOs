-- 0064: the one thing a client can write.
--
-- 0062 built a principal that can read a narrow slice of one section and write
-- nothing at all. This is the exception, and it is the only one that will ever
-- be added: a decision on a cut, with a comment, optionally pinned to a second
-- of video.
--
-- ── Three properties, each load-bearing ─────────────────────────────────────
--
-- APPEND-ONLY. There is no UPDATE policy and no DELETE policy on this table,
-- for anyone, including admins. A review is not a document that gets edited
-- into its final state; it is the record of what somebody said at the time, and
-- the sequence of them IS the documentation of why a cut changed. A client who
-- can revise "approved" into "changes requested" a week later is a client with
-- whom the question "did you sign this off?" has no answer.
--
-- TIMECODES. `timecode` is the field that decides whether a review tool gets
-- used or ignored. "The hook at 0:14 is weak" is something an editor can act on
-- in one pass; "the second bit is off" costs a phone call. It is nullable
-- because a decision about the whole video is also legitimate.
--
-- THE APPROVAL MOVES THE VIDEO. A client cannot UPDATE `creatives` — there is
-- no policy that would let them, and adding one would be the mistake this whole
-- sequence exists to avoid. So the status change is a consequence of the
-- insert, applied by a SECURITY DEFINER trigger (section 4). The client's
-- single write stays a single write, and the pipeline still moves.

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
create table public.creative_reviews (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.creatives (id) on delete cascade,

  -- Denormalized off the creative. Two reasons, and the second is the one that
  -- matters: the portal reads a person's whole review history in one query
  -- without a join, and — more importantly — the RLS policy below can check the
  -- tenant on THIS row rather than through a subquery against `creatives`,
  -- whose own policy already hides most rows from a client. A policy that has
  -- to see through another policy to be correct is a policy nobody can read.
  client_id uuid not null references public.clients (id) on delete cascade,

  -- ⚠️ `on delete set null`, and therefore NULLABLE — not the `on delete
  -- cascade` every other reviewer column in this schema uses.
  --
  -- Revoking a client's login deletes their auth user. With a cascade here, the
  -- approval they gave three months ago would be deleted along with them, and
  -- an append-only table would have silently lost rows through the one door
  -- nobody thinks of as a delete. The record of what was decided has to outlive
  -- the account that decided it, which is most of the point of keeping it.
  --
  -- Renders as "a former reviewer" when null. The insert policies below still
  -- require `reviewer_id = auth.uid()`, so null is only ever reached this way.
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision text not null check (decision in ('approved', 'changes')),
  comment text,

  -- Whole seconds into the cut. Capped at 24h to catch a milliseconds-instead-
  -- of-seconds mistake at the source rather than rendering "at 3:07:41" on a
  -- forty-second video.
  timecode integer check (timecode is null or (timecode >= 0 and timecode <= 86400)),

  is_demo boolean not null default false,
  created_at timestamptz not null default now(),

  -- Asking for changes without saying what to change is not a review. Approval
  -- needs no words.
  constraint creative_reviews_changes_need_words
    check (decision = 'approved' or coalesce(comment, '') <> '')
);

-- The review thread, oldest first — the order it is read in.
create index creative_reviews_creative_idx
  on public.creative_reviews (creative_id, created_at);
-- "What has this client said lately", for the portal's own history.
create index creative_reviews_client_idx
  on public.creative_reviews (is_demo, client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Who may read one
-- ---------------------------------------------------------------------------
alter table public.creative_reviews enable row level security;

create policy creative_reviews_select on public.creative_reviews
  for select to authenticated
  using (
    private.is_member('marketing')
    or client_id = private.client_id()
    or (is_demo and private.in_showcase())
  );

-- ---------------------------------------------------------------------------
-- 3. Who may write one
-- ---------------------------------------------------------------------------
-- TWO policies, deliberately not one. Postgres ORs multiple permissive policies
-- together, so this is one rule with two arms — but written apart, each arm can
-- be read on its own and neither can be widened by accident while editing the
-- other. Combining them would produce a single `with check` in which the Kagu
-- clause and the client clause are separated by an `or` and can no longer be
-- checked independently.

-- Kagu's internal review. `can_write('marketing')`, the ordinary section gate.
create policy creative_reviews_insert_member on public.creative_reviews
  for insert to authenticated
  with check (
    private.can_write('marketing')
    and reviewer_id = (select auth.uid())
    and is_demo = false
  );

-- The client's. ⚠️ Note what is NOT in this expression: `can_write`. A client
-- can never satisfy it (0062 §4), so gating this arm on it would make the
-- feature not work; gating it on a WIDENED can_write would hand a client the
-- entire section. The gate is instead: you are an approver, on this creative's
-- tenant, and the video is actually in front of you.
--
-- `role = 'approver'` is the whole difference between the two client roles. A
-- viewer sees the same portal and this policy is the reason their decision
-- would be refused.
--
-- The status clause is what makes "in front of you" literal: a client may
-- decide on a cut only while it is in `client_review`. It stops a second
-- approval arriving against an already-approved video (which would re-fire the
-- trigger below), and it means a client cannot pre-approve something they have
-- not been shown.
create policy creative_reviews_insert_client on public.creative_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and client_id = private.client_id()
    and is_demo = false
    and exists (
      select 1 from public.client_users cu
      where cu.user_id = (select auth.uid())
        and cu.client_id = creative_reviews.client_id
        and cu.role = 'approver'
    )
    and exists (
      select 1 from public.creatives c
      where c.id = creative_reviews.creative_id
        and c.client_id = creative_reviews.client_id
        and c.status = 'client_review'
    )
  );

-- No UPDATE policy. No DELETE policy. See the header: this table is the record,
-- and a record that can be revised is a draft. The grants are revoked as well
-- as the policies omitted, so the intent survives someone adding a permissive
-- policy without reading this far.
revoke update, delete on table public.creative_reviews from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. A decision moves the video
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because the whole point is to do something the caller
-- cannot: update `creatives`, which no client policy permits.
--
-- Scope is kept as narrow as a definer function can be. It only ever touches
-- the ONE creative named by the row just inserted, it only writes the `status`
-- column, and it refuses unless that creative is currently in `client_review` —
-- so it cannot be used to drag a live video backwards or to jump the ladder.
--
-- A MEMBER's review deliberately does not move anything. Internal review is a
-- conversation among three people who are also looking at the board; the
-- one-click advance on the pipeline is how they move it, and having a comment
-- silently change a column underneath them would be worse than no automation.
create or replace function private.apply_creative_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
  producer uuid;
  video_title text;
begin
  -- Members' reviews annotate; only a client's decides.
  if not exists (
    select 1 from public.profiles p
    where p.id = new.reviewer_id and p.kind = 'client'
  ) then
    return new;
  end if;

  next_status := case new.decision
    when 'approved' then 'approved'
    else 'changes_requested'
  end;

  update public.creatives
  set status = next_status
  where id = new.creative_id
    and status = 'client_review'
  returning owner_id, title into producer, video_title;

  -- The producer hears about it. Written here rather than in the server action
  -- because 0062 closed direct notification inserts to clients — this function
  -- is the controlled path that replaced it, and it composes the title and href
  -- itself so neither can carry text a client supplied.
  if producer is not null and producer <> new.reviewer_id then
    insert into public.notifications (recipient_id, actor_id, kind, title, href)
    values (
      producer,
      new.reviewer_id,
      'creative_review',
      case new.decision
        when 'approved' then 'Client approved: ' || coalesce(video_title, 'a video')
        else 'Client asked for changes: ' || coalesce(video_title, 'a video')
      end,
      '/marketing/creatives/' || new.creative_id
    );
  end if;

  return new;
end;
$$;

create trigger creative_reviews_apply
after insert on public.creative_reviews
for each row execute function private.apply_creative_review();

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change', 'message', 'debug_note', 'learn_proof', 'learn_review',
    'creative_assigned', 'creative_status', 'creative_review'
  ));

-- ---------------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------------
-- The review thread on a creative's detail page updates live, which is the
-- point: a producer watching a cut sees the client's note land while the tab is
-- open, rather than finding it the next morning.
do $$
declare
  t text;
  tables text[] := array['creative_reviews'];
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
-- 6. Invariants
-- ---------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) 0053's rule, re-checked because this migration adds write policies.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'write policies gated by is_member(): %', bad;
  end if;

  -- (b) THE headline invariant of this whole sequence, and the reason 0062 and
  --     0063 each asserted the zero-case: creative_reviews is the ONLY table in
  --     the database a client may write to. Any other client-writable policy —
  --     added here, or in any migration after this one that copies these as a
  --     template — is a bug, and this is where it gets caught.
  select string_agg(format('%s.%s (%s)', schemaname, tablename, policyname), ', ')
    into bad
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'creative_reviews'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(with_check, '') like '%client_id()%';
  if bad is not null then
    raise exception 'a client can write outside creative_reviews: %', bad;
  end if;

  -- (c) Append-only, asserted rather than assumed. A permissive UPDATE or
  --     DELETE policy added later would silently turn the record into a draft.
  select string_agg(format('%s (%s)', policyname, cmd), ', ') into bad
  from pg_policies
  where schemaname = 'public' and tablename = 'creative_reviews'
    and cmd in ('UPDATE', 'DELETE', 'ALL');
  if bad is not null then
    raise exception 'creative_reviews is append-only, but has: %', bad;
  end if;

  -- (d) The client's insert arm must never be gated on can_write(). If someone
  --     "fixes" a failing client approval by reaching for the section gate,
  --     this is what stops it reaching production.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'creative_reviews'
      and policyname = 'creative_reviews_insert_client'
      and coalesce(with_check, '') like '%can_write%'
  ) then
    raise exception 'the client review policy is gated on can_write() — that grants the whole section';
  end if;
end $$;
