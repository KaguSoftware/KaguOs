-- 0019: Learn Q&A — questions on a sprint. The asker picks the audience:
-- 'everyone' (all learn members) or 'admins' (asker + admins only). Replies
-- inherit the question's visibility by EXISTS-ing against the questions table,
-- so its RLS decides for both. Also widens notifications.kind for the two new
-- Q&A events.

create table public.sprint_questions (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  audience text not null default 'everyone' check (audience in ('everyone', 'admins')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index sprint_questions_demo_sprint_idx
  on public.sprint_questions (is_demo, sprint_id, created_at desc);

create table public.sprint_question_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.sprint_questions (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index sprint_question_replies_demo_q_idx
  on public.sprint_question_replies (is_demo, question_id, created_at);

alter table public.sprint_questions enable row level security;
alter table public.sprint_question_replies enable row level security;

create policy sprint_questions_select on public.sprint_questions
  for select to authenticated
  using (
    (
      private.is_member('learn')
      and (
        audience = 'everyone'
        or created_by = (select auth.uid())
        or private.is_admin()
      )
    )
    or (is_demo and private.in_showcase())
  );

create policy sprint_questions_insert on public.sprint_questions
  for insert to authenticated
  with check (private.is_member('learn') and created_by = (select auth.uid()));

create policy sprint_questions_delete on public.sprint_questions
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

-- Replies: visible/insertable iff the parent question is visible to you —
-- the EXISTS runs under sprint_questions RLS for the querying role.
create policy sprint_question_replies_select on public.sprint_question_replies
  for select to authenticated
  using (
    exists (select 1 from public.sprint_questions q where q.id = question_id)
    or (is_demo and private.in_showcase())
  );

create policy sprint_question_replies_insert on public.sprint_question_replies
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.sprint_questions q where q.id = question_id)
  );

create policy sprint_question_replies_delete on public.sprint_question_replies
  for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

-- Two new notification kinds for Q&A events.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'debug_task_new', 'idea_new', 'idea_promoted', 'idea_comment',
    'reminder_shared', 'learn_question', 'learn_answer'
  ));
