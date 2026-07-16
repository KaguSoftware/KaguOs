-- (a) Debug: a board per project — tasks can belong to a project (null = General).
-- (b) Project names become visible to debug members (board tabs need them).
-- (c) Digital marketing base: campaigns + content posts.

alter table public.debug_tasks
  add column project_id uuid references public.projects (id) on delete set null;
create index debug_tasks_project_idx on public.debug_tasks (project_id);

drop policy projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (private.is_member('work') or private.is_member('debug'));

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'other' check (channel in (
    'instagram', 'linkedin', 'x', 'tiktok', 'youtube',
    'google-ads', 'meta-ads', 'email', 'seo', 'website', 'other'
  )),
  status text not null default 'idea' check (status in ('idea', 'planned', 'running', 'done')),
  starts_on date,
  ends_on date,
  budget numeric(14, 2),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  url text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger marketing_campaigns_updated_at
before update on public.marketing_campaigns
for each row execute function private.set_updated_at();

create table public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'instagram' check (channel in (
    'instagram', 'linkedin', 'x', 'tiktok', 'youtube',
    'google-ads', 'meta-ads', 'email', 'seo', 'website', 'other'
  )),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  publish_on date,
  url text,
  campaign_id uuid references public.marketing_campaigns (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_posts_publish_idx on public.marketing_posts (publish_on);

create trigger marketing_posts_updated_at
before update on public.marketing_posts
for each row execute function private.set_updated_at();

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_posts enable row level security;

create policy marketing_campaigns_select on public.marketing_campaigns
  for select to authenticated using (private.is_member('marketing'));
create policy marketing_campaigns_insert on public.marketing_campaigns
  for insert to authenticated
  with check (private.is_member('marketing') and created_by = (select auth.uid()));
create policy marketing_campaigns_update on public.marketing_campaigns
  for update to authenticated
  using (private.is_member('marketing'))
  with check (private.is_member('marketing'));
create policy marketing_campaigns_delete on public.marketing_campaigns
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

create policy marketing_posts_select on public.marketing_posts
  for select to authenticated using (private.is_member('marketing'));
create policy marketing_posts_insert on public.marketing_posts
  for insert to authenticated
  with check (private.is_member('marketing') and created_by = (select auth.uid()));
create policy marketing_posts_update on public.marketing_posts
  for update to authenticated
  using (private.is_member('marketing'))
  with check (private.is_member('marketing'));
create policy marketing_posts_delete on public.marketing_posts
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());
