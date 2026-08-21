-- 0070: the marketing link shelf.
--
-- The Drive folder, the brand kit, the content ideas doc — the handful of URLs
-- the team keeps re-asking each other for. `client_id` is nullable and carries
-- the scope: null = the team's own shelf on the General tab, set = that
-- client's shelf inside their workspace (their Drive folder, their brand kit).

create table public.marketing_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  title text not null,
  url text not null,
  note text,
  sort integer not null default 0,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index marketing_links_list_idx
  on public.marketing_links (is_demo, client_id, sort, created_at);

alter table public.marketing_links enable row level security;

create policy marketing_links_select on public.marketing_links
  for select to authenticated
  using (private.is_member('marketing') or (is_demo and private.in_showcase()));

create policy marketing_links_insert on public.marketing_links
  for insert to authenticated
  with check (private.can_write('marketing') and created_by = (select auth.uid()));

create policy marketing_links_update on public.marketing_links
  for update to authenticated
  using (private.can_write('marketing'))
  with check (private.can_write('marketing'));

create policy marketing_links_delete on public.marketing_links
  for delete to authenticated
  using (private.can_write('marketing'));

do $$
begin
  execute 'alter table public.marketing_links replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'marketing_links'
  ) then
    execute 'alter publication supabase_realtime add table public.marketing_links';
  end if;
end $$;
