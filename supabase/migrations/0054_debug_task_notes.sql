-- Notes on a debug task: a running thread with an author on every line.
--
-- A task has exactly one `description`, and editing it overwrites whatever was
-- there. So when a second person added what they'd found, the first person's
-- account of the problem quietly disappeared, and nothing on the task said who
-- had written any of it. In practice people worked around it by prefixing lines
-- with their own name inside the textarea.
--
-- `description` stays exactly as it is: the reporter's statement of the problem,
-- written once. Notes are everything said about it afterwards — appended, never
-- overwritten, each stamped with who and when. Same shape as
-- sprint_question_replies (0019) and comms_notes (0037).

create table public.debug_task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.debug_tasks (id) on delete cascade,
  body text not null constraint debug_task_notes_body_len check (
    char_length(body) between 1 and 2000
  ),
  -- Showcase rows. Every debug query scopes by this; so must the notes query,
  -- or a demo task shows the team's real discussion.
  is_demo boolean not null default false,
  -- `set null`, not cascade: a note is a record of what was said. Deleting a
  -- person shouldn't erase the thread — the UI renders a null author as
  -- "Someone", the same as 0019 does for sprint replies.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- is_demo leads: every read carries demoFlag(ctx), so it's the first thing the
-- planner should cut on. Matches sprint_question_replies_demo_q_idx.
create index debug_task_notes_demo_task_idx
  on public.debug_task_notes (is_demo, task_id, created_at);

create trigger debug_task_notes_updated_at
before update on public.debug_task_notes
for each row execute function private.set_updated_at();

alter table public.debug_task_notes enable row level security;

-- Visibility follows the task, for free: the EXISTS runs under debug_tasks'
-- own select policy (is_member('debug'), or a demo row in showcase), so a note
-- can never outlive the readability of the task it belongs to.
create policy debug_task_notes_select on public.debug_task_notes
  for select to authenticated
  using (
    exists (select 1 from public.debug_tasks t where t.id = task_id)
    or (is_demo and private.in_showcase())
  );

-- The explicit can_write('debug') is the deliberate divergence from 0019, whose
-- reply-insert leans on the EXISTS alone. That was already thin — 0016 widened
-- the parent select with "or (is_demo and in_showcase())", so a showcase
-- session satisfied it on demo rows — and with a read tier (0053) it would also
-- let a view-only debug member post.
create policy debug_task_notes_insert on public.debug_task_notes
  for insert to authenticated
  with check (
    private.can_write('debug')
    and created_by = (select auth.uid())
    and exists (select 1 from public.debug_tasks t where t.id = task_id)
  );

-- You may edit only your own note. Admins deliberately can't rewrite someone
-- else's words — they can delete, which is visible; a silent edit isn't.
create policy debug_task_notes_update on public.debug_task_notes
  for update to authenticated
  using (private.can_write('debug') and created_by = (select auth.uid()))
  with check (private.can_write('debug') and created_by = (select auth.uid()));

create policy debug_task_notes_delete on public.debug_task_notes
  for delete to authenticated
  using (
    private.can_write('debug')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

-- Column grants, in the 0045 style — narrower than the policies, and the reason
-- a client can't set is_demo (showcase never writes) or created_at (server
-- clock only). Seeding goes through the service role, which ignores all of this.
revoke insert, update, delete on table public.debug_task_notes from authenticated, anon;
grant select on table public.debug_task_notes to authenticated;
grant insert (task_id, body, created_by) on table public.debug_task_notes to authenticated;
grant update (body) on table public.debug_task_notes to authenticated;
grant delete on table public.debug_task_notes to authenticated;

-- Realtime (0029 pattern). `replica identity full` is required, not optional:
-- without it a DELETE event carries no old row, realtime can't evaluate RLS
-- against it, and the note simply never disappears from anyone else's board.
do $$
begin
  execute 'alter table public.debug_task_notes replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'debug_task_notes'
  ) then
    execute 'alter publication supabase_realtime add table public.debug_task_notes';
  end if;
end $$;

-- A note on a task you're carrying should ping you, the same way an idea
-- comment does. Full list copied from 0042, which last set this constraint.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change', 'message', 'debug_note'
  ));
