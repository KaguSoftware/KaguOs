-- New notification kind: an admin suggested a debug task for you.
-- (Soft nudge — the task is still unclaimed and one-click-claimable by anyone.)

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer'
  ));
