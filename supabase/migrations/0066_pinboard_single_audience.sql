-- Pinboard, second pass: ONE audience per note, from a four-item vocabulary.
--
-- 0065 let a note carry several audiences from a ten-token list (every section,
-- plus everyone/admins/learn_only). In this company that vocabulary was mostly
-- unreachable: all 14 members hold Learn, 5 of them hold Work, and the other
-- sections are subsets of those. So the list offered eight ways to say the same
-- three things, and "Kagu Learn" in particular was a synonym for "everyone"
-- that read like a narrow audience.
--
-- The four that remain partition the company honestly:
--   everyone    — all members
--   work        — the Work team (5)
--   learn_only  — Learn without Work: the trainees (9)  → work + learn_only = everyone
--   admins      — admins only (2)
--
-- With those, combining is pointless — the union of any two is already one of
-- the four — so the array collapses to a single column and the picker to a
-- single-choice dropdown.
--
-- ---------------------------------------------------------------------------
-- REPLAY-SAFE, with a subtlety that does not arise in 0067.
--
-- This migration is SUPERSEDED by 0067, which widens the audience vocabulary to
-- include 'people' and replaces the gate with a two-argument version. So the
-- guards below are not merely "skip what is already done" — parts of this file
-- must not run AT ALL once 0067 is in, because re-running them would drop
-- 'people' out of the constraint and downgrade the policy to one that ignores
-- audience_ids. That is a silent narrowing of who can read a note, which is
-- strictly worse than the `42701 already exists` error the guards remove.
-- Each guard below says which of the two jobs it is doing.
-- ---------------------------------------------------------------------------

alter table public.pinboard_notes
  add column if not exists audience text;

-- GUARD 1 (already-done): the backfill reads `audiences`, which the bottom of
-- this file drops. Wrapped in EXECUTE so that on a replay — where the column is
-- long gone — the statement is never parsed, let alone run.
--
-- The `learn` arm maps to 'everyone' rather than to 'learn_only'. That looks
-- like a widening and is not: `learn` meant "everyone holding Learn", and every
-- member holds Learn. Mapping it to the trainees would have SHRUNK the audience
-- of a note already posted — silently hiding it from the Work team.
--
-- The final else covers notes aimed only at a section that no longer has a
-- token (marketing, comms, management, chat). It narrows to 'admins' on
-- purpose: an over-narrow note is visible in the admin composer and can be
-- re-aimed in a click, while an over-wide one has already been read by people
-- it was never addressed to.
do $do$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pinboard_notes'
      and column_name = 'audiences'
  ) then
    execute $sql$
      update public.pinboard_notes set audience = case
        when 'everyone' = any (audiences) then 'everyone'
        when 'learn' = any (audiences) then 'everyone'
        when 'work' = any (audiences) and 'learn_only' = any (audiences) then 'everyone'
        when 'work' = any (audiences) then 'work'
        when 'learn_only' = any (audiences) then 'learn_only'
        else 'admins'
      end
    $sql$;
  end if;
end
$do$;

-- Both are no-ops when already in force.
alter table public.pinboard_notes
  alter column audience set not null,
  alter column audience set default 'everyone';

-- GUARD 2 (superseded): ADD-IF-ABSENT rather than drop-then-add. 0067 replaces
-- this constraint UNDER THE SAME NAME with a wider one that also allows
-- 'people'. Dropping and re-adding here — the pattern 0067 itself uses — would
-- quietly narrow it again on every replay, and the next note pinned to
-- "Specific people" would be rejected by a constraint nobody edited.
do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pinboard_notes_audience_valid'
  ) then
    alter table public.pinboard_notes
      add constraint pinboard_notes_audience_valid
      check (audience in ('everyone', 'admins', 'learn_only', 'work'));
  end if;
end
$do$;

alter table public.pinboard_notes drop column if exists audiences;

-- ---------------------------------------------------------------------------
-- The gate, now scalar
-- ---------------------------------------------------------------------------

-- GUARD 3 (superseded): the whole gate is skipped once 0067 has installed the
-- (text, uuid[]) version. Without this, a replay would drop 0067's policy and
-- put back one that never consults audience_ids — every "Specific people" note
-- would become readable by nobody but admins, with no error to show for it.
--
-- The membership arms read `section_memberships` DIRECTLY rather than calling
-- private.is_member(), which is admin-widened and would therefore report every
-- admin as a trainee. Admins get their own arm in the policy.
do $do$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pinboard_notes'
      and column_name = 'audience_ids'
  ) then
    raise notice '0066: 0067 already installed the (text, uuid[]) gate — leaving it in place';
    return;
  end if;

  drop policy if exists pinboard_notes_select on public.pinboard_notes;
  drop function if exists private.sees_pinboard(text[]);

  execute $sql$
    create or replace function private.sees_pinboard(aud text)
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
    as $fn$
      select not private.is_client() and (
        aud = 'everyone'
        or (aud = 'admins' and private.is_admin())
        or (
          aud = 'work'
          and exists (
            select 1 from public.section_memberships m
            where m.user_id = (select auth.uid()) and m.section = 'work'
          )
        )
        or (
          aud = 'learn_only'
          and exists (
            select 1 from public.section_memberships m
            where m.user_id = (select auth.uid()) and m.section = 'learn'
          )
          and not exists (
            select 1 from public.section_memberships w
            where w.user_id = (select auth.uid()) and w.section = 'work'
          )
        )
      )
    $fn$
  $sql$;

  execute 'grant execute on function private.sees_pinboard(text) to authenticated';

  execute $sql$
    create policy pinboard_notes_select on public.pinboard_notes
      for select to authenticated
      using (private.is_admin() or private.sees_pinboard(audience))
  $sql$;
end
$do$;
