-- 0085: Testing — a living checklist per project, wired into Debug.
--
-- Every project gets a list of things to check ("log in with Google", "pay with
-- a Turkish card"). Each check keeps its latest result on the row and its full
-- history in test_results. The part that makes it more than a checklist is the
-- loop with Debug:
--
--   fail  → a debug task is filed on the project's board (or the linked one is
--           reopened / noted — never a duplicate)
--   done  → when that task is marked done, the case flips to 'retest' and
--           whoever last tested it gets a bell
--   pass  → the loop closes
--
-- ── Why the fail path is a SECURITY DEFINER function ────────────────────────
--
-- Testing is its own section, so a tester may not hold Debug at all — and
-- debug_tasks' insert policy demands private.can_write('debug'). Widening that
-- policy would let a tester file ANY task, not just the one a failed check
-- produces. So the whole result (history row, case update, debug hop) runs as
-- one function that checks can_write('testing') itself and can write exactly
-- the rows a failed check implies. One transaction, too: a result can never
-- land without its task or the task without its result.
--
-- The done → retest flip is the same problem from the other side: the person
-- closing the task is a Debug member who may not hold Testing. A trigger on
-- debug_tasks does it, and covers the single and bulk paths alike.
--
-- ── Screenshots ─────────────────────────────────────────────────────────────
--
-- They go in the existing private `debug` bucket under a `testing/` prefix,
-- so the SAME object can be indexed by test_result_images and by the debug
-- task's debug_task_images — the developer sees the picture on the board with
-- no copy. Only a failure carries screenshots, and every failure indexes them
-- on its task, so the TASK owns their lifetime: Debug's existing delete paths
-- remove them, and deleting a check leaves them be.

begin;

-- ---------------------------------------------------------------------------
-- 1. The section
-- ---------------------------------------------------------------------------
alter table public.section_memberships
  drop constraint section_memberships_section_check;

alter table public.section_memberships
  add constraint section_memberships_section_check
  check (section in (
    'work', 'learn', 'management', 'debug', 'marketing', 'comms', 'chat',
    'status', 'testing'
  ));

-- Testers need the project NAMES for their tabs. Same widening 0007 gave Debug
-- members, for the same reason.
drop policy projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (
    private.is_member('work') or private.is_member('debug')
    or private.is_member('testing')
    or (is_demo and private.in_showcase())
  );

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Free-text group ("Auth", "Checkout"). Null = ungrouped.
  area text check (area is null or char_length(area) between 1 and 60),
  title text not null check (char_length(title) between 1 and 200),
  steps text check (steps is null or char_length(steps) <= 4000),
  expected text check (expected is null or char_length(expected) <= 2000),
  status text not null default 'untested'
    check (status in ('untested', 'pass', 'fail', 'blocked', 'retest')),
  position int not null default 0,
  -- The task a failure filed. `set null`: deleting the task shouldn't delete
  -- the check — the next failure just files a fresh one.
  debug_task_id uuid references public.debug_tasks (id) on delete set null,
  last_tested_by uuid references public.profiles (id) on delete set null,
  last_tested_at timestamptz,
  last_environment text
    check (last_environment is null or last_environment in ('prod', 'staging', 'local')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger test_cases_updated_at
before update on public.test_cases
for each row execute function private.set_updated_at();

create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.test_cases (id) on delete cascade,
  status text not null check (status in ('pass', 'fail', 'blocked')),
  environment text not null default 'staging'
    check (environment in ('prod', 'staging', 'local')),
  note text check (note is null or char_length(note) <= 2000),
  tester_id uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.test_result_images (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.test_results (id) on delete cascade,
  -- Path within the `debug` bucket: "testing/<case_id>/<uuid>.<ext>".
  file_path text not null check (file_path like 'testing/%'),
  width int,
  height int,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index test_cases_project_idx on public.test_cases (project_id);
create index test_cases_debug_task_idx
  on public.test_cases (debug_task_id) where debug_task_id is not null;
create index test_results_case_idx on public.test_results (case_id, created_at desc);
create index test_result_images_result_idx on public.test_result_images (result_id);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.test_cases enable row level security;
alter table public.test_results enable row level security;
alter table public.test_result_images enable row level security;

create policy test_cases_select on public.test_cases
  for select to authenticated
  using (private.is_member('testing') or (is_demo and private.in_showcase()));

create policy test_cases_insert on public.test_cases
  for insert to authenticated
  with check (private.can_write('testing') and created_by = (select auth.uid()));

create policy test_cases_update on public.test_cases
  for update to authenticated
  using (private.can_write('testing'))
  with check (private.can_write('testing'));

create policy test_cases_delete on public.test_cases
  for delete to authenticated
  using (
    private.can_write('testing')
    and (created_by = (select auth.uid()) or private.is_admin())
  );

create policy test_results_select on public.test_results
  for select to authenticated
  using (private.is_member('testing') or (is_demo and private.in_showcase()));

-- Results are written by record_test_result() below. No direct insert/update:
-- a result without its case update (or its debug task) is a lie.
create policy test_results_delete on public.test_results
  for delete to authenticated
  using (
    private.can_write('testing')
    and (tester_id = (select auth.uid()) or private.is_admin())
  );

create policy test_result_images_select on public.test_result_images
  for select to authenticated
  using (private.is_member('testing') or (is_demo and private.in_showcase()));

-- ---- Storage: the `testing/` prefix of the debug bucket. Policies OR
-- together, so these add to Debug's own and take nothing away.
create policy testing_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'debug' and name like 'testing/%'
    and (private.is_member('testing') or private.in_showcase())
  );

create policy testing_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'debug' and name like 'testing/%' and private.can_write('testing')
  );

create policy testing_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'debug' and name like 'testing/%' and private.can_write('testing')
  );

-- ---------------------------------------------------------------------------
-- 4. Notifications
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change', 'message', 'debug_note', 'learn_proof', 'learn_review',
    'creative_assigned', 'creative_status', 'creative_review',
    'client_intake', 'test_retest'
  ));

-- ---------------------------------------------------------------------------
-- 5. record_test_result — the one write path for a result
-- ---------------------------------------------------------------------------
-- Returns { task_id, task_action } where task_action is one of
--   'created'  a new debug task was filed
--   'reopened' the linked task was done and is open again
--   'noted'    the linked task was still open; the failure was added as a note
--   null       not a failure
create or replace function public.record_test_result(
  p_case_id uuid,
  p_status text,
  p_environment text,
  p_note text default null,
  p_priority text default 'medium',
  p_image_paths text[] default '{}',
  p_image_sizes jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.test_cases%rowtype;
  t public.debug_tasks%rowtype;
  v_result_id uuid;
  v_task_id uuid;
  v_action text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_body text;
  v_path text;
  i int;
begin
  if not private.can_write('testing') then
    raise exception 'You have view-only access to Testing.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('pass', 'fail', 'blocked') then
    raise exception 'Invalid status.' using errcode = 'check_violation';
  end if;
  if p_environment not in ('prod', 'staging', 'local') then
    raise exception 'Invalid environment.' using errcode = 'check_violation';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    p_priority := 'medium';
  end if;
  if coalesce(array_length(p_image_paths, 1), 0) > 6 then
    raise exception 'At most 6 screenshots.' using errcode = 'check_violation';
  end if;
  if p_status <> 'fail' and coalesce(array_length(p_image_paths, 1), 0) > 0 then
    raise exception 'Screenshots go with a failure.' using errcode = 'check_violation';
  end if;

  -- Lock the case: two people failing it at once must not file two tasks.
  select * into c from public.test_cases where id = p_case_id for update;
  if not found then
    raise exception 'That check no longer exists.' using errcode = 'no_data_found';
  end if;

  insert into public.test_results (case_id, status, environment, note, tester_id, is_demo)
  values (c.id, p_status, p_environment, left(v_note, 2000), me, c.is_demo)
  returning id into v_result_id;

  for i in 1 .. coalesce(array_length(p_image_paths, 1), 0) loop
    v_path := p_image_paths[i];
    if v_path not like ('testing/' || c.id::text || '/%') then
      raise exception 'Bad screenshot path.' using errcode = 'check_violation';
    end if;
    insert into public.test_result_images
      (result_id, file_path, width, height, is_demo, created_by)
    values (
      v_result_id, v_path,
      nullif(p_image_sizes -> (i - 1) ->> 'width', '')::int,
      nullif(p_image_sizes -> (i - 1) ->> 'height', '')::int,
      c.is_demo, me
    );
  end loop;

  if p_status = 'fail' then
    if c.debug_task_id is not null then
      select * into t from public.debug_tasks where id = c.debug_task_id;
    end if;

    v_body := concat_ws(E'\n',
      'Failed on ' || p_environment || '.',
      case when v_note is not null then E'\nWhat happened:\n' || v_note end
    );

    if t.id is not null and t.state <> 'done' then
      -- Still being worked on: add to it, don't duplicate it.
      insert into public.debug_task_notes (task_id, body, is_demo, created_by)
      values (t.id, left('Retest failed. ' || v_body, 2000), c.is_demo, me);
      v_task_id := t.id;
      v_action := 'noted';
    elsif t.id is not null and t.assignee_id is not null then
      -- Marked done but it still fails: back to open, same holder, off the
      -- archive if the 7-day sweep already took it.
      update public.debug_tasks
        set state = 'open', archived_at = null
        where id = t.id;
      insert into public.debug_task_notes (task_id, body, is_demo, created_by)
      values (t.id, left('Reopened by a failed retest. ' || v_body, 2000), c.is_demo, me);
      v_task_id := t.id;
      v_action := 'reopened';
    else
      -- No task yet (or a done one nobody holds, whose state 0048 won't let
      -- anyone change): file a fresh one.
      insert into public.debug_tasks
        (title, description, priority, kind, project_id, created_by, is_demo)
      values (
        left('Test failed: ' || c.title, 200),
        concat_ws(E'\n\n',
          case when c.area is not null then 'Area: ' || c.area end,
          case when c.steps is not null then E'Steps:\n' || c.steps end,
          case when c.expected is not null then E'Expected:\n' || c.expected end,
          v_body
        ),
        p_priority, 'fix', c.project_id, me, c.is_demo
      )
      returning id into v_task_id;
      v_action := 'created';
    end if;

    -- The same objects, indexed on the task, so the board shows the picture.
    insert into public.debug_task_images (task_id, file_path, width, height, is_demo, created_by)
    select v_task_id, ri.file_path, ri.width, ri.height, ri.is_demo, me
    from public.test_result_images ri
    where ri.result_id = v_result_id;
  end if;

  update public.test_cases
    set status = p_status,
        last_tested_by = me,
        last_tested_at = now(),
        last_environment = p_environment,
        debug_task_id = coalesce(v_task_id, debug_task_id)
    where id = c.id;

  return jsonb_build_object('task_id', v_task_id, 'task_action', v_action);
end;
$$;

revoke all on function public.record_test_result(uuid, text, text, text, text, text[], jsonb)
  from public, anon;
grant execute on function public.record_test_result(uuid, text, text, text, text, text[], jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. done → retest
-- ---------------------------------------------------------------------------
create or replace function private.testing_flag_retest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.state = 'done' and old.state is distinct from 'done' then
    for r in
      update public.test_cases
        set status = 'retest'
        where debug_task_id = new.id and status = 'fail'
        returning id, title, project_id, last_tested_by
    loop
      -- The tester who saw it fail is the one who knows what to look for.
      if r.last_tested_by is not null
         and r.last_tested_by is distinct from (select auth.uid()) then
        insert into public.notifications (recipient_id, actor_id, kind, title, href)
        values (
          r.last_tested_by, (select auth.uid()), 'test_retest',
          left('Fixed — retest: ' || r.title, 200),
          '/testing?project=' || r.project_id::text
        );
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create trigger debug_tasks_flag_retest
after update of state on public.debug_tasks
for each row execute function private.testing_flag_retest();

-- ---------------------------------------------------------------------------
-- 7. Realtime
-- ---------------------------------------------------------------------------
alter table public.test_cases replica identity full;
alter table public.test_results replica identity full;
alter publication supabase_realtime add table public.test_cases;
alter publication supabase_realtime add table public.test_results;

commit;
