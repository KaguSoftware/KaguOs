-- Widen project credentials from Management-only to Work members. Builders own
-- their projects, so they need the project's logins. Still gated (not everyone),
-- and the plaintext-at-rest caveat from 0011 stands — revisit with a real vault.

drop policy project_secrets_select on public.project_secrets;
drop policy project_secrets_insert on public.project_secrets;
drop policy project_secrets_update on public.project_secrets;
drop policy project_secrets_delete on public.project_secrets;

create policy project_secrets_select on public.project_secrets
  for select to authenticated
  using (private.is_member('work'));

create policy project_secrets_insert on public.project_secrets
  for insert to authenticated
  with check (private.is_member('work') and created_by = (select auth.uid()));

create policy project_secrets_update on public.project_secrets
  for update to authenticated
  using (private.is_member('work'))
  with check (private.is_member('work'));

create policy project_secrets_delete on public.project_secrets
  for delete to authenticated
  using (private.is_member('work') or private.is_admin());
