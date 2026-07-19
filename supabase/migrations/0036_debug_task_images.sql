-- Debug: tasks can carry screenshots.
--
-- "the button looks wrong" is the most common bug report we get and the least
-- actionable one, because the picture never travels with it. Rows here, bytes
-- in a private `debug` bucket.
--
-- Write access is MEMBER, not admin — deliberately unlike the `learn` bucket
-- (0004), which is admin-write. A screenshot is part of reporting a bug, so
-- gating it to admins would make reporting worse for exactly the people who
-- report the most.

create table public.debug_task_images (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.debug_tasks(id) on delete cascade,
  -- Path within the `debug` storage bucket: "<task_id>/<uuid>.<ext>".
  file_path text not null,
  -- Natural size, captured at upload. Lets the thumbnail reserve its box
  -- before the signed URL resolves, so the row doesn't jump.
  width int,
  height int,
  -- Showcase rows. Every debug query already scopes by this; the image query
  -- must too, or demo tasks show real screenshots.
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index debug_task_images_task_idx on public.debug_task_images (task_id);

alter table public.debug_task_images enable row level security;

-- Mirrors debug_tasks' post-0016 select policy: showcase viewers who aren't
-- debug members still see demo rows, and only demo rows.
create policy debug_task_images_select on public.debug_task_images
  for select to authenticated
  using (private.is_member('debug') or (is_demo and private.in_showcase()));

create policy debug_task_images_insert on public.debug_task_images
  for insert to authenticated
  with check (private.is_member('debug') and created_by = (select auth.uid()));

-- No update policy: an image is immutable. Replacing one means delete + insert,
-- which keeps the stored object and its row in step.

create policy debug_task_images_delete on public.debug_task_images
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

-- ---- Storage: private bucket, member read AND member write.

insert into storage.buckets (id, name, public)
values ('debug', 'debug', false)
on conflict (id) do nothing;

-- Showcase viewers get read access too, or the demo board renders rows whose
-- images all 403. Objects aren't tagged is_demo, so this is bucket-wide read
-- for anyone in showcase mode — acceptable because showcase is an internal
-- presentation mode, not a public share.
create policy debug_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'debug'
    and (private.is_member('debug') or private.in_showcase())
  );

create policy debug_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'debug' and private.is_member('debug'));

create policy debug_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'debug' and private.is_member('debug'));

-- Deleting the OBJECT is member-wide even though deleting the ROW is
-- author-or-admin. The app only ever deletes objects alongside their row (or
-- when a whole task is deleted), and a stricter object policy would leave
-- orphaned bytes behind whenever an admin cleans up someone else's task.
create policy debug_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'debug' and private.is_member('debug'));
