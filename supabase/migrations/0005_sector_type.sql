-- Work: classify projects and ideas by client sector and software type.
-- Plain text (UI constrains via dropdowns) so the lists can evolve without migrations.

alter table public.projects add column sector text;
alter table public.projects add column type text;
alter table public.ideas add column sector text;
alter table public.ideas add column type text;
