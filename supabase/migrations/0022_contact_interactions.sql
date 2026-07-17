-- Comms: a log of interactions per contact (calls, emails, meetings, notes).
--
-- Replaces the missing "when did we last talk to them, and what happened" on a
-- contact. Each row is one touch; the contact's "last interaction" is simply the
-- newest row. Mirrors the contact_links shape (child of contacts, comms-gated
-- RLS, showcase-aware select, is_demo for demo mode).

create table public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  -- When the interaction happened (date only — the team logs "we spoke on the
  -- 14th", not a timestamp). Defaults to today at insert if omitted.
  happened_on date not null default current_date,
  kind text not null default 'note' check (kind in (
    'call', 'email', 'meeting', 'message', 'note'
  )),
  -- What happened. Required — an interaction with no summary is noise.
  summary text not null check (char_length(summary) between 1 and 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false
);

-- Newest-first per contact is the read shape (the timeline + "last interaction").
create index contact_interactions_contact_idx
  on public.contact_interactions (contact_id, happened_on desc, created_at desc);
create index contact_interactions_demo_idx
  on public.contact_interactions (is_demo);

alter table public.contact_interactions enable row level security;

-- Read: comms members, or demo rows while showcasing (mirrors contact_links).
create policy contact_interactions_select on public.contact_interactions
  for select to authenticated
  using (private.is_member('comms') or (is_demo and private.in_showcase()));

create policy contact_interactions_insert on public.contact_interactions
  for insert to authenticated
  with check (private.is_member('comms') and created_by = (select auth.uid()));

create policy contact_interactions_update on public.contact_interactions
  for update to authenticated
  using (private.is_member('comms')) with check (private.is_member('comms'));

create policy contact_interactions_delete on public.contact_interactions
  for delete to authenticated
  using (private.is_member('comms') or private.is_admin());
