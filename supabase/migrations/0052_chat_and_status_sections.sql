-- Chat and Status become their own sections instead of riding on Work.
--
-- 0042 gated the whole chat feature on private.is_member('work') because, at
-- the time, "the work team" and "the people who talk to each other" were the
-- same list. They aren't any more: there are contractors who belong on the Work
-- board but shouldn't be in the company chat, and people who need the chat and
-- nothing else. With one gate an admin could grant neither independently.
--
-- 'chat' is a full section like the rest — it appears in the admin checkboxes,
-- the sidebar filter, and the page guards.
--
-- 'status' is the second half of the split, and it is deliberately NOT the same
-- thing as chat. getPresence() serves two jobs at once: it is the DM contact
-- list AND the status panel. Gating both on one flag would mean revoking
-- someone's status also emptied their chat roster, which is not a choice an
-- admin should have to make. So:
--
--   chat   → the roster (who exists, name + colour) + reading/sending messages
--   status → the status LAYER on top of that roster: the live online dot, the
--            status emoji/note, available-to-call, and the editor for your own
--
-- Someone with chat but not status sees a plain contact list and can talk to
-- everyone; they simply don't take part in the status system. They still
-- broadcast presence, because whether a teammate sees you online is that
-- teammate's access question, not yours. There is no 'status' RLS: the status
-- columns live on profiles, which every signed-in user can already read (0027)
-- — this section gates the FEATURE, and the only write path, updateMyStatus,
-- enforces it server-side.
--
-- ORDERING MATTERS, and this file must stay one migration. The backfill has to
-- commit with the policy swap: if the policies flipped to 'chat' before every
-- Work member had a chat row, every non-admin would lose chat the instant it
-- landed — and whoever ran the migration wouldn't see it, because is_member()
-- short-circuits on is_admin().

-- ------------------------------------------------------------------------
-- 1. Widen the section vocabulary (same drop/add shape as 0013)
-- ------------------------------------------------------------------------
alter table public.section_memberships
  drop constraint section_memberships_section_check;

alter table public.section_memberships
  add constraint section_memberships_section_check
  check (section in (
    'work', 'learn', 'management', 'debug', 'marketing', 'comms', 'chat', 'status'
  ));

-- ------------------------------------------------------------------------
-- 2. Backfill: everyone who has chat + status today (i.e. everyone in Work,
--    since that was the single gate) keeps both. Nobody loses anything here.
-- ------------------------------------------------------------------------
insert into public.section_memberships (user_id, section)
select m.user_id, s.section
from public.section_memberships m
cross join (values ('chat'), ('status')) as s (section)
where m.section = 'work'
on conflict do nothing;

-- Admins need no row — is_member() returns true for them unconditionally.

-- ------------------------------------------------------------------------
-- 3. Re-gate every chat policy from 'work' to 'chat'
-- ------------------------------------------------------------------------

-- messages: only the GROUP arm is section-gated. The direct-message arm stays
-- "am I one of the two people", which is not a section question.
drop policy messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    (recipient_id is null and private.is_member('chat'))
    or (select auth.uid()) in (sender_id, recipient_id)
  );

-- Recreated from the 0050 body (the reply-thread guard), NOT 0042's or 0049's —
-- 0049's version recursed and 0050 replaced it with private.reply_in_thread().
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_member('chat')
    and (
      reply_to_id is null
      or private.reply_in_thread(reply_to_id, sender_id, recipient_id)
    )
  );

-- messages_update (recipient stamps read_at) has no section predicate — it's
-- personal state, and stays untouched.

drop policy message_reads_select on public.message_reads;
create policy message_reads_select on public.message_reads
  for select to authenticated
  using (private.is_member('chat'));

drop policy message_reads_insert on public.message_reads;
create policy message_reads_insert on public.message_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member('chat'));

drop policy message_images_select on public.message_images;
create policy message_images_select on public.message_images
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_images.message_id
        and (
          (m.recipient_id is null and private.is_member('chat'))
          or (select auth.uid()) in (m.sender_id, m.recipient_id)
        )
    )
  );

drop policy message_mentions_select on public.message_mentions;
create policy message_mentions_select on public.message_mentions
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and (
          (m.recipient_id is null and private.is_member('chat'))
          or m.sender_id = (select auth.uid())
          or m.recipient_id = (select auth.uid())
        )
    )
  );

-- Storage: the chat-images bucket follows its audience.
drop policy chat_images_storage_select on storage.objects;
create policy chat_images_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images' and private.is_member('chat'));

drop policy chat_images_storage_insert on storage.objects;
create policy chat_images_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and private.is_member('chat'));
