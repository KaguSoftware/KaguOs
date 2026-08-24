-- 0073: which set of questions a project asks its client.
--
-- 0072 shipped one input pack for every project — the neutral one, asking every
-- business the same generalised questions ("anything booked by time", "products
-- and services"). That is the right default and the wrong thing to put in front
-- of a named client. Touch Padel do not have bookable resources, they have
-- COURTS; they do not have products and services, they have a menu and a
-- kitchen with recipes in it. Asked in the general form, they answer in the
-- general form, and vague answers are the thing this whole feature exists to
-- stop.
--
-- So a project now names its pack, and the packs themselves live in TypeScript
-- (src/lib/intake.ts) for the reason 0072 §3 gave and which has not changed:
-- the questions are edited far more often than any schema, and a migration per
-- reworded hint would be absurd.
--
-- ── Why free text and not an enum ──────────────────────────────────────────
--
-- A check constraint listing the pack names would have to be migrated every
-- time someone adds a pack — which is the exact coupling this design spent 0072
-- §3 avoiding. The column is therefore advisory: `packFor()` in the app falls
-- back to the general pack for a null or an unrecognised value, so a project
-- pointing at a pack that was later renamed shows the neutral questions rather
-- than an error page.
--
-- NULL means "the general pack". It is not backfilled to the literal 'general'
-- on purpose: null says "nobody has chosen", 'general' says "somebody chose the
-- neutral one", and on a screen that asks an admin to pick, those are worth
-- being able to tell apart.

alter table public.projects
  add column intake_pack text
  check (intake_pack is null or length(intake_pack) between 1 and 60);

comment on column public.projects.intake_pack is
  'Key into INTAKE_PACKS in src/lib/intake.ts. Null = the general pack.';

-- ---- The one project that already needs a non-general pack -----------------
-- The Touch Padel row was created before this column existed, so it is sitting
-- on the general pack — which would ask a padel club about "anything booked by
-- time" instead of about its courts. Set here rather than left to a click,
-- because the row and the column arrive in the wrong order and a project whose
-- pack silently defaults is exactly the kind of thing nobody notices until the
-- client is halfway through answering the wrong questions.
--
-- Idempotent and narrow: matched by name, and only while nobody has chosen.
update public.projects
set intake_pack = 'touch-padel'
where name = 'Touch Padel' and intake_pack is null;

-- ---------------------------------------------------------------------------
-- my_client_projects(): one more column
-- ---------------------------------------------------------------------------
-- The portal cannot read `projects` — that is 0072 §2's whole point — so the
-- pack key has to come out of this function or the client's own form has no way
-- of knowing which questions it is meant to render.
--
-- DROP then CREATE, not CREATE OR REPLACE: Postgres refuses to change the
-- return type of an existing function, and adding a column to a RETURNS TABLE
-- is a return-type change. The drop is safe because nothing depends on it
-- except application code deployed alongside this.
--
-- Still exactly three columns, and still no more. The reason `projects` was
-- never opened to clients is that a policy arm grants every column at once —
-- repo_url, internal notes, the lot. Widening this function one deliberate
-- column at a time is the point of it existing.
drop function if exists public.my_client_projects();

create function public.my_client_projects()
returns table (id uuid, name text, intake_pack text)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.name, pr.intake_pack
  from public.client_projects cp
  join public.projects pr on pr.id = cp.project_id
  join public.profiles p on p.id = cp.user_id
  where cp.user_id = (select auth.uid())
    and p.kind = 'client'
    and pr.is_demo = false
  order by pr.name;
$$;

revoke all on function public.my_client_projects() from public, anon;
grant execute on function public.my_client_projects() to authenticated;

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
do $$
begin
  -- The column rides on `projects`, whose SELECT policy 0072 §7(e) deliberately
  -- did NOT widen to clients — the portal reads its project through
  -- my_client_projects(). Re-checked here because adding a column to a table is
  -- exactly the moment someone reaches for the policy.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and cmd = 'SELECT'
      and coalesce(qual, '') like '%client_project_ids()%'
  ) then
    raise exception
      'projects SELECT was widened to clients — use my_client_projects() instead (0072 §2)';
  end if;

  -- A client must never choose which questions they are asked; that is an
  -- admin's decision about the engagement. `projects` has no client-writable
  -- policy and must not acquire one.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and coalesce(with_check, '') || coalesce(qual, '') like '%client_project_ids()%'
  ) then
    raise exception 'projects became client-writable — a client cannot pick their own pack';
  end if;

  -- The recreated function still plans and runs. 0068 shipped a SQL body that
  -- referenced a dropped relation and only failed at CALL time; 0071 was the
  -- clean-up. Cheap not to repeat it.
  perform count(*) from public.my_client_projects();
end $$;
