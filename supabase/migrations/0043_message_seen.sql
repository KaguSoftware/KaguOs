-- Seen/not-seen receipts for chat.
--
-- Read receipts need the group audience to see each other's last-read
-- marker. The old select policy only exposed your own row. A "last read the
-- group chat at time T" timestamp is exactly what a read receipt is supposed
-- to expose to the audience it's about — same audience as the messages
-- themselves, so widening this is not a new privacy surface.
--
-- No change needed for direct-message receipts: the sender can already
-- select their own sent rows (messages_select: auth.uid() in (sender_id,
-- recipient_id)), so read_at on a message I sent is already visible to me.

drop policy message_reads_select on public.message_reads;

create policy message_reads_select on public.message_reads
  for select to authenticated
  using (private.is_member('work'));

-- Realtime, so "seen by" updates live the moment a teammate opens the
-- thread — mirrors the 0042 messages publication add.
do $$
begin
  execute 'alter table public.message_reads replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reads'
  ) then
    execute 'alter publication supabase_realtime add table public.message_reads';
  end if;
end $$;
