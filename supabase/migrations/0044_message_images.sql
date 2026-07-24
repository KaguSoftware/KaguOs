-- Chat images: bytes go browser -> private chat-images bucket -> index row,
-- same pattern as debug_task_images (0036). A chat image is part of a sent
-- message ("a record", no delete policy on messages) — no independent
-- delete-after-send lifecycle here either.

alter table public.messages
  drop constraint messages_body_check;
alter table public.messages
  add constraint messages_body_check check (char_length(body) between 0 and 4000);
-- "must have a body or an image" is enforced in the server action, not in
-- SQL — a check constraint can't reference another table.

create table public.message_images (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  -- Path within the chat-images bucket: "<sender_id>/<uuid>.<ext>".
  file_path text not null,
  -- Natural size, captured at upload — lets the bubble reserve its box
  -- before the signed URL resolves.
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index message_images_message_idx on public.message_images (message_id);

alter table public.message_images enable row level security;

-- Select mirrors messages_select via a join, since message_images carries no
-- recipient_id of its own.
create policy message_images_select on public.message_images
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_images.message_id
        and (
          (m.recipient_id is null and private.is_member('work'))
          or (select auth.uid()) in (m.sender_id, m.recipient_id)
        )
    )
  );

create policy message_images_insert on public.message_images
  for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_images.message_id
        and m.sender_id = (select auth.uid())
    )
  );

-- No update/delete policy — images are immutable, attached to an immutable
-- message record, same "no delete policy" rule as messages itself.

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

-- Bucket-wide is_member('work') gate, mirroring the debug bucket's (0036)
-- precedent, rather than a per-object join back to messages.recipient_id.
-- A work member could technically fetch another DM's image if they already
-- had its exact signed-URL-request path, but that path is only discoverable
-- through the RLS-protected message_images row, so this doesn't leak DM
-- images to anyone who couldn't already see the message.
create policy chat_images_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images' and private.is_member('work'));

create policy chat_images_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and private.is_member('work'));

-- No update/delete storage policies — matches "no delete" on messages.

-- Realtime: a message's images can land a beat after the message row itself
-- (two sequential inserts in sendMessage), so the OTHER party's thread view
-- needs its own INSERT stream to patch images into the message it already
-- rendered — mirrors the 0042 messages publication add.
do $$
begin
  execute 'alter table public.message_images replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_images'
  ) then
    execute 'alter publication supabase_realtime add table public.message_images';
  end if;
end $$;
