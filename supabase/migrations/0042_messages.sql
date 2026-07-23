-- Built-in messaging: 1:1 threads + one all-team group chat.
--
-- One flat table, no conversation table — 8 people, and a thread IS the
-- (sender, recipient) pair. `recipient_id` nullability carries the group:
-- null = a message to the "Everyone" chat, non-null = a direct message.
-- Chat is for the Work audience only (private.is_member('work'), which
-- includes admins — the same roster the presence panel shows).
--
-- Read tracking is split by shape:
--   * direct messages: per-row `read_at`, written by the recipient.
--   * the group chat: one last-read timestamp per user (`message_reads`) —
--     a per-row flag can't represent 7 independent readers.
--
-- No is_demo: showcase mode blocks messaging entirely, like notifications.
-- No delete policy: messages are a record.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  -- null = the Everyone group chat.
  recipient_id uuid references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  -- Direct messages only; stays null forever on group rows.
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_id is null or sender_id <> recipient_id)
);

-- Thread fetch is "either direction between two people" — one index per
-- direction; the partial ones serve the group feed and the unread badge.
create index messages_sender_idx
  on public.messages (sender_id, recipient_id, created_at desc);
create index messages_recipient_idx
  on public.messages (recipient_id, sender_id, created_at desc);
create index messages_group_idx
  on public.messages (created_at desc) where recipient_id is null;
create index messages_unread_idx
  on public.messages (recipient_id) where read_at is null;

alter table public.messages enable row level security;

create policy messages_select on public.messages
  for select to authenticated
  using (
    (recipient_id is null and private.is_member('work'))
    or (select auth.uid()) in (sender_id, recipient_id)
  );

create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_member('work')
  );

-- The recipient marks a direct message read; group rows (null recipient)
-- can never match, so they stay immutable.
create policy messages_update on public.messages
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Group-chat read marker: when did each person last open Everyone.
create table public.message_reads (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now()
);

alter table public.message_reads enable row level security;

create policy message_reads_select on public.message_reads
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy message_reads_insert on public.message_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member('work'));

create policy message_reads_update on public.message_reads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Realtime (0029 pattern): the thread view patches state in place from the
-- stream; replica identity full so RLS can verify old rows on UPDATE events.
do $$
begin
  execute 'alter table public.messages replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- New notification kind: one bell per unread 1:1 thread (never per line, and
-- never for the group chat — the sidebar badge covers that).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change', 'message'
  ));
