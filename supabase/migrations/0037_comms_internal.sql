-- Comms splits into external and internal.
--
-- Until now "Comms" meant the CRM — contacts and the interactions logged
-- against them, all of it outward-facing. Kemal (2026-07-19): "divide the comms
-- section into two. internal and external. internal for keeping track of
-- previous meetings, things to write down in case they come up later."
--
-- Two tables, because they answer different questions:
--   comms_meetings — a RECORD. What happened, when, who was there, what we decided.
--   comms_notes    — a SCRATCHPAD. One line you'd otherwise forget by Thursday.
--
-- Both are SHARED with the whole comms section rather than private-by-default.
-- The stated purpose is "in case they come up later", and a note only the
-- author can see fails that the moment they're the one person not in the room.

create table public.comms_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  -- Date-only: a meeting happened on a DAY. Compare with todayInIstanbul(),
  -- never with a UTC timestamp — see lib/utils.ts.
  held_on date not null,
  -- Who was there. Plain uuid[] rather than a join table: this is read whole,
  -- never queried across, and 8 people don't need a junction.
  attendees uuid[] not null default '{}',
  -- The one-line "what came of it", shown on the list without expanding.
  summary text,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comms_meetings_held_idx on public.comms_meetings (held_on desc);

create trigger comms_meetings_updated_at
before update on public.comms_meetings
for each row execute function private.set_updated_at();

create table public.comms_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 2000),
  -- "This WILL come up later" — pinned notes sort first. Deliberately the only
  -- piece of structure here: a note with a title, a category and a status is a
  -- form, and nobody fills in a form to jot something down.
  pinned boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger comms_notes_updated_at
before update on public.comms_notes
for each row execute function private.set_updated_at();

alter table public.comms_meetings enable row level security;
alter table public.comms_notes enable row level security;

-- Select mirrors the post-0016 shape: members, plus showcase viewers on demo rows.
create policy comms_meetings_select on public.comms_meetings
  for select to authenticated
  using (private.is_member('comms') or (is_demo and private.in_showcase()));

create policy comms_meetings_insert on public.comms_meetings
  for insert to authenticated
  with check (private.is_member('comms') and created_by = (select auth.uid()));

-- Anyone in comms can correct a shared record — a meeting note with a wrong
-- date is worse than one someone else fixed.
create policy comms_meetings_update on public.comms_meetings
  for update to authenticated
  using (private.is_member('comms'))
  with check (private.is_member('comms'));

create policy comms_meetings_delete on public.comms_meetings
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

create policy comms_notes_select on public.comms_notes
  for select to authenticated
  using (private.is_member('comms') or (is_demo and private.in_showcase()));

create policy comms_notes_insert on public.comms_notes
  for insert to authenticated
  with check (private.is_member('comms') and created_by = (select auth.uid()));

create policy comms_notes_update on public.comms_notes
  for update to authenticated
  using (private.is_member('comms'))
  with check (private.is_member('comms'));

create policy comms_notes_delete on public.comms_notes
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());
