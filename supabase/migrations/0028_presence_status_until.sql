-- Timed presence + status-change notifications.
--
-- Two related additions:
--   1. `status_until` — an optional expiry on a status, so someone can say
--      "unavailable till 15:00" / "working till 18:00". Null = open-ended (the
--      existing behaviour). The client treats an elapsed status_until as "no
--      status" without needing a write; a status set with a time still lives in
--      status_kind/status_text so nothing about the existing widget breaks.
--   2. A new `status_change` notification kind, so the team can be told when
--      someone updates their presence (0009 pinned kinds in a CHECK).
--
-- Same per-column grant pattern as 0027: profiles UPDATE is revoked from
-- `authenticated` (0001) and re-granted per column; profiles_update_own already
-- scopes writes to id = auth.uid(), so a user only ever sets their OWN expiry.

alter table public.profiles
  add column status_until timestamptz;

grant update (status_until) on table public.profiles to authenticated;

-- Widen the notifications kind CHECK to include status changes. Postgres has no
-- "alter constraint" for a check, so drop and recreate with the full set.
alter table public.notifications
  drop constraint notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'debug_task_new', 'debug_suggested', 'idea_new', 'idea_promoted',
    'idea_comment', 'reminder_shared', 'learn_question', 'learn_answer',
    'status_change'
  ));
