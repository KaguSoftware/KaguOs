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

-- The policy is dropped first: it reads both the function and the column that
-- this migration replaces, and Postgres refuses to drop either while it does.
drop policy if exists pinboard_notes_select on public.pinboard_notes;

alter table public.pinboard_notes add column audience text;

/*
 * Carry the existing notes across WITHOUT changing who can read them.
 *
 * The `learn` arm maps to 'everyone' rather than to 'learn_only', which looks
 * like a widening and is not: `learn` meant "everyone holding Learn", and every
 * member holds Learn. Mapping it to the trainees would have SHRUNK the audience
 * of a note already posted — silently hiding it from the Work team.
 *
 * The final else covers notes aimed only at a section that no longer has a
 * token (marketing, comms, management, chat). It narrows to 'admins' on
 * purpose: an over-narrow note is visible in the admin composer and can be
 * re-aimed in a click, while an over-wide one has already been read by people
 * it was never addressed to.
 */
update public.pinboard_notes set audience = case
  when 'everyone' = any (audiences) then 'everyone'
  when 'learn' = any (audiences) then 'everyone'
  when 'work' = any (audiences) and 'learn_only' = any (audiences) then 'everyone'
  when 'work' = any (audiences) then 'work'
  when 'learn_only' = any (audiences) then 'learn_only'
  else 'admins'
end;

alter table public.pinboard_notes
  alter column audience set not null,
  alter column audience set default 'everyone';

alter table public.pinboard_notes
  add constraint pinboard_notes_audience_valid
  check (audience in ('everyone', 'admins', 'learn_only', 'work'));

alter table public.pinboard_notes drop column audiences;

-- ---------------------------------------------------------------------------
-- The gate, now scalar
-- ---------------------------------------------------------------------------

drop function if exists private.sees_pinboard(text[]);

/*
 * Same contract as 0065's array version and the same warning applies: the
 * membership arms read `section_memberships` DIRECTLY rather than calling
 * private.is_member(), which is admin-widened and would therefore report every
 * admin as a trainee. Admins get their own arm in the policy below.
 */
create or replace function private.sees_pinboard(aud text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
  );
$$;

grant execute on function private.sees_pinboard(text) to authenticated;

create policy pinboard_notes_select on public.pinboard_notes
  for select to authenticated
  using (private.is_admin() or private.sees_pinboard(audience));
