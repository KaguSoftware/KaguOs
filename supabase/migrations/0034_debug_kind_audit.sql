-- A third task kind: 'audit' — go LOOK for what needs fixing.
--
-- "Sweep the Pet app checkout for bugs" is not a fix and not a feature. Its
-- output is not a working thing, it is a LIST of things that need doing. The
-- team does this work already; until now it had to be filed as a 'fix', which
-- made the board lie twice: it read as though something specific was broken,
-- and it never showed that the sweep is what produced the ten tasks under it.
--
-- Same axis as fix/feature ("what sort of work is this"), so it inherits the
-- badge, the filter, and the focus builder rather than needing a parallel
-- system of its own.

alter table public.debug_tasks
  drop constraint debug_tasks_kind_check;

alter table public.debug_tasks
  add constraint debug_tasks_kind_check
  check (kind in ('fix', 'feature', 'audit'));

-- What an audit turned up. Null for everything else; set on a task that was
-- created FROM an audit, so the audit can show its own yield ("found 7") and
-- the found task can point back at where it came from.
--
-- `set null` on delete, not cascade: deleting the audit must never delete the
-- real work it discovered — that is the whole value the audit produced.
alter table public.debug_tasks
  add column found_by uuid references public.debug_tasks (id) on delete set null;

create index debug_tasks_found_by_idx
  on public.debug_tasks (found_by)
  where found_by is not null;
