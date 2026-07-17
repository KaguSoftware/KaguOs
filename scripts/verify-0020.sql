-- Verify migrations 0020 + 0021 + 0022 landed as the code expects. Read-only.
select
  -- 0020: idea pipeline
  (select count(*) from information_schema.columns
     where table_name = 'idea_votes' and column_name = 'value') as votes_value,
  (select count(*) from information_schema.columns
     where table_name = 'ideas' and column_name = 'required_count') as ideas_required,
  (select count(*) from information_schema.columns
     where table_name = 'ideas' and column_name = 'stage') as ideas_stage,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'work_access_count') as fn_public,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'work_access_count') as fn_private,
  (select count(*) from public.ideas where required_count is null) as ideas_missing_req,
  -- 0021: debug suggest + deadlines, project deadline
  (select count(*) from information_schema.columns
     where table_name = 'debug_tasks' and column_name = 'suggested_for') as dbg_suggested,
  (select count(*) from information_schema.columns
     where table_name = 'debug_tasks' and column_name = 'due_on') as dbg_due,
  (select count(*) from information_schema.columns
     where table_name = 'projects' and column_name = 'due_on') as proj_due,
  -- 0022: contact interactions
  (select count(*) from information_schema.tables
     where table_name = 'contact_interactions') as interactions_table,
  (select count(*) from information_schema.columns
     where table_name = 'contact_interactions' and column_name = 'is_demo') as interactions_demo;
