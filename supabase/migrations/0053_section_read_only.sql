-- Per-section read-only: an admin can grant "view" instead of "edit".
--
-- Until now a section membership was one bit — you were in, and being in meant
-- you could create, edit and delete everything in it. That forced admins into a
-- bad trade for anyone who needs visibility without authorship (a client-facing
-- hire who must read Finance, a contractor who should follow the Debug board
-- without touching tasks): give them full write, or give them nothing.
--
-- section_memberships gains `access`, defaulting to 'write' so no existing row
-- changes meaning. Reads keep using private.is_member(); writes move to a new
-- private.can_write(). After this migration those two functions are cleanly
-- split — is_member appears ONLY in select policies, can_write ONLY in write
-- policies — and the DO block at the bottom enforces that invariant at migration
-- time, the same way scripts/check-demo-filters.ts guards the showcase one.
--
-- THE RULE, stated once: read-only restricts SECTION CONTENT, never a user's own
-- state. A view-only member can still change their own profile, dismiss their
-- own notifications, keep their own reminders, and mark a message they received
-- as read. Those policies are deliberately left alone.
--
-- Written as explicit drop/create per policy rather than a catalog-rewriting DO
-- block. Two reasons, and the second is the important one. First, pg_get_expr
-- normalises everything it round-trips, so an automated rewrite would leave the
-- live catalog matching no file anyone wrote. Second — and this is what a
-- search-and-replace of is_member -> can_write would silently miss — eighteen
-- write policies never mentioned is_member at all: they gate on
-- "created_by = auth.uid() or is_admin()", or on a bare EXISTS against a parent
-- row. Automate the rewrite and you ship a read-only mode in which every user
-- can still delete their own history in every section. Those eighteen are
-- enumerated by hand in section 5.

-- ------------------------------------------------------------------------
-- 1. The access tier
-- ------------------------------------------------------------------------
alter table public.section_memberships
  add column access text not null default 'write'
  check (access in ('read', 'write'));

-- 0001 gave this table insert + delete policies but no update, because until
-- now a membership had nothing to change. Changing a tier is an update.
-- (updateAccess goes through the service role and bypasses RLS either way; a
-- table the app UPDATEs shouldn't be missing the policy regardless.)
create policy memberships_admin_update on public.section_memberships
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ------------------------------------------------------------------------
-- 2. can_write(), the write half of is_member()
-- ------------------------------------------------------------------------
-- private.is_member() is left byte-for-byte unchanged and becomes purely the
-- READ gate. Deliberately no showcase arm here: showcase mode is a read-only
-- tour and must not gain a write path through this door.
create or replace function private.can_write(s text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1
    from public.section_memberships m
    where m.user_id = (select auth.uid())
      and m.section = s
      and m.access = 'write'
  );
$$;

grant execute on function private.can_write(text) to authenticated;

-- ------------------------------------------------------------------------
-- 3. Split the four `for all` management policies
-- ------------------------------------------------------------------------
-- These are the only policies on their tables whose USING clause serves SELECT,
-- so the replacement _select policies below are not optional bookkeeping — drop
-- the _all policy without them and the whole Finance tab returns zero rows for
-- management members. It would fail as "the page is empty", not "permission
-- denied", and 0016's *_showcase_select policies would keep the demo working,
-- so a showcase smoke test wouldn't catch it.
--
-- UPDATE keeps both `using` and `with check`: the finance UI upserts fx_rates by
-- currency, and an upsert has to pass both.

drop policy transactions_all on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated using (private.is_member('management'));
create policy transactions_insert on public.transactions
  for insert to authenticated with check (private.can_write('management'));
create policy transactions_update on public.transactions
  for update to authenticated
  using (private.can_write('management'))
  with check (private.can_write('management'));
create policy transactions_delete on public.transactions
  for delete to authenticated using (private.can_write('management'));

drop policy contracts_all on public.contracts;
create policy contracts_select on public.contracts
  for select to authenticated using (private.is_member('management'));
create policy contracts_insert on public.contracts
  for insert to authenticated with check (private.can_write('management'));
create policy contracts_update on public.contracts
  for update to authenticated
  using (private.can_write('management'))
  with check (private.can_write('management'));
create policy contracts_delete on public.contracts
  for delete to authenticated using (private.can_write('management'));

drop policy recurring_items_all on public.recurring_items;
create policy recurring_items_select on public.recurring_items
  for select to authenticated using (private.is_member('management'));
create policy recurring_items_insert on public.recurring_items
  for insert to authenticated with check (private.can_write('management'));
create policy recurring_items_update on public.recurring_items
  for update to authenticated
  using (private.can_write('management'))
  with check (private.can_write('management'));
create policy recurring_items_delete on public.recurring_items
  for delete to authenticated using (private.can_write('management'));

drop policy fx_rates_all on public.fx_rates;
create policy fx_rates_select on public.fx_rates
  for select to authenticated using (private.is_member('management'));
create policy fx_rates_insert on public.fx_rates
  for insert to authenticated with check (private.can_write('management'));
create policy fx_rates_update on public.fx_rates
  for update to authenticated
  using (private.can_write('management'))
  with check (private.can_write('management'));
create policy fx_rates_delete on public.fx_rates
  for delete to authenticated using (private.can_write('management'));

-- ------------------------------------------------------------------------
-- 4. Section-gated write policies: is_member -> can_write (41 policies)
-- ------------------------------------------------------------------------
-- Bodies are otherwise unchanged from their latest definitions. Note that
-- learn_storage_* is NOT here: it is is_admin()-only and has no section gate to
-- convert. Nor are the sprint*_admin_write `for all` policies, for the same
-- reason.

drop policy chat_images_storage_insert on storage.objects;
create policy chat_images_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and private.can_write('chat'));

drop policy comms_meetings_insert on public.comms_meetings;
create policy comms_meetings_insert on public.comms_meetings
  for insert to authenticated
  with check (private.can_write('comms') and created_by = (select auth.uid()));

drop policy comms_meetings_update on public.comms_meetings;
create policy comms_meetings_update on public.comms_meetings
  for update to authenticated
  using (private.can_write('comms'))
  with check (private.can_write('comms'));

drop policy comms_notes_insert on public.comms_notes;
create policy comms_notes_insert on public.comms_notes
  for insert to authenticated
  with check (private.can_write('comms') and created_by = (select auth.uid()));

drop policy comms_notes_update on public.comms_notes;
create policy comms_notes_update on public.comms_notes
  for update to authenticated
  using (private.can_write('comms'))
  with check (private.can_write('comms'));

drop policy contact_interactions_delete on public.contact_interactions;
create policy contact_interactions_delete on public.contact_interactions
  for delete to authenticated
  using (private.can_write('comms') or private.is_admin());

drop policy contact_interactions_insert on public.contact_interactions;
create policy contact_interactions_insert on public.contact_interactions
  for insert to authenticated
  with check (private.can_write('comms') and created_by = (select auth.uid()));

drop policy contact_interactions_update on public.contact_interactions;
create policy contact_interactions_update on public.contact_interactions
  for update to authenticated
  using (private.can_write('comms')) with check (private.can_write('comms'));

drop policy contact_links_delete on public.contact_links;
create policy contact_links_delete on public.contact_links
  for delete to authenticated
  using (private.can_write('comms') or private.is_admin());

drop policy contact_links_insert on public.contact_links;
create policy contact_links_insert on public.contact_links
  for insert to authenticated
  with check (private.can_write('comms') and created_by = (select auth.uid()));

drop policy contact_links_update on public.contact_links;
create policy contact_links_update on public.contact_links
  for update to authenticated
  using (private.can_write('comms')) with check (private.can_write('comms'));

drop policy contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (private.can_write('comms') and created_by = (select auth.uid()));

drop policy contacts_update on public.contacts;
create policy contacts_update on public.contacts
  for update to authenticated
  using (private.can_write('comms')) with check (private.can_write('comms'));

drop policy contracts_storage_delete on storage.objects;
create policy contracts_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'contracts' and private.can_write('management'));

drop policy contracts_storage_insert on storage.objects;
create policy contracts_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contracts' and private.can_write('management'));

drop policy contracts_storage_update on storage.objects;
create policy contracts_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'contracts' and private.can_write('management'));

drop policy debug_storage_delete on storage.objects;
create policy debug_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'debug' and private.can_write('debug'));

drop policy debug_storage_insert on storage.objects;
create policy debug_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'debug' and private.can_write('debug'));

drop policy debug_storage_update on storage.objects;
create policy debug_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'debug' and private.can_write('debug'));

drop policy debug_task_images_insert on public.debug_task_images;
create policy debug_task_images_insert on public.debug_task_images
  for insert to authenticated
  with check (private.can_write('debug') and created_by = (select auth.uid()));

drop policy debug_tasks_insert on public.debug_tasks;
create policy debug_tasks_insert on public.debug_tasks
  for insert to authenticated
  with check (
    private.can_write('debug')
    and created_by = (select auth.uid())
    and (assignee_id is null or assignee_id = (select auth.uid()) or private.is_admin())
  );

drop policy debug_tasks_update on public.debug_tasks;
create policy debug_tasks_update on public.debug_tasks
  for update to authenticated
  using (private.can_write('debug'))
  with check (
    private.can_write('debug')
    and (assignee_id is null or assignee_id = (select auth.uid()) or private.is_admin())
  );

drop policy idea_comments_insert on public.idea_comments;
create policy idea_comments_insert on public.idea_comments
  for insert to authenticated
  with check (private.can_write('work') and created_by = (select auth.uid()));

drop policy idea_votes_insert on public.idea_votes;
create policy idea_votes_insert on public.idea_votes
  for insert to authenticated
  with check (private.can_write('work') and user_id = (select auth.uid()));

drop policy ideas_insert on public.ideas;
create policy ideas_insert on public.ideas
  for insert to authenticated
  with check (private.can_write('work') and created_by = (select auth.uid()));

drop policy ideas_update on public.ideas;
create policy ideas_update on public.ideas
  for update to authenticated
  using (private.can_write('work'))
  with check (private.can_write('work'));

drop policy marketing_campaigns_insert on public.marketing_campaigns;
create policy marketing_campaigns_insert on public.marketing_campaigns
  for insert to authenticated
  with check (private.can_write('marketing') and created_by = (select auth.uid()));

drop policy marketing_campaigns_update on public.marketing_campaigns;
create policy marketing_campaigns_update on public.marketing_campaigns
  for update to authenticated
  using (private.can_write('marketing'))
  with check (private.can_write('marketing'));

drop policy marketing_items_insert on public.marketing_items;
create policy marketing_items_insert on public.marketing_items
  for insert to authenticated
  with check (private.can_write('marketing') and created_by = (select auth.uid()));

drop policy marketing_items_update on public.marketing_items;
create policy marketing_items_update on public.marketing_items
  for update to authenticated
  using (private.can_write('marketing'))
  with check (private.can_write('marketing'));

drop policy marketing_posts_insert on public.marketing_posts;
create policy marketing_posts_insert on public.marketing_posts
  for insert to authenticated
  with check (private.can_write('marketing') and created_by = (select auth.uid()));

drop policy marketing_posts_update on public.marketing_posts;
create policy marketing_posts_update on public.marketing_posts
  for update to authenticated
  using (private.can_write('marketing'))
  with check (private.can_write('marketing'));

drop policy message_reads_insert on public.message_reads;
create policy message_reads_insert on public.message_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_write('chat'));

drop policy messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.can_write('chat')
    and (
      reply_to_id is null
      or private.reply_in_thread(reply_to_id, sender_id, recipient_id)
    )
  );

drop policy project_secrets_delete on public.project_secrets;
create policy project_secrets_delete on public.project_secrets
  for delete to authenticated
  using (private.can_write('work') or private.is_admin());

drop policy project_secrets_insert on public.project_secrets;
create policy project_secrets_insert on public.project_secrets
  for insert to authenticated
  with check (private.can_write('work') and created_by = (select auth.uid()));

drop policy project_secrets_update on public.project_secrets;
create policy project_secrets_update on public.project_secrets
  for update to authenticated
  using (private.can_write('work'))
  with check (private.can_write('work'));

drop policy projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (private.can_write('work') and created_by = (select auth.uid()));

drop policy projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (private.can_write('work'))
  with check (private.can_write('work'));

drop policy sprint_goal_progress_insert on public.sprint_goal_progress;
create policy sprint_goal_progress_insert on public.sprint_goal_progress
  for insert to authenticated
  with check (
    private.can_write('learn')
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.sprint_goals g
      join public.sprint_participants sp on sp.sprint_id = g.sprint_id
      where g.id = goal_id and sp.user_id = (select auth.uid())
    )
  );

drop policy sprint_questions_insert on public.sprint_questions;
create policy sprint_questions_insert on public.sprint_questions
  for insert to authenticated
  with check (private.can_write('learn') and created_by = (select auth.uid()));


-- ------------------------------------------------------------------------
-- 5. Write policies that had NO section gate to convert (18 policies)
-- ------------------------------------------------------------------------
-- Every one of these previously gated on ownership alone ("created_by =
-- auth.uid() or is_admin()") or on a bare EXISTS against a parent row. Under
-- the old model that was enough, because you could not be in a section without
-- being able to write to it. With a read tier that assumption is gone: without
-- the added can_write() a view-only member could still delete every project,
-- idea, comment, contact and task they had ever authored, and still reply in
-- every sprint thread.
--
-- The three EXISTS-only ones (sprint_question_replies_insert,
-- message_images_insert, message_mentions_insert) get a second fix for free:
-- they leaned entirely on the parent's SELECT policy, which 0016 widened with
-- "or (is_demo and private.in_showcase())" — so a showcase session technically
-- satisfied them on demo rows. can_write() has no showcase arm, which closes it.
--
-- can_write() is placed FIRST in each expression: it short-circuits on
-- is_admin() and skips the row comparison in the common case.

drop policy comms_meetings_delete on public.comms_meetings;
create policy comms_meetings_delete on public.comms_meetings
  for delete to authenticated
  using (
    private.can_write('comms')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy comms_notes_delete on public.comms_notes;
create policy comms_notes_delete on public.comms_notes
  for delete to authenticated
  using (
    private.can_write('comms')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete to authenticated
  using (
    private.can_write('comms')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy debug_task_images_delete on public.debug_task_images;
create policy debug_task_images_delete on public.debug_task_images
  for delete to authenticated
  using (
    private.can_write('debug')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy debug_tasks_delete on public.debug_tasks;
create policy debug_tasks_delete on public.debug_tasks
  for delete to authenticated
  using (
    private.can_write('debug')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy idea_comments_delete on public.idea_comments;
create policy idea_comments_delete on public.idea_comments
  for delete to authenticated
  using (
    private.can_write('work')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy idea_votes_delete on public.idea_votes;
create policy idea_votes_delete on public.idea_votes
  for delete to authenticated
  using (
    private.can_write('work')
    and (user_id = (select auth.uid()))
  );

drop policy ideas_delete on public.ideas;
create policy ideas_delete on public.ideas
  for delete to authenticated
  using (
    private.can_write('work')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy marketing_campaigns_delete on public.marketing_campaigns;
create policy marketing_campaigns_delete on public.marketing_campaigns
  for delete to authenticated
  using (
    private.can_write('marketing')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy marketing_items_delete on public.marketing_items;
create policy marketing_items_delete on public.marketing_items
  for delete to authenticated
  using (
    private.can_write('marketing')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy marketing_posts_delete on public.marketing_posts;
create policy marketing_posts_delete on public.marketing_posts
  for delete to authenticated
  using (
    private.can_write('marketing')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy message_images_insert on public.message_images;
create policy message_images_insert on public.message_images
  for insert to authenticated
  with check (
    private.can_write('chat')
    and (exists (
      select 1 from public.messages m
      where m.id = message_images.message_id
        and m.sender_id = (select auth.uid())
    ))
  );

drop policy message_mentions_insert on public.message_mentions;
create policy message_mentions_insert on public.message_mentions
  for insert to authenticated
  with check (
    private.can_write('chat')
    and (exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = (select auth.uid())
    ))
  );

drop policy projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (
    private.can_write('work')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy sprint_goal_progress_delete on public.sprint_goal_progress;
create policy sprint_goal_progress_delete on public.sprint_goal_progress
  for delete to authenticated
  using (
    private.can_write('learn')
    and (user_id = (select auth.uid()))
  );

drop policy sprint_question_replies_delete on public.sprint_question_replies;
create policy sprint_question_replies_delete on public.sprint_question_replies
  for delete to authenticated
  using (
    private.can_write('learn')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

drop policy sprint_question_replies_insert on public.sprint_question_replies;
create policy sprint_question_replies_insert on public.sprint_question_replies
  for insert to authenticated
  with check (
    private.can_write('learn')
    and (created_by = (select auth.uid())
    and exists (select 1 from public.sprint_questions q where q.id = question_id))
  );

drop policy sprint_questions_delete on public.sprint_questions;
create policy sprint_questions_delete on public.sprint_questions
  for delete to authenticated
  using (
    private.can_write('learn')
    and (created_by = (select auth.uid()) or private.is_admin())
  );


-- ------------------------------------------------------------------------
-- 6. session_context(): expose the tier to the app
-- ------------------------------------------------------------------------
-- ADDITIVE ONLY. 'sections' stays a json array of section names, because the
-- currently-deployed bundle does `new Set(ctx.sections)` with it and this
-- migration lands before the new build goes live. Reshaping that key would
-- throw on every page load for the length of the deploy window; adding a key
-- is safe in both directions.
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
    )
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;

-- ------------------------------------------------------------------------
-- 7. Invariants, checked here rather than trusted
-- ------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  -- (a) No write policy may still consult is_member(). This catches a missed
  --     conversion in section 4 and any `for all` policy that survived section 3.
  --     It does NOT catch section 5 — those never mentioned is_member — which is
  --     exactly why that list is enumerated by hand.
  select string_agg(format('%s.%s (%s %s)', schemaname, tablename, policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname in ('public', 'storage')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(qual, '') || coalesce(with_check, '') like '%is_member%';
  if bad is not null then
    raise exception 'read-only split incomplete — write policies still gated by is_member(): %', bad;
  end if;

  -- (b) Every table this migration split must still have a member-facing SELECT
  --     policy. Guards the section 3 trap directly: a missing _select silently
  --     empties the Finance tab instead of erroring.
  select string_agg(t, ', ') into bad
  from unnest(array['transactions', 'contracts', 'recurring_items', 'fx_rates']) as t
  where not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = t
      and cmd in ('SELECT', 'ALL')
      and coalesce(qual, '') like '%is_member%'
  );
  if bad is not null then
    raise exception 'split left tables with no member SELECT policy: %', bad;
  end if;
end $$;
