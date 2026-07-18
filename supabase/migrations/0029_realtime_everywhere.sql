-- Live updates on every tab.
--
-- The client uses a router.refresh() hook (useRealtimeRefresh): a change event
-- just re-pulls the already-RLS-and-showcase-filtered server render, so realtime
-- carries only a "something changed" signal, never row contents to a client.
-- RLS on the stream is unchanged — a subscriber is only told about rows its
-- SELECT policy would let it read.
--
-- For every user-facing list + notifications + presence + reminders +
-- announcements we need two things:
--   * membership in the supabase_realtime publication, and
--   * replica identity full, so a DELETE event carries the whole old row (else
--     realtime RLS can't confirm the subscriber was allowed to see the deleted
--     row and the event is dropped — the list wouldn't refresh on a delete).
--
-- This migration is written to be IDEMPOTENT: in the live project these tables
-- were already published and already set to replica identity full, so re-running
-- it (or running the whole chain fresh) must not error. Each publication add is
-- guarded by a catalog check; `replica identity full` is naturally a no-op when
-- already full.

do $$
declare
  t text;
  tables text[] := array[
    -- debug_tasks was published back in 0001 but left on replica identity
    -- default, so its UPDATE/DELETE realtime events were unreliable (old-row
    -- data missing → RLS drops them). Bring it up to full like the rest.
    'debug_tasks',
    'profiles', 'notifications', 'reminders', 'announcements',
    'projects', 'ideas', 'idea_comments', 'idea_votes',
    'contacts', 'contact_links', 'contact_interactions',
    'transactions', 'recurring_items', 'contracts',
    'marketing_campaigns', 'marketing_posts', 'marketing_items',
    'sprints', 'sprint_goals', 'sprint_goal_progress',
    'sprint_questions', 'sprint_question_replies'
  ];
begin
  foreach t in array tables loop
    -- replica identity full — safe to repeat.
    execute format('alter table public.%I replica identity full', t);

    -- Add to the realtime publication only if it isn't already a member.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', t
      );
    end if;
  end loop;
end $$;
