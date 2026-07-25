-- Lock the chat tables down to the columns the app actually writes.
--
-- THE HOLE THIS CLOSES. 0042 shipped `messages_update` scoped to the recipient:
--
--   create policy messages_update on public.messages
--     for update to authenticated
--     using (recipient_id = (select auth.uid()))
--     with check (recipient_id = (select auth.uid()));
--
-- The intent was "the recipient marks a direct message read". But RLS restricts
-- ROWS, not COLUMNS, and 0042 never revoked the table-wide UPDATE that Supabase
-- hands `authenticated` by default. So the only thing the policy actually
-- enforced was WHICH row you may write — every column on it was fair game. Any
-- work member could PATCH a DM they received and rewrite `body`, `sender_id` or
-- `created_at`; the sender's open thread would then patch the forged row into
-- place from the realtime UPDATE stream, and any reload would show the forgery
-- as the sender's own words. Reachable from a browser console with the
-- publishable key that is already on the page.
--
-- This is the pattern 0001 established for `profiles` and 0006/0015/0025/0027/
-- 0028/0030 have each extended since: revoke the blanket privilege, then grant
-- back exactly the columns the app writes. It had never been applied to any of
-- the three chat tables.
--
-- Idempotent: `revoke` and `grant` are both no-ops when already in that state.

-- ---- messages: insert the three columns sendMessage sets; update only read_at
--
-- created_at keeps its default (it must be server clock, not client-supplied),
-- and read_at is the ONLY thing anyone updates — markThreadRead's DM branch.
-- No delete grant: messages are a record (0042's rule, unchanged).
revoke insert, update, delete on table public.messages from authenticated, anon;
grant select on table public.messages to authenticated;
grant insert (sender_id, recipient_id, body) on table public.messages to authenticated;
grant update (read_at) on table public.messages to authenticated;

-- ---- message_images: insert only, and never updated by anything
--
-- 0044 created select + insert policies and no update/delete policy, so RLS
-- already blocks writes here. The GRANT was still wrong, and a future policy
-- added without re-checking privileges would have inherited the hole.
revoke insert, update, delete on table public.message_images from authenticated, anon;
grant select on table public.message_images to authenticated;
grant insert (message_id, file_path, width, height) on table public.message_images
  to authenticated;

-- ---- message_reads: the group-chat marker — user_id on insert, read_at after
--
-- markThreadRead's group branch upserts {user_id, read_at}, so insert needs
-- both and update needs only the timestamp. Without this, a work member could
-- repoint someone else's marker row... except the row is also the primary key
-- and the policy pins it to auth.uid(), so this one was already safe. Granting
-- it narrowly anyway keeps all three tables telling the same story.
revoke insert, update, delete on table public.message_reads from authenticated, anon;
grant select on table public.message_reads to authenticated;
grant insert (user_id, read_at) on table public.message_reads to authenticated;
grant update (read_at) on table public.message_reads to authenticated;
