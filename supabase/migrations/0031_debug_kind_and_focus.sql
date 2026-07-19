-- Debug board: task kind + a board-level focus banner.
--
-- Two additions, both scoped to the debug tab:
--
--   1. `debug_tasks.kind` — is this row a BUG to fix or a FEATURE to build?
--      The board already answers "how urgent" (priority) and "how far along"
--      (state); kind answers "what sort of work is it", which is the axis
--      people actually sort by when picking something up. Default 'fix':
--      the board started life as a bug list, so every existing row is a fix,
--      and an unlabelled new one is more likely a fix than a feature.
--
--   2. `debug_focus` — the debug board's own hero banner. Same shape and same
--      admin-only rules as `announcements` (0010), deliberately a SEPARATE
--      table rather than a `scope` column on announcements: the dashboard hero
--      is company-wide news, this one is "what the board should work on now".
--      Mixing them would mean every announcement query has to remember to
--      filter, and forgetting once leaks a debug focus onto the dashboard.

-- 1. Task kind ---------------------------------------------------------------

alter table public.debug_tasks
  add column kind text not null default 'fix'
    check (kind in ('fix', 'feature'));

-- The board's hot query is "this board's live tasks", then filters by kind
-- client-side; the index earns its keep on the kind-filtered counts.
create index debug_tasks_kind_idx on public.debug_tasks (kind);

-- 2. Focus banner ------------------------------------------------------------

create table public.debug_focus (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 500),
  -- Mirrors announcements.tone so the hero component can share its accent map.
  tone text not null default 'info' check (tone in ('info', 'primary', 'warning')),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index debug_focus_active_idx
  on public.debug_focus (active, created_at desc);

create trigger debug_focus_updated_at
before update on public.debug_focus
for each row execute function private.set_updated_at();

alter table public.debug_focus enable row level security;

-- Everyone signed in reads it (the debug section gate is enforced app-side by
-- requireSection, same as every other read on this board).
create policy debug_focus_select on public.debug_focus
  for select to authenticated using (true);

create policy debug_focus_insert on public.debug_focus
  for insert to authenticated
  with check (private.is_admin() and created_by = (select auth.uid()));

create policy debug_focus_update on public.debug_focus
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy debug_focus_delete on public.debug_focus
  for delete to authenticated
  using (private.is_admin());

-- Live updates, matching 0029: the board is realtime, so a posted focus should
-- land on everyone's screen without a reload.
alter publication supabase_realtime add table public.debug_focus;
alter table public.debug_focus replica identity full;
