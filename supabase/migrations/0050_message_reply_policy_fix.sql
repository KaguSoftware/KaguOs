-- Fix 0049's insert policy: it verified "a reply points into its own thread"
-- with an EXISTS over public.messages — inside a policy ON public.messages.
-- Postgres refuses that shape at execution time ("infinite recursion detected
-- in policy for relation \"messages\""): scanning the table a policy guards
-- re-enters that table's policies. Every reply INSERT failed with that error;
-- plain sends (reply_to_id null) were untouched only because the OR
-- short-circuited before the scan.
--
-- The check itself is still wanted, so it moves into a SECURITY DEFINER
-- function — the private.is_member pattern — which reads messages with the
-- caller's RLS off and therefore never re-enters the policy. Bypassing RLS
-- here gives nothing away: the function answers one yes/no — "does this row
-- sit in the exact thread being inserted into" — and the sender can already
-- read every row of a thread they can insert into (group member, or a
-- participant of the DM pair).

create or replace function private.reply_in_thread(
  reply_id uuid,
  sender uuid,
  recipient uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.messages r
    where r.id = reply_id
      and (
        (recipient is null and r.recipient_id is null)
        or (r.sender_id = sender and r.recipient_id = recipient)
        or (r.sender_id = recipient and r.recipient_id = sender)
      )
  );
$$;

grant execute on function private.reply_in_thread(uuid, uuid, uuid) to authenticated;

drop policy messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_member('work')
    and (
      reply_to_id is null
      or private.reply_in_thread(reply_to_id, sender_id, recipient_id)
    )
  );
