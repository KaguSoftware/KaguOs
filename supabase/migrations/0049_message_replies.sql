-- Replies and task cards as REFERENCES, not body text.
--
-- A reply used to be a `> Name: snippet` line prepended into the body, and
-- "message the author about a task" pasted `> title — /debug?q=…`. Both were
-- copies: the quote went stale the moment it was cut off at 90 chars, nothing
-- was clickable back to the original, and a task "link" was a search query.
-- These columns make both first-class: the client renders a live preview card
-- from the referenced row and can jump to it.
--
-- `on delete set null`, not cascade: a reply must not vanish because the line
-- it answered (or the task it discussed) was deleted — it degrades to a plain
-- message, the same way a former member degrades to "Former member".
alter table public.messages
  add column reply_to_id uuid references public.messages (id) on delete set null,
  add column task_id uuid references public.debug_tasks (id) on delete set null;

-- Partial: almost every message is neither a reply nor a task share, and the
-- FK's ON DELETE walk is the only reader of these.
create index messages_reply_to_idx
  on public.messages (reply_to_id) where reply_to_id is not null;
create index messages_task_idx
  on public.messages (task_id) where task_id is not null;

-- A reply may only point INTO ITS OWN THREAD. The server action validates this
-- too, but the action is not the only writer the API allows, and without the
-- check a crafted insert could make the group chat "quote" someone else's DM.
-- (The quoted body itself never leaks — hydration is a SELECT under the
-- reader's own RLS — but the reference alone shouldn't be expressible.)
-- `messages.…` names the row being inserted; `r` is the quoted message, and the
-- EXISTS runs under this sender's own read policy, so you can only reply to a
-- line you can see.
--
-- `task_id` gets no such check: every task is visible to the whole debug
-- section, so there is no cross-thread shape to forbid — the FK is enough.
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_member('work')
    and (
      reply_to_id is null
      or exists (
        select 1 from public.messages r
        where r.id = messages.reply_to_id
          and (
            (messages.recipient_id is null and r.recipient_id is null)
            or (r.sender_id = messages.sender_id
                and r.recipient_id = messages.recipient_id)
            or (r.sender_id = messages.recipient_id
                and r.recipient_id = messages.sender_id)
          )
      )
    )
  );
