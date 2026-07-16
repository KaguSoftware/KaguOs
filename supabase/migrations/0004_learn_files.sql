-- Learn: sprint resources can be uploaded files, not just links.
-- Private bucket `learn`: members read, admins write (same shape as resource rows).

alter table public.sprint_resources add column file_path text;
alter table public.sprint_resources alter column url drop not null;

insert into storage.buckets (id, name, public)
values ('learn', 'learn', false)
on conflict (id) do nothing;

create policy learn_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'learn' and private.is_member('learn'));

create policy learn_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'learn' and private.is_admin());

create policy learn_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'learn' and private.is_admin());

create policy learn_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'learn' and private.is_admin());
