-- Showcase mode: a per-user flag that swaps the whole app to obviously-fake
-- demo data for client demos. Real rows are NEVER shown in showcase mode and
-- demo rows are NEVER shown in normal mode — the filter is applied server-side
-- in the data layer, driven by profiles.showcase_mode (only the server can
-- flip it; turning it OFF requires re-entering the password).

-- (a) The per-user toggle.
alter table public.profiles
  add column showcase_mode boolean not null default false;

-- (b) Mark demo rows across the demo-able tables. Everything defaults to real
-- (is_demo=false); the seed below flips the fake rows on.
alter table public.projects add column is_demo boolean not null default false;
alter table public.ideas add column is_demo boolean not null default false;
alter table public.debug_tasks add column is_demo boolean not null default false;
alter table public.transactions add column is_demo boolean not null default false;
alter table public.recurring_items add column is_demo boolean not null default false;
alter table public.marketing_campaigns add column is_demo boolean not null default false;
alter table public.marketing_posts add column is_demo boolean not null default false;
alter table public.contacts add column is_demo boolean not null default false;
alter table public.contracts add column is_demo boolean not null default false;

create index projects_demo_idx on public.projects (is_demo);
create index ideas_demo_idx on public.ideas (is_demo);
create index debug_tasks_demo_idx on public.debug_tasks (is_demo);
create index transactions_demo_idx on public.transactions (is_demo);
create index recurring_items_demo_idx on public.recurring_items (is_demo);
create index marketing_campaigns_demo_idx on public.marketing_campaigns (is_demo);
create index contacts_demo_idx on public.contacts (is_demo);

-- (c) Seed obviously-fake demo data. Names like "Acme Corp" and numbers like
-- 123456789 make it unmistakable this isn't real — a safety signal in itself.
insert into public.projects (name, client, status, is_demo) values
  ('Acme Corp Website', 'Acme Corp', 'active', true),
  ('Globex Mobile App', 'Globex Inc', 'planning', true),
  ('Initech Dashboard', 'Initech', 'active', true),
  ('Umbrella Redesign', 'Umbrella LLC', 'paused', true);

insert into public.ideas (title, body, status, is_demo) values
  ('Sample idea: AI onboarding bot', 'This is demo data for showcasing.', 'open', true),
  ('Sample idea: dark mode everywhere', 'This is demo data for showcasing.', 'open', true),
  ('Sample idea: referral program', 'This is demo data for showcasing.', 'promoted', true);

insert into public.debug_tasks (title, description, state, priority, is_demo) values
  ('Sample bug: login redirect loops', 'Demo task for showcasing.', 'open', 'high', true),
  ('Sample bug: chart tooltip overflow', 'Demo task for showcasing.', 'in_progress', 'medium', true),
  ('Sample bug: CSV export encoding', 'Demo task for showcasing.', 'open', 'low', true),
  ('Sample task: upgrade dependencies', 'Demo task for showcasing.', 'done', 'medium', true);

insert into public.transactions (type, amount, currency, occurred_on, client, notes, is_demo) values
  ('income', 123456.78, 'TRY', current_date - 3, 'Acme Corp', 'Demo invoice', true),
  ('income', 98765.43, 'USD', current_date - 10, 'Globex Inc', 'Demo retainer', true),
  ('expense', 12345.67, 'TRY', current_date - 5, 'Demo Vendor', 'Demo expense', true),
  ('expense', 4567.89, 'EUR', current_date - 20, 'Demo SaaS', 'Demo subscription', true);

insert into public.recurring_items (type, name, counterparty, amount, currency, cadence, started_on, is_demo) values
  ('income', 'Acme Corp retainer', 'Acme Corp', 111111.11, 'TRY', 'monthly', current_date - 90, true),
  ('expense', 'Demo hosting', 'Demo Cloud', 1234.56, 'USD', 'monthly', current_date - 120, true);

insert into public.marketing_campaigns (name, channel, status, budget, currency, is_demo) values
  ('Demo launch campaign', 'instagram', 'running', 50000.00, 'TRY', true),
  ('Demo brand awareness', 'google-ads', 'planned', 123456.00, 'TRY', true);

insert into public.contacts (name, company, kind, status, email, phone, is_demo) values
  ('John Sample', 'Acme Corp', 'client', 'active', 'john@acme.example', '+90 555 123 4567', true),
  ('Jane Demo', 'Globex Inc', 'lead', 'negotiating', 'jane@globex.example', '+90 555 987 6543', true),
  ('Sample Lead', 'Initech', 'lead', 'new', 'contact@initech.example', '123456789', true);
