-- KaguOs initial schema: profiles, memberships, five sections, RLS, storage, realtime.
-- Access model: profiles.is_admin (global) + section_memberships rows, enforced by RLS
-- through private.is_admin() / private.is_member(section).

-- ========================================================================
-- Helpers schema
-- ========================================================================
create schema if not exists private;
grant usage on schema private to authenticated;

-- ========================================================================
-- Core: profiles + memberships
-- ========================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.section_memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  section text not null check (section in ('work', 'learn', 'management', 'debug', 'marketing')),
  created_at timestamptz not null default now(),
  primary key (user_id, section)
);

-- SECURITY DEFINER helpers (avoid RLS recursion when policies consult these tables)
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function private.is_member(s text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1
    from public.section_memberships m
    where m.user_id = (select auth.uid()) and m.section = s
  );
$$;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_member(text) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-create a profile for every new auth user
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ========================================================================
-- Kagu Work: projects + ideas
-- ========================================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'done')),
  repo_url text,
  prod_url text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_updated_at
before update on public.projects
for each row execute function private.set_updated_at();

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  status text not null default 'open' check (status in ('open', 'promoted', 'archived')),
  promoted_project_id uuid references public.projects (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index idea_comments_idea_idx on public.idea_comments (idea_id);

create table public.idea_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- ========================================================================
-- Kagu Learn: sprints
-- ========================================================================
create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_on date not null,
  ends_on date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.sprint_resources (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);
create index sprint_resources_sprint_idx on public.sprint_resources (sprint_id);

create table public.sprint_participants (
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sprint_id, user_id)
);

create table public.sprint_goals (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index sprint_goals_sprint_idx on public.sprint_goals (sprint_id);

create table public.sprint_goal_progress (
  goal_id uuid not null references public.sprint_goals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);

-- ========================================================================
-- Kagu Management: transactions + contracts
-- ========================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  occurred_on date not null,
  client text,
  project_id uuid references public.projects (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index transactions_occurred_idx on public.transactions (occurred_on desc);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client text not null,
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'terminated')),
  notes text,
  file_path text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contracts_updated_at
before update on public.contracts
for each row execute function private.set_updated_at();

-- ========================================================================
-- Kagu Debug: task board (replaces the Google Sheet)
-- ========================================================================
create table public.debug_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  state text not null default 'open' check (state in ('open', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index debug_tasks_state_idx on public.debug_tasks (state);
create index debug_tasks_assignee_idx on public.debug_tasks (assignee_id);

create trigger debug_tasks_updated_at
before update on public.debug_tasks
for each row execute function private.set_updated_at();

-- ========================================================================
-- Kagu Marketing: shared links/notes (shell for now)
-- ========================================================================
create table public.marketing_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ========================================================================
-- Row Level Security
-- ========================================================================
alter table public.profiles enable row level security;
alter table public.section_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_comments enable row level security;
alter table public.idea_votes enable row level security;
alter table public.sprints enable row level security;
alter table public.sprint_resources enable row level security;
alter table public.sprint_participants enable row level security;
alter table public.sprint_goals enable row level security;
alter table public.sprint_goal_progress enable row level security;
alter table public.transactions enable row level security;
alter table public.contracts enable row level security;
alter table public.debug_tasks enable row level security;
alter table public.marketing_items enable row level security;

-- ---- profiles: everyone signed-in can read names; you may edit only your own
-- full_name (column-level grant); privilege changes happen via service role.
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, update, delete on table public.profiles from authenticated, anon;
grant update (full_name) on table public.profiles to authenticated;

-- ---- section_memberships: visible to all signed-in; only admins change them
create policy memberships_select on public.section_memberships
  for select to authenticated using (true);

create policy memberships_admin_insert on public.section_memberships
  for insert to authenticated with check (private.is_admin());

create policy memberships_admin_delete on public.section_memberships
  for delete to authenticated using (private.is_admin());

-- ---- Work
create policy projects_select on public.projects
  for select to authenticated using (private.is_member('work'));

create policy projects_insert on public.projects
  for insert to authenticated
  with check (private.is_member('work') and created_by = (select auth.uid()));

create policy projects_update on public.projects
  for update to authenticated
  using (private.is_member('work'))
  with check (private.is_member('work'));

create policy projects_delete on public.projects
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

create policy ideas_select on public.ideas
  for select to authenticated using (private.is_member('work'));

create policy ideas_insert on public.ideas
  for insert to authenticated
  with check (private.is_member('work') and created_by = (select auth.uid()));

create policy ideas_update on public.ideas
  for update to authenticated
  using (private.is_member('work'))
  with check (private.is_member('work'));

create policy ideas_delete on public.ideas
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

create policy idea_comments_select on public.idea_comments
  for select to authenticated using (private.is_member('work'));

create policy idea_comments_insert on public.idea_comments
  for insert to authenticated
  with check (private.is_member('work') and created_by = (select auth.uid()));

create policy idea_comments_delete on public.idea_comments
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

create policy idea_votes_select on public.idea_votes
  for select to authenticated using (private.is_member('work'));

create policy idea_votes_insert on public.idea_votes
  for insert to authenticated
  with check (private.is_member('work') and user_id = (select auth.uid()));

create policy idea_votes_delete on public.idea_votes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---- Learn (sprint structure managed by admins; members tick their own goals)
create policy sprints_select on public.sprints
  for select to authenticated using (private.is_member('learn'));

create policy sprints_admin_write on public.sprints
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy sprint_resources_select on public.sprint_resources
  for select to authenticated using (private.is_member('learn'));

create policy sprint_resources_admin_write on public.sprint_resources
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy sprint_participants_select on public.sprint_participants
  for select to authenticated using (private.is_member('learn'));

create policy sprint_participants_admin_write on public.sprint_participants
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy sprint_goals_select on public.sprint_goals
  for select to authenticated using (private.is_member('learn'));

create policy sprint_goals_admin_write on public.sprint_goals
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy sprint_goal_progress_select on public.sprint_goal_progress
  for select to authenticated using (private.is_member('learn'));

create policy sprint_goal_progress_insert on public.sprint_goal_progress
  for insert to authenticated
  with check (
    private.is_member('learn')
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.sprint_goals g
      join public.sprint_participants sp on sp.sprint_id = g.sprint_id
      where g.id = goal_id and sp.user_id = (select auth.uid())
    )
  );

create policy sprint_goal_progress_delete on public.sprint_goal_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---- Management (2 people + admins)
create policy transactions_all on public.transactions
  for all to authenticated
  using (private.is_member('management'))
  with check (private.is_member('management'));

create policy contracts_all on public.contracts
  for all to authenticated
  using (private.is_member('management'))
  with check (private.is_member('management'));

-- ---- Debug: anyone (member) can create and change state; you can only claim
-- a task for YOURSELF (or unclaim). Admins may assign anyone.
create policy debug_tasks_select on public.debug_tasks
  for select to authenticated using (private.is_member('debug'));

create policy debug_tasks_insert on public.debug_tasks
  for insert to authenticated
  with check (
    private.is_member('debug')
    and created_by = (select auth.uid())
    and (assignee_id is null or assignee_id = (select auth.uid()) or private.is_admin())
  );

create policy debug_tasks_update on public.debug_tasks
  for update to authenticated
  using (private.is_member('debug'))
  with check (
    private.is_member('debug')
    and (assignee_id is null or assignee_id = (select auth.uid()) or private.is_admin())
  );

create policy debug_tasks_delete on public.debug_tasks
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

-- ---- Marketing
create policy marketing_items_select on public.marketing_items
  for select to authenticated using (private.is_member('marketing'));

create policy marketing_items_insert on public.marketing_items
  for insert to authenticated
  with check (private.is_member('marketing') and created_by = (select auth.uid()));

create policy marketing_items_update on public.marketing_items
  for update to authenticated
  using (private.is_member('marketing'))
  with check (private.is_member('marketing'));

create policy marketing_items_delete on public.marketing_items
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

-- ========================================================================
-- Storage: private bucket for contract PDFs (management only)
-- ========================================================================
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy contracts_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'contracts' and private.is_member('management'));

create policy contracts_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contracts' and private.is_member('management'));

create policy contracts_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'contracts' and private.is_member('management'));

create policy contracts_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'contracts' and private.is_member('management'));

-- ========================================================================
-- Realtime: live updates for the debug board
-- ========================================================================
alter publication supabase_realtime add table public.debug_tasks;
