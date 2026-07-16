-- Communications / CRM: a sixth membership-gated section. Tracks leads and
-- clients, each with a status pipeline and a bag of linked resources (docs,
-- deals, drives — anything tied to that relationship).

-- (a) Add 'comms' as a valid section on the memberships CHECK.
alter table public.section_memberships
  drop constraint section_memberships_section_check;
alter table public.section_memberships
  add constraint section_memberships_section_check
  check (section in ('work', 'learn', 'management', 'debug', 'marketing', 'comms'));

-- (b) Contacts — a lead or a client.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  company text,
  kind text not null default 'lead' check (kind in ('lead', 'client')),
  status text not null default 'new' check (status in (
    'new', 'contacted', 'negotiating', 'won', 'lost', 'active', 'dormant'
  )),
  email text,
  phone text,
  owner_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_kind_idx on public.contacts (kind);
create index contacts_status_idx on public.contacts (status);

create trigger contacts_updated_at
before update on public.contacts
for each row execute function private.set_updated_at();

-- (c) Linked resources tied to a contact.
create table public.contact_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  url text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index contact_links_contact_idx on public.contact_links (contact_id);

-- (d) RLS — comms members (and admins, via is_member semantics used elsewhere).
alter table public.contacts enable row level security;
alter table public.contact_links enable row level security;

create policy contacts_select on public.contacts
  for select to authenticated using (private.is_member('comms'));
create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (private.is_member('comms') and created_by = (select auth.uid()));
create policy contacts_update on public.contacts
  for update to authenticated
  using (private.is_member('comms')) with check (private.is_member('comms'));
create policy contacts_delete on public.contacts
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

create policy contact_links_select on public.contact_links
  for select to authenticated using (private.is_member('comms'));
create policy contact_links_insert on public.contact_links
  for insert to authenticated
  with check (private.is_member('comms') and created_by = (select auth.uid()));
create policy contact_links_update on public.contact_links
  for update to authenticated
  using (private.is_member('comms')) with check (private.is_member('comms'));
create policy contact_links_delete on public.contact_links
  for delete to authenticated
  using (private.is_member('comms') or private.is_admin());
