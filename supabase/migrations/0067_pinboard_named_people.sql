-- Pinboard, third pass: a fifth audience — a hand-picked list of people.
--
-- The four in 0066 are groups the company already has a name for. This one is
-- for the note that belongs to two or three people specifically ("Ali, Rana —
-- the client wants the deck Thursday") and has no group behind it. Without it
-- the only way to reach three people was to pin it to a group of nine and hope
-- the other six read past it.
--
-- The ids live in an ARRAY on the note rather than in a join table. The list is
-- a property of the note, always read with it, never queried the other way
-- ("which notes is Ali on?" is not a question the app asks), and bounded by the
-- size of the company. A join table would add a second read and a second RLS
-- policy to express the same fact.

alter table public.pinboard_notes
  add column audience_ids uuid[] not null default '{}';

alter table public.pinboard_notes
  drop constraint pinboard_notes_audience_valid;

alter table public.pinboard_notes
  add constraint pinboard_notes_audience_valid
  check (audience in ('everyone', 'admins', 'learn_only', 'work', 'people'));

/*
 * The ids and the audience have to agree, in BOTH directions.
 *
 * 'people' with an empty list is a note addressed to nobody. The reverse —
 * leftover ids on a note since re-aimed at a group — is the more dangerous
 * half: the list would sit there naming people who are no longer the audience,
 * and the composer would show it again the next time someone edited the note.
 *
 * cardinality(), not array_length(), for the reason 0065 records: array_length
 * on an empty array is NULL, and a CHECK passes when its expression is NULL.
 */
alter table public.pinboard_notes
  add constraint pinboard_notes_people_ids
  check (
    case when audience = 'people'
         then cardinality(audience_ids) >= 1
         else cardinality(audience_ids) = 0
    end
  );

-- ---------------------------------------------------------------------------
-- The gate, now aware of the named list
-- ---------------------------------------------------------------------------

-- Dropped first: it reads the function being replaced.
drop policy if exists pinboard_notes_select on public.pinboard_notes;

drop function if exists private.sees_pinboard(text);

/*
 * Same shape as 0066 with one arm added.
 *
 * `audience_ids` deliberately carries no foreign key — Postgres cannot put one
 * on an array element. A deleted profile therefore leaves its id behind, which
 * is inert: it matches no auth.uid(), so the note simply has one fewer reader.
 * The alternative (a join table with a cascade) would buy tidiness at the cost
 * of the second read described at the top of this file.
 *
 * The membership arms still read `section_memberships` DIRECTLY rather than
 * calling private.is_member(), which is admin-widened and would report every
 * admin as a trainee. Admins get their own arm in the policy below.
 */
create or replace function private.sees_pinboard(aud text, ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_client() and (
    aud = 'everyone'
    or (aud = 'admins' and private.is_admin())
    -- A named list still cannot reach an outsider: the is_client() guard above
    -- covers a client id pasted into `ids`, so the list can only ever name
    -- colleagues however it was built.
    or (aud = 'people' and (select auth.uid()) = any (ids))
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

grant execute on function private.sees_pinboard(text, uuid[]) to authenticated;

create policy pinboard_notes_select on public.pinboard_notes
  for select to authenticated
  using (private.is_admin() or private.sees_pinboard(audience, audience_ids));
