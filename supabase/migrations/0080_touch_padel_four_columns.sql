-- 0080: Touch Padel's plan as four systems, not five week-tracks.
--
-- 0077 wrote the plan as section 15's four parallel tracks plus the review
-- window; 0079 opened each track up week by week. Both answered "what is Kagu
-- working on this week". The client's question is different: "how far is each
-- THING I am getting" -- the app, the desktop, the website, the management
-- panel. Majed's sketch (2026-08-26) was exactly that: four columns, one bar
-- each, feature levels underneath, an overall figure on the end.
--
-- So the plan is re-cut by SYSTEM. Every in-scope item of the signed scope of
-- work (Phase 1, v2.0) lands under exactly one level of one system -- the full
-- allocation, with page citations, is `Project Scope.md` at the repo root.
-- Nothing here is invented; the `detail` on each row is that file's drawer
-- text, written for Mustafa rather than for the board.
--
-- ── Weights ─────────────────────────────────────────────────────────────────
--
-- Top-level weights are a judgement about SIZE (Project Scope.md §1): desktop
-- carries the till, five workspaces, stock ("the largest module"), most of the
-- platform track, training and the handover; the app and the website are one
-- surface each; the panel is reports only. 20 + 47 + 17 + 16 = 100, because
-- milestoneProgress divides by max(allocated, 100).
--
-- Child weights are a share of THE PARENT (0078 §1c) and sum to 100 within
-- each system. Completion is never set here: every level starts at 0 and
-- 0078's rollup writes the parents.
--
-- ── The production run ─────────────────────────────────────────────────────
--
-- The five-day production run (§16) is not a row. It is the gate on each
-- system's last level -- none of the four "Design & launch" levels is marked
-- done until the run is complete -- so the bars fill together, which is the
-- "upon completion all rows are filled" rule.
--
-- ── Supersession ───────────────────────────────────────────────────────────
--
-- 0079 gained a guard in the same change: it returns early when a top-level
-- 'Management panel' row exists on this project, so a replay of 0079 cannot
-- add the five tracks back on top of the four systems. 0077's existing guard
-- ("any sub-phase on this project") already covers 0077.

begin;

-- ---------------------------------------------------------------------------
-- Precondition: 0078 must already be applied (same reasoning as 0079).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'project_milestones'
      and column_name = 'parent_id'
  ) then
    raise exception
      '0080 requires 0078: project_milestones.parent_id does not exist. Apply 0078_milestone_sub_phases.sql first, then re-run this file.';
  end if;
end $$;

-- Replay-safe, and ordered: children go with their parents through 0078's
-- cascade. Clears BOTH the 0079 plan (five tracks) and this one (four
-- systems), so running this file on either state ends in the same place.
-- Scoped to ONE project id -- never widen it (0076's reasoning).
delete from public.project_milestones
where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666'
  and parent_id is null
  and title in (
    -- 0079
    'Platform & data',
    'Mobile app — padel booking',
    'Website — cafe guest',
    'Desktop — till & desk',
    'Review, training & handover',
    -- 0080
    'Mobile app',
    'Desktop app',
    'Website',
    'Management panel'
  );

with parents as (
  insert into public.project_milestones
    (project_id, title, detail, status, sort, weight, completion, visible_to_client)
  values
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Mobile app',
      $t$The app a guest keeps on their phone to book a court. One codebase builds both the iPhone and Android apps through Expo EAS, published under Touch's own developer accounts. Padel only: the cafe deliberately lives on the website, because a guest at a table will not install an app to order a coffee, and the app is reserved for padel, where a guest has reason to return and hold an account. Payment is never taken in the app — guests reserve, then pay at the desk.$t$,
      'planned', 10, 20, 0, true
    ),
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Desktop app',
      $t$The application the venue is actually run from. One Windows build, installed on the till and desk machines so it opens on boot and cannot be closed like a browser tab, in which each role signs into its own workspace: reception, cashier, kitchen, manager, owner. The court calendar, the till, the kitchen screen, customer records and promotions, the stock system, and the mode that keeps the till trading when the internet drops all live here. The largest of the four systems by a distance.$t$,
      'planned', 20, 47, 0, true
    ),
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Website',
      $t$The public website on Touch's own domain — and the whole cafe guest experience. A guest scans the table's code with the phone's own camera and the menu opens already tied to that table, with nothing to install and no account to create; they order, watch it progress, and call a waiter. Someone who searched for the venue last night sees the same site with the menu and the venue details. Ordering is not paying: the bill is settled at the desk before the guest leaves.$t$,
      'planned', 30, 17, 0, true
    ),
    (
      '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
      'Management panel',
      $t$The whole business in one place, every figure traceable to the transactions behind it, and everything exportable. Every number is calculated from the real bookings, orders, payments and stock movements in the database inside a dedicated reporting layer — nothing is estimated and nothing comes from an event-tracking pipeline, which is why the panel and the day close can never disagree. The owner's workspace lands on it. It reports; it does not write.$t$,
      'planned', 40, 16, 0, true
    )
  returning id, title
)

insert into public.project_milestones
  (project_id, parent_id, title, detail, status, sort, weight, completion, visible_to_client)
select
  '37024fb4-0852-4fe3-a9f8-3835f4ee4666',
  parents.id,
  child.title,
  child.detail,
  'planned',
  child.sort,
  child.weight,
  0,
  true
from parents
join (values
  -- ── Mobile app ───────────────────────────────────────────────────────────
  ('Mobile app', 10, 15,
   'Sign-in & account',
   $t$How a guest gets into the app and who the app thinks they are. A guest creates an account with email and password, confirms the email, and can reset a forgotten password. Their profile holds their name, phone number and preferred language — and they can change language — and their confirmed bookings appear in their own account. Email rather than phone codes because SMS codes cost money per message and need a regional provider; the phone number is captured from day one so phone sign-in can be added later without a migration.

Done when a guest can register, verify, sign in and change language in the app with the layout correctly mirrored.$t$),
  ('Mobile app', 20, 45,
   'Reservation',
   $t$The reason the app exists. A guest sees every court — name, indoor or outdoor, description, photo — and a day view of which slots are free and what each one costs, with the price for that exact slot. Picking a slot holds it exclusively for a short time while the guest finishes; walk away and it goes back on the grid automatically. A confirmed booking appears on the desk calendar immediately. Underneath, the database refuses to store two overlapping reservations, so the same court-time can never be sold twice — proven with automated tests that fire simultaneous requests at one slot and check that exactly one wins. While the venue is offline, bookings for today and tomorrow are blocked with a clear message and the venue's phone number; bookings further ahead continue as normal.

Done when a guest books a court from the app and it appears immediately on the desk calendar, the concurrency test suite passes, and Touch has taken real bookings on the system.$t$),
  ('Mobile app', 30, 15,
   'Notifications',
   $t$After booking, the guest's phone receives a push message confirming it, a reminder before it, and a message if it is cancelled. The guest can cancel their own booking from the app inside the cancellation window Touch configures. Notification text exists in both English and Arabic.

Done when the confirmation, reminder and cancellation pushes arrive for a real booking, and a guest cancellation succeeds inside the configured window and is refused outside it.$t$),
  ('Mobile app', 40, 25,
   'Design & launch',
   $t$The app in both languages, in Touch's own look, and on both stores. Arabic is a true right-to-left layout, not a translated English one: numbers, dates, times and prices formatted the way each language expects, English fragments inside Arabic text reading correctly, and a fallback to the other language where a translation is missing. Week 4 is polish and store listing assets, then submission to Apple and Google under Touch's own accounts — Touch owns the listings from day one. The stores review on their own timetable, a rejection resets the clock, and weeks 5 and 6 are held for exactly that. The app counts as accepted when a working build is submitted, not when the stores approve it.

Done when a working build is submitted to both stores and the five-day production run has finished.$t$),

  -- ── Desktop app ──────────────────────────────────────────────────────────
  ('Desktop app', 10, 20,
   'Reservation desk',
   $t$The reception screen. A day and week calendar across every court where staff see today's bookings and live availability, take walk-ins with or without a guest account, move, shorten, extend or cancel a reservation, block court time for maintenance or a private event, and mark a guest arrived, completed or no-show. Whole recurring series — every Tuesday 20:00–22:00 for a stated number of weeks or until an end date — are created in one action, with clashes shown before the series is saved so staff can skip those dates or move them to another court. The venue's own rules live here: opening hours and closed days, peak and off-peak rates by weekday, time window and court, the cancellation window. One search box finds any customer by partial phone, name or email, in Arabic or Latin spelling, and their record shows bookings, no-shows, cafe orders, recurring series, and staff-only notes and flags the customer never sees.

Done when staff create, move and cancel bookings, a guest's app booking appears immediately on the calendar, and a customer is found by partial phone number and attached to a booking with history and notes appearing nowhere guest-facing.$t$),
  ('Desktop app', 20, 32,
   'Cafe & till',
   $t$Everything that makes the cafe trade. The cashier's till: a fast item grid, open tabs by table, court or name, merging tables and splitting bills, and charging a cafe order onto a court booking so a group pays for courts and drinks once. Payment is recorded as cash or card (the card terminal stays a separate machine), discounts and price overrides need an authorised PIN and a reason, and a printed or on-screen bill shows tax per item group. The kitchen works from a wall screen, not paper: tickets from the till and from phones at tables arrive in one list with their age, change colour past target time, and marking items ready tells the floor and updates the guest's page. Promotions are rules set up once and the system applies the single best one automatically; overrides stay behind a PIN for genuine exceptions. The menu is written here once, in English and Arabic side by side, and is live on the website within seconds. At the end of the day the float and counted cash are compared with what the system expected, the card total is reconciled against the terminal batch, and every discount, void, refund and waste entry is listed with its authoriser. And when the internet drops, the till keeps trading from cached data and a local queue that replays exactly once on reconnect.

Done when a full trading day is completed and the day close reconciles cash and card with every discount, void and refund traceable to a named actor; a promotion applies inside its window and refuses outside it; a website order reaches the kitchen screen and settles at the till; and with the network disconnected the till keeps trading and on reconnect every queued item appears exactly once.$t$),
  ('Desktop app', 30, 20,
   'Stock management',
   $t$Stock falls as orders are made, not at month end. Every menu item has a measured recipe, so confirming an order deducts its ingredients automatically — oat milk deducts oat milk, a double shot deducts twice the coffee. Ingredients carry pack size, cost, supplier and shelf life; deliveries are received with an expiry date per batch and used oldest-first; staff record waste with a reason and run physical counts. The variance report compares what the recipes say should be left with what was counted, with every movement one click away; cost of goods and margin per item move with supplier cost; low-stock alerts fire, and a menu item greys out on the website when an ingredient runs out. Stock accuracy is capped by recipe accuracy: Touch supplies measured recipes against Kagu's template by week 2 — the single largest client-side input in the phase.

Done when a physical count is run against a period of trading and the variance report reconciles to Touch's satisfaction, with every movement traceable to the order, delivery or waste entry that caused it.$t$),
  ('Desktop app', 40, 28,
   'Shell, design & launch',
   $t$The program itself and everything that makes it the venue's system. A Windows installer that opens on boot and cannot be closed as a browser tab; staff sign-in with short-lived sessions on shared machines and a PIN for sensitive actions; five landing screens, one per role, each in English and Arabic with full right-to-left; the owner's administration of staff accounts, roles and permissions, enforced in the database rather than hidden in the interface; and an append-only audit log of who did what, before and after, with a reason on every discount, void, override and adjustment. Underneath it, the shared foundation every system stands on — the database, schema, environments, backups and monitoring. It finishes with the launch: installation on the till and desk machines, staff training per role recorded in both languages, the runbook and staff guide, five consecutive operating days in production, and the handover of every repository and account into Touch's name.

Done when each of the five roles sees only what its permissions allow, reaches its own workspace in either language and completes its daily tasks unaided after training; the production run is complete; and Touch holds administrative ownership of every repository and account.$t$),

  -- ── Website ──────────────────────────────────────────────────────────────
  ('Website', 10, 35,
   'Menu & table QR',
   $t$The site itself and what a guest sees first. Server-rendered from the same records the till edits, so a price or availability change made at the desk is live on the site within seconds with no second copy to keep in step. The menu shows categories and items with photo, description, price and availability, sizes and variants, options like milk type or an extra shot with their price differences, allergen and dietary flags, and suggested add-ons; an item staff mark unavailable comes back tomorrow, and items grey out on their own when an ingredient runs out. Each table gets a printed QR code in Touch's branding carrying a signed token rather than a table number, so nobody can fake a table by editing a web address; a photographed code can be retired, and the binding expires after a period of inactivity.

Done when the site matches the desktop app exactly, reflects an availability change made at the till without a redeploy, and a guest with no app and no account scans a table code and the page opens bound to that table.$t$),
  ('Website', 20, 25,
   'Ordering',
   $t$Guests build a basket, review it and send it to their table. No sign-up is needed; signing in is optional and simply attaches the order to an existing account. While the page is open the guest watches the order move through sent, being prepared and ready as the kitchen works, pushed live without refreshing. At the desk the order is a tab against the table, settled before the guest leaves; during an outage ordering is blocked and the guest is directed to a member of staff.

Done when a guest with no app and no account orders in either language, the ticket reaches the kitchen screen, the status updates on their page, and the tab settles correctly at the till.$t$),
  ('Website', 30, 10,
   'Call waiter',
   $t$One tap asks for staff, with a reason — order, bill, water, assistance. Calls are limited per table so they cannot be spammed, and each moves from raised to acknowledged to resolved, stamped with who handled it and when; the call reaches the staff floor view. During an outage the button is blocked and the guest is told to find a member of staff.

Done when the waiter call reaches the floor view.$t$),
  ('Website', 40, 30,
   'Design & launch',
   $t$The website in Touch's own branding, in both languages with a true right-to-left Arabic layout, and live on Touch's domain. The same site serves the stranger who searched for the venue: address, opening hours, contact details and a map link, page titles and preview images so it looks right in search results and when shared, and a link to the mobile app on both stores for court booking. Regulars can add it to their home screen and come back without scanning. Every change goes to a preview link first, so Touch reviews before anything goes public.

Done when the site is live on Touch's domain in both languages, completes an order end to end from a scanned table code, and the five-day production run has finished.$t$),

  -- ── Management panel ─────────────────────────────────────────────────────
  ('Management panel', 10, 45,
   'Business reports',
   $t$The four report groups. Revenue & payment: revenue by day, week and month, padel and cafe separately and combined, cash against card, discounts, voids and refunds with the authoriser, tax collected by rate. Courts: occupancy and utilisation by court and by hour, revenue per court and per available hour, booking volumes and trend, cancellations and no-shows with rates, peak against off-peak. Cafe: order count and average order value, best-selling products and categories, cost of goods, gross profit and margin per item and overall, waste by reason, preparation times by station. Stock: stock value on hand, variance theoretical against counted, low-stock and below-par items, expiring-soon and expired items, consumption by ingredient over a period.

Done when every report in the four groups renders for a chosen period with a working comparison and reconciles exactly to the day-close figures for that period.$t$),
  ('Management panel', 20, 15,
   'Staff activity',
   $t$Activity and exceptions per person: orders taken and bookings created, discounts, voids and refunds applied with their reasons, how quickly waiter calls were answered, cash variance at day close attributed to whoever closed, and a view of the audit log filtered to one person or one action type. Shown against shift context, because a quiet Tuesday and a full Saturday are not comparable — explicitly not productivity scoring or a league table.

Done when the staff-activity views render for a chosen period with a working comparison and export to CSV.$t$),
  ('Management panel', 30, 20,
   'Controls & CSV export',
   $t$The controls that work identically on every report: any date and time range including custom ranges; comparison against the previous period or the same period last year, shown as both the change and the percentage; filters by court, category, staff member and payment method; and drill-through from any figure to the individual transactions that produced it. Everything exports as CSV that opens directly in Excel, encoded in UTF-8 so Arabic product and customer names survive the round trip — sales, bookings, customers, stock movements, waste, day-close reports, and any report at its current filter and date range.

Done when every report exports to CSV that opens correctly in Excel with Arabic text intact, and comparison works on every report.$t$),
  ('Management panel', 40, 20,
   'Design & launch',
   $t$The panel in both languages with a true right-to-left layout and locale-formatted numbers, dates and currency. Its launch is a proof rather than a demo: every report is checked against the till's day-close figures for the same period, and a real backup-and-restore test is performed together during handover, restoring to a separate environment and confirming the data is intact — an acceptance condition, not a claim. Touch holds direct access to the backups as project owner and can download or restore without Kagu.

Done when the management panel reconciles to the day-close figures, the backup and restore test has been performed together, and the five-day production run has finished.$t$)
) as child(parent_title, sort, weight, title, detail)
  on child.parent_title = parents.title;

-- ---------------------------------------------------------------------------
-- Invariants: the shape the portal's four-column view depends on.
do $$
declare
  parents integer;
  bad text;
begin
  select count(*) into parents
  from public.project_milestones
  where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666' and parent_id is null;
  if parents <> 4 then
    raise exception 'expected 4 systems on the Touch Padel plan, found %', parents;
  end if;

  -- Top-level weights sum to exactly 100 (milestoneProgress divides by
  -- max(allocated, 100), so anything else under-reads or over-reads the bar).
  if (select coalesce(sum(weight), 0) from public.project_milestones
      where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666' and parent_id is null) <> 100 then
    raise exception 'Touch Padel system weights do not sum to 100';
  end if;

  -- Each system has exactly four levels whose weights sum to 100.
  select string_agg(p.title, ', ') into bad
  from public.project_milestones p
  where p.project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666' and p.parent_id is null
    and (
      (select count(*) from public.project_milestones c where c.parent_id = p.id) <> 4
      or (select coalesce(sum(c.weight), 0) from public.project_milestones c where c.parent_id = p.id) <> 100
    );
  if bad is not null then
    raise exception 'systems without four levels summing to 100: %', bad;
  end if;

  -- Every level starts untouched; the rollup therefore leaves every parent at 0.
  if exists (
    select 1 from public.project_milestones
    where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666'
      and (completion <> 0 or status <> 'planned')
  ) then
    raise exception 'Touch Padel plan did not start at zero';
  end if;
end $$;

commit;
