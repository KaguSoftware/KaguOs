-- Verify migration 0020 landed as the code expects. Read-only.
select
  (select count(*) from information_schema.columns
     where table_name = 'idea_votes' and column_name = 'value') as votes_value_col,
  (select count(*) from information_schema.columns
     where table_name = 'ideas' and column_name = 'required_count') as required_count_col,
  (select count(*) from information_schema.columns
     where table_name = 'ideas' and column_name = 'stage') as stage_col,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'work_access_count') as public_fn,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'work_access_count') as private_fn,
  (select public.work_access_count()) as current_access_count,
  (select count(*) from public.ideas where required_count is null) as ideas_missing_required,
  (select count(*) from public.ideas) as total_ideas;
