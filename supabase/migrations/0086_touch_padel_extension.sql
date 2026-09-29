-- 0086: Touch Padel's extension, as a project of its own.
--
-- ⚠️  THE DATA IN THIS FILE IS ALREADY IN PROD. DO NOT RUN IT BY HAND.
--     Written on 2026-09-29 as REST inserts with the service-role key
--     (project id 1349bd84-77df-46d9-9752-6f1917594a76), because the
--     Management API token was still expired and no Supabase connector was
--     available that day. Corrections made afterwards the same day (payment
--     dates, wording, no input pack) went in the same way and were regenerated
--     into this file. The history row is NOT stamped for 0086; `supabase
--     migration repair --status applied 0086`, or a push, stamps it. The file
--     is replay-safe either way: it finds the project by name and inserts
--     nothing a second time.
--
-- The scope extension (v1.0, signed 2026-09-25, plus three additions recorded
-- on 2026-09-29) is a second contract: its own fee, its own installments, its
-- own acceptance and its own 90-day warranty. The signed document says Phase 1
-- "stays on its own terms" and that Phase 1 acceptance does not wait for any
-- module in it. So the extension is a project of its own rather than more rows
-- under Phase 1: Phase 1's four bars do not drop as unfinished extension
-- levels are added, and neither fee muddies the other.
--
-- ── What is seeded ──────────────────────────────────────────────────────────
--
--   * the project 'Touch Padel · Extension' (client 'Touch Padel'), due
--     2026-11-10;
--   * one plan, 'Extension fee': four monthly installments totalling $5,600,
--     $1,500 on 30 Oct, 30 Nov and 30 Dec 2026, then $1,100 on 30 Jan 2027.
--     Nothing is due on signing. None is marked paid: that is a fact somebody
--     records when the money lands;
--   * a plan of four systems with the same names as Phase 1 (Mobile app,
--     Desktop app, Website, Management panel) and twenty levels under them.
--     System weights are 30 / 49 / 6 / 15 and sum to 100; level weights are a
--     share of the system and sum to 100 in each. Every extension item lands
--     under exactly one level, and the allocation, with the section of the
--     signed document each item comes from, is `Project Scope - Extension.md`.
--
-- Everything starts at 0 and 'planned'. Some of it is already built in the
-- product repository; setting completion is a producer's call, made in the
-- plan editor, not guessed here.
--
-- The plan is a seed. Once the project is live the producer edits weights,
-- levels and completion in the plan editor (on 2026-09-29 the Website level
-- 'Pay the tab' had already been removed and 'Branches on the site' set to 75),
-- so prod, not this file, is authoritative. A replay leaves such edits alone:
-- it lays the plan only into a project that has no milestones at all.
--
-- ── Dates ───────────────────────────────────────────────────────────────────
--
-- Signed 2026-09-25. The mobile build goes to store review by 2026-10-13;
-- everything else is due 2026-11-03; store review is estimated at three to four
-- weeks after submission. A level's target_on is the date its own work is due,
-- except every 'Design & launch', which carries 2026-11-10: the end of the
-- review estimate, and of the five-day production run that gates it (the
-- convention 0080 set for Phase 1). That is also the project's due date.
--
-- ── Publishing, and no input pack ───────────────────────────────────────────
--
-- Nothing here links the project to a client login. `client_projects` is what
-- makes a project visible to Touch, and it is a separate act: the Admin page,
-- or the insert below. (On 2026-09-29 the producer linked Touch's login by
-- hand.)
--
--   insert into public.client_projects (user_id, project_id)
--   select user_id, '1349bd84-77df-46d9-9752-6f1917594a76'
--   from public.client_projects
--   where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666'
--   on conflict do nothing;
--
-- The project is created with intake_pack = 'none': no input pack. The portal
-- used to give every project one, falling back to the generic 'general' pack,
-- and counted it as a pack still to finish; an extension has no inputs to
-- collect. 'none' (NO_PACK in src/lib/intake.ts) is understood by the portal
-- once the code that adds hasPack() is deployed; before that it is read as the
-- general pack, harmlessly. No schema change: the column is advisory free text
-- (0073).
--
-- Phase 1 (project 37024fb4-...) is not touched by this file.

begin;

-- One block, and each step in it is laid once or not at all: it is guarded on
-- the thing it lays being absent, and the shape checks run only on rows this
-- run has just written. A replay after a producer has edited the live plan (a
-- level removed, a weight changed, a payment marked paid) therefore neither
-- fails nor changes anything.
do $seed$
declare
  pid uuid;
  n integer;
  bad text;
begin
  -- 1. The project. Found by name.
  insert into public.projects
    (name, client, status, repo_url, prod_url, notes, sector, type, is_demo, due_on, intake_pack)
  select
    'Touch Padel · Extension', 'Touch Padel', 'active',
    'https://github.com/KaguSoftware/TouchPadel',
    'https://touch-padel-web.vercel.app/en',
    $t$Extension to Phase 1, signed 2026-09-25 (scope extension v1.0, plus three additions recorded 2026-09-29). Ten modules: online payment, coaching and courses, open matches, tournaments, Touch Shop, loyalty, multi-branch, AI stock intake, AI analysis, protocols and checklists. Added since v1.0: screenshot protection with reporting in the audit log, the assistant on owners' and managers' phones, and a full training exam in the Operator. Customer 360 is removed from the roadmap. Fee $5,600 in four monthly installments from 2026-10-30, nothing on signing. The data behind this plan is 'Project Scope - Extension.md'. Phase 1 stays on its own project.$t$,
    'health', 'other', false, date '2026-11-10', 'none'
  where not exists (select 1 from public.projects where name = 'Touch Padel · Extension');

  select id into pid from public.projects where name = 'Touch Padel · Extension';
  if pid is null then
    raise exception 'the extension project is missing';
  end if;

  -- 2. The payment plan and its four installments, laid together or not at
  --    all. None is marked paid: that is a fact somebody records when the
  --    money lands.
  insert into public.project_payment_plans
    (project_id, title, kind, currency, amount_each, cadence, starts_on, ends_on, status, note, visible_to_client)
  select
    pid, 'Extension fee', 'installments', 'USD', null, 'monthly',
    date '2026-10-30', date '2027-01-30', 'active',
    $t$The scope extension's fee is $5,600, paid in four monthly installments from 30 October 2026: $1,500 on 30 October, 30 November and 30 December, then the last $1,100 on 30 January 2027. Installments follow the calendar, not the delivery milestones. Phase 1's fee is separate and unchanged.$t$,
    true
  where not exists (select 1 from public.project_payment_plans where project_id = pid);
  get diagnostics n = row_count;

  if n > 0 then
    insert into public.project_payment_installments
      (plan_id, project_id, seq, label, amount, due_on, status)
    select pp.id, pp.project_id, v.seq, v.label, v.amount, v.due_on, 'scheduled'
    from public.project_payment_plans pp
    cross join (values
        (1, 'First payment', 1500.00, date '2026-10-30'),
        (2, 'Second payment', 1500.00, date '2026-11-30'),
        (3, 'Third payment', 1500.00, date '2026-12-30'),
        (4, 'Final payment', 1100.00, date '2027-01-30')
    ) as v(seq, label, amount, due_on)
    where pp.project_id = pid;

    if (select count(*) from public.project_payment_installments where project_id = pid) <> 4
       or (select sum(amount) from public.project_payment_installments where project_id = pid) <> 5600 then
      raise exception 'the extension fee must be four installments totalling 5600';
    end if;
  end if;

  -- 3. The plan: four systems, then their levels. Laid only into a project
  --    with no milestones at all, so a replay never puts a second plan over
  --    one a producer has been setting completions on.
  if not exists (select 1 from public.project_milestones where project_id = pid) then
    with parents as (
      insert into public.project_milestones
        (project_id, title, detail, status, sort, weight, completion, target_on, visible_to_client)
      select pid, v.title, v.detail, 'planned', v.sort, v.weight, 0, v.target_on, true
      from (values
        ('Mobile app', $t$The same phone app Touch's guests already use, now carrying everything the extension adds: paying for what they book, lessons and courses, open matches, tournaments and the loyalty QR, plus a staff-only section for requests, checklists, receipt capture and the assistant. One codebase builds both the iPhone and Android apps, published under Touch's own developer accounts. Cafe ordering stays on the website. Nothing is sold through Apple or Google in-app purchase: court time, food and goods are real-world services, so they are paid through the payment provider, which both stores require.$t$, 10, 30, date '2026-11-10'),
        ('Desktop app', $t$The Operator, the Windows application the venue is run from, takes on everything the extension adds behind the desk: online payments and refunds, coaches and courses, open matches and tournaments on the same calendar, the Touch Shop at the till, the loyalty scan, more than one branch with stock per branch, AI reading of supplier receipts, and the training exam. Two new roles, Coach and Marketing, are added to the staff roles, although both work in the phone app. It is again the largest of the four systems, because almost everything a module needs to be set up, run or checked happens here.$t$, 20, 49, date '2026-11-10'),
        ('Website', $t$The public website on Touch's own domain gains two things. A guest can pay their table's open cafe tab from their phone, and every branch gets its own venue page and table codes. Ordering still needs no app and no account.$t$, 30, 6, date '2026-11-10'),
        ('Management panel', $t$The reports panel grows in three directions. Online payments, branches and the shop show up in the figures, an assistant answers questions about the business in plain English or Arabic, and screenshot attempts appear in the log. It still reports and never writes.$t$, 40, 15, date '2026-11-10')
      ) as v(title, detail, sort, weight, target_on)
      returning id, project_id, title
    )
    insert into public.project_milestones
      (project_id, parent_id, title, detail, status, sort, weight, completion, target_on, visible_to_client)
    select parents.project_id, parents.id, child.title, child.detail, 'planned',
           child.sort, child.weight, 0, child.target_on, true
    from parents
    join (values
      ('Mobile app', 10, 13, date '2026-10-13',
       'Pay in the app',
       $t$A guest pays on their own phone for what they book: a court, a place in a lesson or course, a seat in an open match, or a tournament entry, in full, by card or the provider's own wallet where it offers one, on the payment provider's own checkout, so card details never pass through Touch's systems. The slot a guest is holding stays reserved while they pay; if the payment fails or times out, the hold expires and the slot goes back on the grid. Every payment leaves a receipt in the guest's account, in English and Arabic.

Touch's merchant account needs the provider's own approval, which can take weeks, so this is built against the provider's test environment and switched to live keys when the account is approved. If the account is not live by the end of the build, the module is accepted on the test environment and goes live the day it is.

Done when, in the build sent to the stores, a guest can pay for a court against the provider's test environment and a failed payment releases the slot. The desk showing it paid is checked under Desktop app, Payments & refunds.$t$),
      ('Mobile app', 20, 24, date '2026-10-13',
       'Lessons, matches & tournaments',
       $t$Three new ways to play, from the guest's side.

Lessons and courses (Module 12): a guest books a private or small-group lesson with a chosen coach, or enrols in a group course until it is full. Coaches sign in to the same app to see their own schedule, sessions and students.

Open matches (Module 13): a player opens seats on a court, or on a booking they already hold. The match carries a level range and a short note, and every player has a self-declared level on their profile. Other players find it in a list filtered by date, time and level, join in one tap (and can leave within the cancellation window), and each pays an equal share; the organiser can remove a player before the start. The venue's cutoff rule decides what happens to a match that does not fill, and notifications go out when someone joins or leaves, when the match fills and if it is cancelled.

Tournaments (Module 14): pairs register and pay in the app, and brackets, group tables, fixtures and results live there too, with a notification for each fixture and result.

Done when, in the build sent to the stores, a guest can book a lesson with a chosen coach, a coach can see their own schedule, a match can fill with three other guests who each pay their share, and a pair can enter a tournament and see its bracket, all against the test setup.$t$),
      ('Mobile app', 30, 7, date '2026-10-13',
       'Points & branches',
       $t$Every guest has a personal QR code in their account. The desk or till scans it to attach the guest to a booking, a tab or a sale; points are credited when the bill is paid, and taken back if it is refunded. The balance and history are in the app. Guests also choose which branch to book at, and their account, bookings and points work at every branch.

Done when, in the build sent to the stores, a guest's QR code shows in their account, their points balance and history show in the app, and the same guest can book at either of two branches from one account, all against the test setup.$t$),
      ('Mobile app', 40, 24, date '2026-10-13',
       'Protocols & checklists',
       $t$A staff-only section of the app, which guests never see, where requests follow a set route instead of getting lost in a chat. Each type of request has its own form and its own route. Every step is held by a role, or by the person who raised the request, and the holder approves and passes it on, sends it back with a comment, or rejects it with a reason. A step can return to the person who raised the request before it moves on.

Photos and files attach from the phone. Whoever holds the next step gets a push notification and a list of what is waiting for them, and every request keeps a full timeline of who acted, what they did, when, and their comment. Nothing is deleted.

Managers also set checklists, such as opening, closing and cleaning, assigned to a role or a person, once or repeating daily or weekly, per branch. Each tick is stamped with who and when, and managers see what is done, late or incomplete. Marketing is a new role that holds steps in the routes, with no access to the till, stock or financial reports.

Done when a member of staff raises a request and it travels its full route, including a return to the person who raised it, with each holder notified; a send-back and a rejection each work with the comment recorded; and a daily checklist is completed in the app with each tick stamped and visible to the manager.$t$),
      ('Mobile app', 50, 10, date '2026-10-13',
       'Staff tools',
       $t$Three things for the people who run the venue, all in the staff section.

Receipt capture (Module 18): photograph a supplier's receipt with the phone camera and send it into stock intake.

The assistant on the phone: owners and managers can ask the assistant their questions about the business away from the desk, in English or Arabic, with answers built from the same figures as the management panel and limited to the branches that person can already see.

Screenshot protection: screens in the staff section are protected against screenshots and screen recording where the phone allows it. On Android a capture is blocked. An iPhone does not let an app forbid a screenshot, so there it is detected and logged, and the screen is hidden while it is being recorded and in the app switcher. Every attempt is written to the audit log with who, when, on which device and which screen.

Done when, in the build sent to the stores, a receipt can be photographed and sent from a phone, an owner can ask the assistant a question and get an answer, and a screenshot attempt in the staff section appears in the audit log, all against the test setup.$t$),
      ('Mobile app', 60, 22, date '2026-11-10',
       'Design & launch',
       $t$Every new screen designed in English and Arabic, with the layout mirrored for right-to-left, then the updated app submitted to Apple and Google under Touch's developer accounts.

The build goes to store review by 13 October 2026, and review is estimated at three to four weeks, so roughly 3 to 10 November. That is an estimate: Apple and Google decide, and a rejection resets the clock. This build adds payments and new account types, which the stores look at closely. The mobile app is accepted on submission of a working build, not on store approval.

Done when the updated app is submitted to both stores, every new screen has been checked in English and Arabic, and the five-day run on the complete system has finished with no unresolved major issue.$t$),
      ('Desktop app', 10, 18, date '2026-11-03',
       'Branches & stock',
       $t$More than one Touch venue on one system. Each branch has its own record (name, address, hours, closed days and contact, in English and Arabic) and its own courts, rates, cafe tables, till, preparation station, promotions and degraded mode, while there is one menu and one product catalogue, with prices and availability set once or per branch. Staff are assigned to one or more branches: a cashier signs in to their own branch and sees only that branch, and the owner, and managers given several branches, switch between them or see all of them. Branch access is enforced in the database, not only on screen.

Each branch keeps its own stock ledger, counts, variance and expiry batches. Stock moves between branches by transfer, sent by one and received by the other with short receipts recorded, so stock is never counted in two places. Day close runs per branch and reconciles on its own, and an outage at one branch locks near-term bookings for that branch only. The two new staff roles, Coach and Marketing, are set up alongside the others, although both work in the phone app.

Done when a second branch is set up with its own courts, tables and stock, its staff see only that branch, and a transfer leaves one branch's stock and arrives in the other's.$t$),
      ('Desktop app', 20, 12, date '2026-11-03',
       'Payments & refunds',
       $t$The desk side of paying online. For each kind of item the venue chooses whether guests pay online, at the desk, or either. An online payment shows on the booking or tab it paid for, marked as paid online, and a tab a guest settled from their phone closes at the till by itself once the provider confirms. Payment goes through one provider, licensed in Iraq and chosen by Touch. Every confirmation from the provider is checked on the server and processed once, so a repeated notice can never record a payment twice.

A manager can refund an online payment from the desk, back through the provider and following the cancellation policy, with who did it and why recorded in the audit log. The day close shows cash, card at the desk and online as separate lines.

Done when a court paid in the app shows at the desk as paid online, a refund returns through the provider, a cafe tab settled from a phone closes at the till, and the day close shows online payments as a line of their own.$t$),
      ('Desktop app', 30, 25, date '2026-11-03',
       'Coaching, matches & tournaments',
       $t$Coaching and courses (Module 12). Staff manage coach profiles in English and Arabic, weekly availability with days off, and lesson prices per coach and length, with the usual peak and off-peak rates. A lesson occupies its court on the same calendar as every other booking, under the same rule that stops two reservations overlapping, and a coach cannot be booked twice for the same time. Cancellation windows and no-shows are handled as they are for courts. Group courses have a start date, weekly sessions, a capacity and a price, and their sessions hold their courts for the whole run; the desk can enrol, move or remove a student, and the coach or the desk marks attendance. Each coach has a commission rule, and a settlement report for any period shows sessions delivered, revenue, commission owed and already paid. A settlement is marked paid with its date and method, settled sessions are locked, and the report exports to CSV. The system records what is owed; the money itself moves outside it.

Open matches (Module 13). The desk sees each open match on the calendar with its seats and who has paid, and takes a seat's share at the desk.

Tournaments and leagues (Module 14). Staff set up a tournament with dates, categories, entry fee, capacity and registration deadline, in knockout, groups-then-knockout or Americano format. Pairs register at the desk or in the app, and the draw, with seeding set by staff, places fixtures on real courts without clashing with bookings. Scores entered at the desk advance the bracket and the group tables. Leagues run a fixture list over several weeks, with standings and points rules set per league.

Done when a lesson with a chosen coach appears on the desk calendar and neither the court nor the coach can be double-booked, a course refuses enrolment once it is full, a settlement for a period matches the sessions delivered, an open match shows on the calendar full and paid and the venue's cutoff rule applies when one does not fill, and a tournament's draw places fixtures on courts and advances as scores are entered, with a league's standings updating as results come in.$t$),
      ('Desktop app', 40, 14, date '2026-11-03',
       'Shop & loyalty',
       $t$The Touch Shop (Module 15). Rackets, balls, grips, apparel and accessories in a catalogue with photograph, price, cost, category and barcode, with variants such as size and colour each carrying their own price and stock. A racket and a drink are sold in one basket at the till, in one payment, with a standard USB barcode scanner. Stock is an append-only ledger of goods received, sales, returns and count adjustments, with low-stock alerts and a reorder level per product, and a manager handles returns and exchanges at the till, reversing the stock movement. Shop sales, cost and margin appear on their own line in the management panel, apart from padel and cafe. The shop sells at the till only, not in the app or on the website.

Loyalty at the till (Module 16). The guest's QR is scanned by camera or USB scanner. One earn rate, set by the venue, applies across courts, lessons, cafe and shop; points are credited when the bill is paid and taken back if it is refunded. A short list of rewards the venue sets, such as a drink or an hour of court time, is redeemed by scanning the QR, and points can expire after a period the venue chooses. Every earn, redemption and adjustment is recorded, and an adjustment needs a manager PIN and a reason. There are no tiers.

Done when a racket and a drink are sold in one basket and the racket's stock falls by one, a return puts it back, a paid bill earns the set points and a refund takes them back, and a reward is redeemed by scanning a guest's QR.$t$),
      ('Desktop app', 50, 8, date '2026-11-03',
       'AI stock intake',
       $t$Photograph a supplier's receipt on the phone, or upload a photo or PDF here, and the goods-received entry fills itself, for staff to confirm. Printed receipts and invoices in Arabic and English are read for the supplier, date, invoice number, and each line's item, quantity, unit, unit price and total. Each line is matched to an ingredient or shop product, and once a match is confirmed the system remembers that supplier's wording. Packs are converted into stock units, so a case of twelve one-litre bottles becomes twelve litres.

A review screen shows every field editable, unmatched lines highlighted, and the total checked against the receipt. Nothing enters stock until a person confirms it; on confirmation the goods-received entries are made with cost and expiry batch, and new costs flow into margin. The receipt image is kept with the delivery, and a warning appears when the same invoice is entered twice. Handwritten receipts are not guaranteed, expiry dates are not read from packaging, and there are no purchase orders or supplier accounts.

This needs an AI provider account opened and funded in Touch's name, and twenty or more real supplier receipts to tune against.

Done when printed receipts in Arabic and in English are photographed, read and matched, staff confirm them and goods-received entries with cost and expiry appear in stock, and the same receipt entered twice is flagged.$t$),
      ('Desktop app', 60, 9, date '2026-11-03',
       'Safeguards & training exam',
       $t$Two additions recorded on 29 September 2026.

Screenshot protection. The Operator's windows are protected against screen capture where the operating system allows it. On the Windows till and desk machines the window is excluded from capture. Where the system does not allow that, a capture is detected, and the content is hidden while the screen is being recorded. Every attempt is written to the audit log with who, when, on which device and which screen. This cannot be done on the website, and it does not stop someone photographing a screen with another device.

The full training exam. Built into the Operator: a graded exam for each role, in English and Arabic. Each person's result is saved, and managers and the owner can see it.

Done when a screen capture attempt on a till machine is stopped or hidden and appears in the audit log, and a member of staff can sit the exam for their role in their own language and their result is saved and shows for the manager.$t$),
      ('Desktop app', 70, 14, date '2026-11-10',
       'Design & launch',
       $t$Every new Operator screen designed in English and Arabic, with the layout mirrored for right-to-left. Then the venue trades on the complete system: remote training for the new and changed roles, recorded in both languages; the runbook, staff guide and technical handover brought up to date; defects fixed against each module's acceptance test; and five consecutive operating days with no unresolved major issue, which is what acceptance rests on.

Done when each module's acceptance test has been shown to Mustafa, the training is recorded in both languages, the runbook and staff guide are updated, and the five-day run has finished with no unresolved major issue.$t$),
      ('Website', 10, 45, date '2026-11-03',
       'Pay the tab',
       $t$A guest at a table settles the table's open cafe tab from their phone, in full, from the same page they ordered on. Payment is on the provider's own checkout, so card details never pass through Touch's systems. Once the provider confirms, the tab closes at the till by itself. Splitting a tab between guests and tipping are not included, and the shop does not sell on the website.

Done when a cafe tab is settled from a phone and closes at the till with nobody at the desk doing anything.$t$),
      ('Website', 20, 30, date '2026-11-03',
       'Branches on the site',
       $t$Each branch has its own venue page and its own table codes. There is one menu, with prices and availability set once or per branch, so a guest sees the prices and availability set for the branch they are in. A table's code opens the menu as that branch offers it, with ordering and the waiter call tied to that table.

Done when a table code at each of two branches opens the menu as that branch offers it and an order lands on that branch's kitchen screen.$t$),
      ('Website', 30, 25, date '2026-11-10',
       'Design & launch',
       $t$The payment step and the branch pages designed in English and Arabic and mirrored for right-to-left, live on Touch's domain alongside the existing site, then fixed against the five-day run.

Done when the payment step and the branch pages are live on Touch's domain in both languages and the five-day run has finished with no unresolved major issue.$t$),
      ('Management panel', 10, 30, date '2026-11-03',
       'Online, branch & shop reports',
       $t$The figures learn the new money and the new places. Cash, card at the desk and online are separate lines in the day close and in the panel, and online payments are reconciled against the provider's settlement report. The panel filters by branch and shows branches side by side and combined, and each branch reconciles to its own day close. Touch Shop sales, cost and margin appear on their own line, apart from padel and cafe.

Done when online payments reconcile to the provider's report, the owner's panel shows each branch and a combined total that agrees with each branch's day close, and shop sales and margin have a line of their own.$t$),
      ('Management panel', 20, 40, date '2026-11-03',
       'Assistant',
       $t$An assistant in the panel for the owner and managers. They ask in plain English or Arabic, for example which court earned least last month or which ingredient is wasted most, and the answer is built from the panel's own figures, with every number linked to the report or transactions behind it. A weekly written review for the owner says what changed against the previous week and what stands out.

It is branch-aware, for one branch, several or all, and it only answers from the data and branches that person can already see. Every question and answer is logged, and guests' contact details are never sent to the AI provider. It reads; it never changes data, prices or settings, it does not forecast, and it does not send the review by email or WhatsApp. The same assistant is on owners' and managers' phones (see Mobile app, Staff tools). It needs an AI provider account opened and funded in Touch's name.

Done when ten test questions agreed with Touch are answered in each language with figures that match the panel, a manager is refused data outside their branches, and the weekly review is produced for a trading week.$t$),
      ('Management panel', 30, 10, date '2026-11-03',
       'Screenshots in the log',
       $t$Screenshot protection is only worth having if someone can see what happened. Every attempt, on a phone's staff section or in the Operator, appears in the audit-log view in Staff activity with who, when, on which device and which screen, alongside the other things staff do.

Done when a screenshot attempt on a phone and one on a till machine each appear in the log with the right person, device and screen.$t$),
      ('Management panel', 40, 20, date '2026-11-10',
       'Design & launch',
       $t$The new reports and the assistant designed in English and Arabic and mirrored for right-to-left, then proven: online payments reconciled to the provider's report, and the ten agreed test questions answered in both languages. Fixed against the five-day run.

Done when the new panel screens are checked in English and Arabic, the reconciliation and the ten test questions have been shown to Mustafa, and the five-day run has finished with no unresolved major issue.$t$)
    ) as child(parent_title, sort, weight, target_on, title, detail)
      on child.parent_title = parents.title;

    -- Shape of what was just laid.
    if (select count(*) from public.project_milestones where project_id = pid and parent_id is null) <> 4 then
      raise exception 'expected 4 systems on the extension plan';
    end if;
    if (select sum(weight) from public.project_milestones where project_id = pid and parent_id is null) <> 100 then
      raise exception 'extension system weights do not sum to 100';
    end if;
    select string_agg(par.title, ', ') into bad
    from public.project_milestones par
    where par.project_id = pid and par.parent_id is null
      and (
        (select count(*) from public.project_milestones c where c.parent_id = par.id) < 3
        or (select coalesce(sum(c.weight), 0) from public.project_milestones c where c.parent_id = par.id) <> 100
      );
    if bad is not null then
      raise exception 'systems without levels summing to 100: %', bad;
    end if;
  end if;
end $seed$;

commit;
