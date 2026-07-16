-- Announcements: an admin-posted banner at the top of the dashboard. Everyone
-- reads the latest active one; only admins create, edit, or retire them.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 500),
  -- tone drives the hero's accent (info by default, or a heads-up).
  tone text not null default 'info' check (tone in ('info', 'primary', 'warning')),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_active_idx
  on public.announcements (active, created_at desc);

create trigger announcements_updated_at
before update on public.announcements
for each row execute function private.set_updated_at();

alter table public.announcements enable row level security;

-- Everyone signed in sees announcements.
create policy announcements_select on public.announcements
  for select to authenticated using (true);

-- Only admins write / edit / retire.
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (private.is_admin() and created_by = (select auth.uid()));

create policy announcements_update on public.announcements
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy announcements_delete on public.announcements
  for delete to authenticated
  using (private.is_admin());
