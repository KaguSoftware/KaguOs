-- Per-project account credentials (Supabase logins, hosting, service accounts…).
-- DECISION (Parsa): stored as plaintext, tightly RLS-gated to management members
-- and admins, masked in the UI with reveal-on-click. ⚠️ A DB compromise exposes
-- these — a dedicated secrets manager is the safer long-term home; revisit.

create table public.project_secrets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  username text,
  secret text,
  url text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_secrets_project_idx on public.project_secrets (project_id);

create trigger project_secrets_updated_at
before update on public.project_secrets
for each row execute function private.set_updated_at();

alter table public.project_secrets enable row level security;

-- Only management members (and admins) can see or touch credentials — NOT
-- everyone in Work. This is the sensitive table; keep the gate tight.
create policy project_secrets_select on public.project_secrets
  for select to authenticated
  using (private.is_member('management'));

create policy project_secrets_insert on public.project_secrets
  for insert to authenticated
  with check (private.is_member('management') and created_by = (select auth.uid()));

create policy project_secrets_update on public.project_secrets
  for update to authenticated
  using (private.is_member('management'))
  with check (private.is_member('management'));

create policy project_secrets_delete on public.project_secrets
  for delete to authenticated
  using (private.is_member('management') or private.is_admin());
