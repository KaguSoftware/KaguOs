-- Pinboard: short, colored notes pinned to the dashboard — "things to keep in
-- mind", not tasks and not announcements. Only admins pin them; each note
-- carries the audience it is addressed to, and the database decides who reads
-- it.
--
-- Why a NEW TABLE rather than widening `announcements`: an announcement is ONE
-- active banner addressed to the whole company, and its entire model is built
-- around that — an `active` flag, and posting retires whatever was up. A
-- pinboard is many standing notes, each addressed to a different slice of the
-- company. Folded together, `active` would mean nothing here and `audiences`
-- would mean nothing there.
--
-- ---------------------------------------------------------------------------
-- REPLAY-SAFE, and superseded twice over — see the note in 0066.
--
-- 0066 collapses this file's `audiences text[]` to a scalar `audience` and 0067
-- adds the named-people list. So the gate and policy at the bottom must not run
-- once either of those is in: they name a column that no longer exists, and
-- re-creating the policy would replace a newer one with an older, narrower gate.
-- The guard is the presence of the `audiences` column itself.
-- ---------------------------------------------------------------------------

create table if not exists public.pinboard_notes (
  id uuid primary key default gen_random_uuid(),
  -- Short BY CONSTRAINT, not by convention: a note that grows into a paragraph
  -- stops being glanceable, which is the only thing a pinboard is for.
  body text not null check (char_length(body) between 1 and 280),
  -- A key from NOTE_COLORS (src/lib/pinboard.ts), not a raw color value: the
  -- palette is tuned against the dark surfaces, and storing the key means a
  -- later correction to it reaches notes that are already pinned.
  color text not null default 'amber',
  /*
   * WHO THIS NOTE IS FOR. Several audiences at once — one note can be for Work
   * and Marketing together — so this is an array, and a note is visible when
   * ANY element matches the reader. (0066 replaces this with a single column;
   * the reasoning for that is recorded there.)
   *
   * Tokens are section names plus three that are not sections:
   *   everyone    — every member
   *   admins      — admins only
   *   learn_only  — Learn WITHOUT Work: the trainees
   *
   * That last one exists because of the company rule in 0026: granting Work
   * auto-grants Learn (and Debug). So `learn` as an audience necessarily
   * reaches every Work member too — nearly the whole company — and without
   * `learn_only` there would be no way to address the people whose only panel
   * is Learn, which is precisely the group a pinboard note is most often for.
   *
   * `status` is deliberately NOT an audience. It is a feature gate (presence
   * dots, the status editor), not a group of people you would address.
   */
  audiences text[] not null default array['everyone'],
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An empty array would be a note addressed to nobody — invisible, undeletable
  -- from the UI that renders it, and indistinguishable from a bug.
  --
  -- ⚠️ cardinality(), NOT array_length(). array_length('{}', 1) is NULL rather
  -- than 0, a CHECK passes when its expression is NULL, and '{}' <@ anything is
  -- true — so the array_length spelling of this constraint would have let the
  -- one value it exists to forbid straight through. cardinality('{}') is 0.
  constraint pinboard_notes_audiences_valid check (
    cardinality(audiences) >= 1
    and audiences <@ array[
      'everyone', 'admins', 'learn_only',
      'work', 'learn', 'management', 'debug', 'marketing', 'comms', 'chat'
    ]::text[]
  )
);

create index if not exists pinboard_notes_created_idx
  on public.pinboard_notes (created_at desc);

drop trigger if exists pinboard_notes_updated_at on public.pinboard_notes;
create trigger pinboard_notes_updated_at
before update on public.pinboard_notes
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Who sees a note
-- ---------------------------------------------------------------------------

/*
 * Skipped entirely once 0066 has replaced `audiences` with `audience` — see the
 * header. On a fresh database the column is present and this runs normally.
 *
 * ⚠️ The section arms read `section_memberships` DIRECTLY rather than calling
 * private.is_member(). That function is admin-widened — it answers true for an
 * admin in every section — so routing this through it would make an admin
 * satisfy `learn_only`, i.e. report that the trainee audience includes every
 * admin. Admins are handled by their own arm in the select policy, which keeps
 * this function an honest answer to "is this person in this audience".
 */
do $do$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pinboard_notes'
      and column_name = 'audiences'
  ) then
    raise notice '0065: superseded by 0066/0067 — leaving the current gate in place';
    return;
  end if;

  execute $sql$
    create or replace function private.sees_pinboard(aud text[])
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
    as $fn$
      select not private.is_client() and (
        'everyone' = any (aud)
        or ('admins' = any (aud) and private.is_admin())
        or (
          'learn_only' = any (aud)
          and exists (
            select 1 from public.section_memberships m
            where m.user_id = (select auth.uid()) and m.section = 'learn'
          )
          and not exists (
            select 1 from public.section_memberships w
            where w.user_id = (select auth.uid()) and w.section = 'work'
          )
        )
        -- Plain section audiences. The three non-section tokens above can never
        -- equal a `section` value, so matching the whole array here is safe.
        or exists (
          select 1 from public.section_memberships m
          where m.user_id = (select auth.uid()) and m.section = any (aud)
        )
      )
    $fn$
  $sql$;

  execute 'grant execute on function private.sees_pinboard(text[]) to authenticated';

  -- Admins read every note whatever its audience — they are the only people who
  -- can edit or unpin one, so a note they cannot see is a note nobody can undo.
  drop policy if exists pinboard_notes_select on public.pinboard_notes;
  execute $sql$
    create policy pinboard_notes_select on public.pinboard_notes
      for select to authenticated
      using (private.is_admin() or private.sees_pinboard(audiences))
  $sql$;
end
$do$;

alter table public.pinboard_notes enable row level security;

-- Only admins pin, edit, or unpin. `created_by = auth.uid()` on insert so the
-- author on the row is the person who actually pinned it. These three are
-- unchanged by 0066/0067, so they are simply re-asserted on a replay.
drop policy if exists pinboard_notes_insert on public.pinboard_notes;
create policy pinboard_notes_insert on public.pinboard_notes
  for insert to authenticated
  with check (private.is_admin() and created_by = (select auth.uid()));

drop policy if exists pinboard_notes_update on public.pinboard_notes;
create policy pinboard_notes_update on public.pinboard_notes
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

drop policy if exists pinboard_notes_delete on public.pinboard_notes;
create policy pinboard_notes_delete on public.pinboard_notes
  for delete to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Live updates (same contract as 0029: the event carries only "something
-- changed"; the client re-pulls an already-RLS-filtered server render)
-- ---------------------------------------------------------------------------

alter table public.pinboard_notes replica identity full;

do $do$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pinboard_notes'
  ) then
    alter publication supabase_realtime add table public.pinboard_notes;
  end if;
end
$do$;
