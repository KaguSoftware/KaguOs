-- Reminders: a shared scratchpad. Two scopes in one table:
--   personal — visible and editable only to its owner
--   team     — visible to everyone; anyone can tick or remove it
-- Replaces the earlier localStorage-only reminders widget.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal' check (scope in ('personal', 'team')),
  -- owner_id is the person a personal reminder belongs to; null for team ones.
  owner_id uuid references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  done boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- personal reminders must have an owner; team reminders must not.
  constraint reminders_scope_owner check (
    (scope = 'personal' and owner_id is not null) or
    (scope = 'team' and owner_id is null)
  )
);

create index reminders_owner_idx on public.reminders (owner_id);
create index reminders_scope_idx on public.reminders (scope);

alter table public.reminders enable row level security;

-- See a reminder if it's yours (personal) or it's a team reminder.
create policy reminders_select on public.reminders
  for select to authenticated
  using (
    scope = 'team' or owner_id = (select auth.uid())
  );

-- Create a personal reminder for yourself, or any team reminder.
create policy reminders_insert on public.reminders
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (scope = 'personal' and owner_id = (select auth.uid())) or
      (scope = 'team' and owner_id is null)
    )
  );

-- Tick/untick: your own personal ones, or any team one (everyone can).
create policy reminders_update on public.reminders
  for update to authenticated
  using (scope = 'team' or owner_id = (select auth.uid()))
  with check (scope = 'team' or owner_id = (select auth.uid()));

-- Remove: your own personal ones, any team one, or admins.
create policy reminders_delete on public.reminders
  for delete to authenticated
  using (
    scope = 'team' or owner_id = (select auth.uid()) or private.is_admin()
  );
