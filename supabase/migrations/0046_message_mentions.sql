-- @mentions — the one principled exception to the anti-noise contract.
--
-- 0042 decided that the group chat NEVER notifies, and that decision is right:
-- for a team this size a busy group day would bury every other notification, and
-- the sidebar badge already carries it. But it left the room with no way to reach
-- one specific person. The only options were "say nothing and hope they scroll
-- back" or "send them a separate DM about the thing you just said" — so the group
-- chat stayed quiet in the wrong way, and people missed things addressed to them.
--
-- A mention is an explicit, per-person, sender-initiated signal. It does not
-- reopen group-wide notification: only the named people are told, and only
-- because someone deliberately named them. The contract otherwise stands
-- unchanged — no per-line pings, no bell for the room.
--
-- Mentions are stored as ROWS, not parsed out of the body at read time. The body
-- keeps plain readable text (`@Kemal`), and the ids live here, so a rename never
-- silently breaks who was addressed and the notification target is never guessed.

create table if not exists public.message_mentions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One mention per person per message; naming someone twice in a line is one
  -- mention, and this makes the insert naturally idempotent.
  primary key (message_id, user_id)
);

-- Finding "messages that mention me" is the query this exists for.
create index if not exists message_mentions_user_idx
  on public.message_mentions (user_id, created_at desc);

alter table public.message_mentions enable row level security;

-- Visible exactly where the parent message is visible — same shape as
-- message_images_select in 0044, so mention rows can never outlive the
-- readability of the line they belong to.
drop policy if exists message_mentions_select on public.message_mentions;
create policy message_mentions_select on public.message_mentions
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and (
          (m.recipient_id is null and private.is_member('work'))
          or m.sender_id = (select auth.uid())
          or m.recipient_id = (select auth.uid())
        )
    )
  );

-- You may only record mentions on your OWN message.
drop policy if exists message_mentions_insert on public.message_mentions;
create policy message_mentions_insert on public.message_mentions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = (select auth.uid())
    )
  );

-- No update or delete policy: a mention is part of the record of what was said,
-- like the message itself.

-- Column grants, per the pattern 0045 applied to the other three chat tables.
revoke insert, update, delete on table public.message_mentions from authenticated, anon;
grant select on table public.message_mentions to authenticated;
grant insert (message_id, user_id) on table public.message_mentions to authenticated;

-- Realtime (the 0029 pattern): a mention row lands a beat after its message, so
-- an open thread needs the stream to highlight it without a refresh.
do $$
begin
  execute 'alter table public.message_mentions replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_mentions'
  ) then
    execute 'alter publication supabase_realtime add table public.message_mentions';
  end if;
end $$;
