-- In-app notifications: one row per recipient (fan-out on write). Written by
-- server actions when something happens others should know about; each person
-- sees and clears only their own.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in (
    'debug_task_new', 'idea_new', 'idea_promoted', 'idea_comment',
    'reminder_shared'
  )),
  title text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

-- You only ever see your own notifications.
create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

-- Inserts come from server actions (which fan out to recipients). Allow an
-- authenticated user to create notifications for anyone — the app decides the
-- recipients; there's nothing sensitive in a notification row itself.
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (true);

-- Mark-as-read / clear: only your own.
create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (recipient_id = (select auth.uid()));
