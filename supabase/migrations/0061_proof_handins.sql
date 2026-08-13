-- 0061: A proof is work you hand in, not a line you tick.
--
-- 0056 gave each stage a proof: one sentence under a PROOF rule, and a goal row
-- with the same wording that you ticked like any other. That made the gate of a
-- two-day stage cost exactly one click, and left nothing behind — no way for
-- anyone to see WHAT you routed, WHICH prompt you rebuilt, or whether the thing
-- you ticked was the thing the stage asked for.
--
-- So a proof grows three parts:
--
--   1. A brief — what to actually do, in a paragraph rather than a line.
--   2. Acceptance — the conditions the hand-in has to meet, as rows you can
--      read down and check yourself against before you send it.
--   3. A hand-in — free text and/or one file (a prompt, a transcript, a code
--      file, a screenshot), stored per person and reviewable by an admin.
--
-- The tick and the hand-in are ONE action, not two. `submitProof` writes the
-- submission and the `sprint_goal_progress` row together, so a proof goal can't
-- read done with nothing behind it, and clearing a stage still costs one
-- action. Withdrawing takes both away again.
--
-- Review is a second, later opinion — NOT a gate. The stage clears when you
-- hand in; an admin accepting or asking for changes annotates that, and never
-- blocks the rail. Same reasoning as the soft stage gating in 0056: a hard
-- gate would mean a stage stays dark all weekend because nobody was at a desk
-- to look at it, which is the ten-click flow the product principles ban wearing
-- a different hat.
--
-- Everything here is optional. A sprint with no briefs, no criteria and no
-- hand-ins renders exactly as it does today.

-- ---- 1. Longer copy on the shapes that already exist ----------------------
--
-- `summary` is the one line under a stage title and stays that; `detail` is the
-- two or three paragraphs behind it, shown when the stage is open. Splitting
-- them rather than growing `summary` keeps the collapsed card the same size.
alter table public.sprint_stages
  add column detail text,
  -- The proof, at length. `proof` stays the one-line gate — it's what the
  -- milestone list and the collapsed card show — and this is the brief you read
  -- before doing it.
  add column proof_brief text,
  -- What to hand in, in the imperative ("Paste the before and after prompt, and
  -- attach the file you generated"). Rendered above the hand-in box.
  add column proof_submit text;

-- A goal is a line; this is the sentence under it that says what the line
-- means. Nullable, so every goal that exists keeps rendering as a bare line.
alter table public.sprint_goals add column detail text;

-- ---- 2. Acceptance criteria ------------------------------------------------
--
-- Rows, not one text blob with newlines in it: they're read one at a time,
-- counted ("4 conditions"), and an admin reviewing a hand-in reads down them.
-- They carry no per-person state — nothing is ticked here — because the tick
-- that matters is the hand-in itself, and a checklist you tick to unlock a
-- checklist is exactly the enterprise bloat the principles ban.
create table public.sprint_proof_criteria (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.sprint_stages (id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index sprint_proof_criteria_stage_idx
  on public.sprint_proof_criteria (is_demo, stage_id, sort_order);

-- ---- 3. The hand-in --------------------------------------------------------
--
-- One row per person per stage (`unique (stage_id, user_id)`): handing in again
-- edits what you handed in rather than stacking copies, which is what "here's
-- my proof" means. `sprint_id` is denormalized off the stage so the sprint page
-- can read every hand-in in one query without a join.
--
-- Body and file are both optional but at least one is required — a hand-in with
-- neither is a tick with extra steps, and the check refuses it in the database
-- rather than trusting every caller.
create table public.sprint_proof_submissions (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.sprint_stages (id) on delete cascade,
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  -- Path inside the private `learn` bucket: "proof/<user_id>/<sprint_id>/…".
  -- The prefix is what the storage policy below gates on.
  file_path text,
  -- The original filename, kept so the link reads "routing.md" rather than a
  -- uuid. Storage paths are uniquified; this is what a human called it.
  file_name text,
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'changes_requested')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, user_id),
  constraint sprint_proof_submissions_has_content
    check (coalesce(body, '') <> '' or file_path is not null)
);
-- The sprint page's two reads: every hand-in for one sprint (admin review
-- panel) and, inside that, the ones waiting on someone.
create index sprint_proof_submissions_sprint_idx
  on public.sprint_proof_submissions (is_demo, sprint_id, status, created_at desc);

-- ---- RLS -------------------------------------------------------------------
alter table public.sprint_proof_criteria enable row level security;
alter table public.sprint_proof_submissions enable row level security;

-- Criteria are program content: same shape as sprint_stages (members read,
-- admins write, demo rows visible in showcase).
create policy sprint_proof_criteria_select on public.sprint_proof_criteria
  for select to authenticated
  using (private.is_member('learn') or (is_demo and private.in_showcase()));

create policy sprint_proof_criteria_admin_write on public.sprint_proof_criteria
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- A hand-in is yours and the reviewers'. Deliberately NOT readable by the rest
-- of the section: the standings say you cleared Prompting, and that's the
-- public fact. The prompt you rebuilt, from your own work, is not.
create policy sprint_proof_submissions_select on public.sprint_proof_submissions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_admin()
    or (is_demo and private.in_showcase())
  );

-- can_write, not is_member (0053), and a participant of this sprint: same gate
-- the goal tick carries, because handing in IS the tick.
create policy sprint_proof_submissions_insert on public.sprint_proof_submissions
  for insert to authenticated
  with check (
    private.can_write('learn')
    and user_id = (select auth.uid())
    and is_demo = false
    and status = 'submitted'
    and reviewed_by is null
    and exists (
      -- Table-qualified on purpose: an unqualified `sprint_id` inside this
      -- subquery would bind to sp's own column and quietly always hold.
      select 1 from public.sprint_participants sp
      where sp.sprint_id = sprint_proof_submissions.sprint_id
        and sp.user_id = (select auth.uid())
    )
  );

-- Editing your own hand-in puts it BACK in review (`status = 'submitted'`,
-- reviewer fields cleared). Without that clause the with_check would happily
-- let you mark your own work accepted, which is the one thing this table
-- exists to prevent.
create policy sprint_proof_submissions_update_own on public.sprint_proof_submissions
  for update to authenticated
  using (private.can_write('learn') and user_id = (select auth.uid()))
  with check (
    private.can_write('learn')
    and user_id = (select auth.uid())
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and review_note is null
  );

-- Withdrawing. Allowed at any point: it takes the goal tick with it (see
-- `withdrawProof`), so it's a retraction, not a way to hide a bad review.
create policy sprint_proof_submissions_delete_own on public.sprint_proof_submissions
  for delete to authenticated
  using (private.can_write('learn') and user_id = (select auth.uid()));

-- Reviewers. Separate policy rather than a wider own-row one, so the only way
-- to write 'accepted' into this table is to be an admin.
create policy sprint_proof_submissions_admin_review on public.sprint_proof_submissions
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---- Storage: the file half of a hand-in -----------------------------------
--
-- The `learn` bucket's insert policy (0004) is admin-only, which is right for
-- program resources and wrong for hand-ins. This adds one narrow exception:
-- a learn writer may write under "proof/<their own uid>/…" and nowhere else.
-- Reads stay on the existing bucket-wide member policy — a learn member who
-- already had the exact path could fetch someone's proof file, but paths are
-- only discoverable through the RLS-protected row above, so this leaks nothing
-- that wasn't already visible. (Same reasoning as the chat-images bucket, 0044.)
create policy learn_proof_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learn'
    and private.can_write('learn')
    and (storage.foldername(name))[1] = 'proof'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Replacing a file leaves the old object behind unless the owner can remove it.
create policy learn_proof_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'learn'
    and private.can_write('learn')
    and (storage.foldername(name))[1] = 'proof'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ---- Notifications ---------------------------------------------------------
-- A hand-in pings the admins; a review pings the person who handed in. Full
-- list copied from 0054, which last set this constraint.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change', 'message', 'debug_note', 'learn_proof', 'learn_review'
  ));

-- ---- Realtime: same treatment as every other user-facing list (0029) -------
do $$
declare
  t text;
  tables text[] := array['sprint_proof_criteria', 'sprint_proof_submissions'];
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

-- ---- Invariant, re-checked rather than trusted (same rule as 0053 §7) ------
-- 0053 enforced "no write policy consults is_member()" at its own migration
-- time, which cannot see policies added afterwards. Repeated here because this
-- migration adds write policies, including two on storage.objects.
do $$
declare
  bad text;
begin
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
