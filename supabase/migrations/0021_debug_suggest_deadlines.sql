-- Debug suggestions + deadlines, project deadlines.
--
-- Three additive, nullable columns. No RLS changes needed:
--   * debug_tasks.suggested_for — an admin's soft "this is a good fit for X".
--     Unlike assignee_id it does NOT claim the task; the task stays one-click
--     claimable by anyone (self-claim culture holds). It's a hint, not a lock,
--     so it has none of assignee_id's "only yourself unless admin" constraint —
--     but in practice it's only ever set from an admin-gated form field.
--   * debug_tasks.due_on — optional deadline for a task.
--   * projects.due_on — optional deadline, surfaced on active/in-progress projects.
--
-- on delete set null: a suggestion pointing at a departed teammate just clears,
-- matching how created_by/assignee already behave.

alter table public.debug_tasks
  add column suggested_for uuid references public.profiles (id) on delete set null,
  add column due_on date;

alter table public.projects
  add column due_on date;
