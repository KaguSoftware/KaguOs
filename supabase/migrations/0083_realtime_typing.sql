-- Typing indicators: authorize the private broadcast topics they ride on.
--
-- This is the first thing in the app to use Realtime BROADCAST rather than
-- postgres_changes. The difference matters: a typing signal is not a fact about
-- the company, it's a thing that is true for four seconds. Writing it to a table
-- would mean a row insert, a WAL record, an RLS evaluation per subscriber and a
-- router.refresh() per keystroke, to store something nobody ever wants to read
-- back. Broadcast is a pure pipe on the socket every client already holds: the
-- payload goes straight from one browser to the others and touches no table.
--
-- Because it touches no table, none of the app's existing RLS applies to it —
-- so authorization has to be stated here instead. Supabase gates private
-- channels on RLS over `realtime.messages`, where `realtime.topic()` is the
-- channel name the client asked to join. No policy = no access, which is why
-- the channels must be created with `config: { private: true }` on the client
-- (lib/use-typing.ts) or they would be world-readable by anyone holding the
-- anon key.
--
-- TOPIC SHAPE.
--   typing:team                    the all-team group chat
--   typing:dm:<uuid_lo>:<uuid_hi>  one direct-message thread
--
-- The DM pair is SORTED. A thread is identified from each side by the other
-- person (components/messages/thread.tsx keys its postgres_changes channel as
-- `messages-${otherId}`), which is fine when each client gets its own
-- RLS-filtered stream — but broadcast needs both ends on the SAME topic, and
-- "the other person" names a different topic depending on who is asking.
-- Sorting the two ids gives one canonical name for the pair.
--
-- Membership mirrors public.messages exactly: the group topic needs
-- private.is_member('work') (the roster that can see the group chat at all),
-- and a DM topic additionally requires you to be one of the two participants.

create or replace function private.can_use_typing_topic(t text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when t = 'typing:team' then private.is_member('work')
    -- split_part returns '' for a missing segment, and '' never casts to a
    -- uuid — so a malformed topic fails the comparison rather than erroring.
    when t like 'typing:dm:%' then
      private.is_member('work')
      and (select auth.uid())::text in (
        split_part(t, ':', 3),
        split_part(t, ':', 4)
      )
    else false
  end;
$$;

grant execute on function private.can_use_typing_topic(text) to authenticated;

-- These policies only do anything if RLS is actually on. Supabase ships
-- realtime.messages with it enabled, but fail loudly rather than quietly
-- publishing every typing topic to anyone holding the anon key if that ever
-- stops being true — a silently-open channel is the worst outcome here.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime' and c.relname = 'messages' and c.relrowsecurity
  ) then
    raise exception
      'realtime.messages does not have RLS enabled; private broadcast channels would be unauthorized';
  end if;
end
$$;

-- Idempotent in the style of the rest of the migrations: re-running must not
-- fail on an already-created policy.
drop policy if exists chat_typing_receive on realtime.messages;
create policy chat_typing_receive on realtime.messages
  for select to authenticated
  using (private.can_use_typing_topic(realtime.topic()));

drop policy if exists chat_typing_send on realtime.messages;
create policy chat_typing_send on realtime.messages
  for insert to authenticated
  with check (private.can_use_typing_topic(realtime.topic()));
