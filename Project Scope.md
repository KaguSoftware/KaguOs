# Touch Padel — Phase 1 · Project Scope

> The data behind the client portal's progress view for Touch Padel, re-cut from the signed
> scope of work (Phase 1, v2.0, "for signature") into **four columns — one per delivered
> system — each made of four levels**. Every in-scope item in the scope document lands under
> exactly one level of one column, so when all sixteen levels are done the whole phase is done.
>
> Source: `touchpadel-phase1.pdf` (28 pages). Citations are `§section page`, e.g. `§04 p8`.
> Nothing here is invented: if a capability is not written in the scope, it is not in Phase 1
> (§00 p3), and it is not in this file either. Where this file has to *decide* something the
> scope leaves open (which system hosts a screen, where a shared item is counted), the decision
> is marked as one — italic *split notes* inside the lists, and §14 for the open questions.

---

## 0 · Decisions this file is built on

Taken with Majed on 2026-08-26, before the file was written:

| Decision | Choice |
|---|---|
| Columns | **app · desktop · web · management panel** — four bars, no fifth |
| Column weights (share of the project) | **Kagu's call, sized from the scope** (Majed: "make the overall percentage whatever you think is best") — **app 20 · desktop 47 · web 17 · management panel 16**, reasoning in §1 |
| Levels per column | **Coarse, 3–4 per column** — like the sketch `auth / reservation / design`. With design as its own level every column ended at exactly four: sixteen levels |
| A design level | **In all four columns**, always the last level |
| Cross-cutting work (foundations, platform, degraded mode, role workspaces) | **Folded into the four columns**, each item counted in the column whose software it lives in — never a level outside the four bars |
| The review window (5-day production run, store review, training, docs, backup test, handover) | **Folded into the last level of each column** — no extra nodes |
| What "management panel" means | **Reports only** — module 10, "displaying those analytics to management". Everything operational (day close, staff & role administration, menu/rates editing, stock counts) stays in **desktop** |
| Per-level percentages | **Never shown inline** — only inside the drawer that opens when a level is clicked |
| This turn | **Document only.** The migration and the four-column UI come after review |

Two names from the original sketch do not exist in the scope and are mapped rather than kept:

- **"sign in times"** — the scope has no time clock: "Staff shift scheduling or time clock" is explicitly *not included* (§03 p7), and "staff performance reporting" (§07 p11) and "productivity scoring or league tables" (§11 p15, §12 p17) are excluded. The nearest real node is **Staff activity** (§12 p17): orders and bookings per staff member, discounts/voids/refunds with reasons, waiter-call response times, cash variance by whoever closed, and an audit-log view filtered to one person.
- **"employee manager"** — staff accounts, roles and permissions are owner administration in the desktop app (§02 p6, §11 p15), so they sit in **desktop → Shell, design & launch**. The management panel only *reports* on staff (Staff activity).

Naming shorthand used below: "desktop → Shell" means the level *Shell, design & launch*; "→ Design & launch" means that column's last level.

---

## 1 · The four columns at a glance

```
[ app 20 ]        [ desktop 47 ]           [ web 17 ]           [ management panel 16 ]      → overall %
   │                  │                        │                        │
   Auth               Reservation desk         Menu & table QR          Business reports
   Reservation        Cafe & till              Ordering                 Staff activity
   Notifications      Stock management         Call waiter              Controls & CSV export
   Design & launch    Shell, design & launch   Design & launch          Design & launch
```

| Column | What it is | Share of project | Levels (share of column) | Scope sections |
|---|---|---|---|---|
| **app** | The guest mobile app — iOS and Android from one React Native + Expo codebase, **padel booking only**, no cafe section (§02 p6) | **20** | Auth 15 · Reservation 45 · Notifications 15 · Design & launch 25 | §03, §04, §10 (mobile), §14 p20–21, §15 track B |
| **desktop** | The operator desktop app — Windows wrapper installed on the till and desk machines; reception, cashier, kitchen, manager and owner workspaces; customers & promotions; stock; degraded mode (§02 p6, §11 p15) | **47** | Reservation desk 20 · Cafe & till 32 · Stock management 20 · Shell, design & launch 28 | §03, §04 (desk), §05, §06 (editor), §07, §08, §10, §11, §13, §15 tracks A & D |
| **web** | The public website — Next.js on Vercel on Touch's domain, carrying the whole cafe guest experience: menu, QR table binding, ordering, waiter call, venue pages (§09 p13) | **17** | Menu & table QR 35 · Ordering 25 · Call waiter 10 · Design & launch 30 | §06, §09, §10 (web), §15 track C |
| **management panel** | Module 10 — the advanced reporting panel: revenue, courts, cafe, stock and staff-activity reports with comparison, drill-through and CSV export throughout (§12 p16–17) | **16** | Business reports 45 · Staff activity 15 · Controls & CSV export 20 · Design & launch 20 | §12, §11 (owner/manager rows, report content only), §15 track A wk3 + track D wk4 |

**How the numbers combine.** A level's percentage is hand-set by the producer (0–100). A column's bar is the weighted average of its levels (0078 rollup — a column reaches 100 only when every level is 100, which is the "upon completion all rows are filled" rule). The overall figure is the weighted average of the four columns.

**On the column weights** (sum 100 — `milestoneProgress` divides by `max(allocated, 100)`, and the plan editor warns otherwise). They are a judgement about *size*, from the scope's own statements: desktop is the largest track by a distance — the till, five workspaces, stock ("the largest module", §15 p24) — and after folding it also carries most of the platform track (schema, RLS, audit, tax, day-close model, promotions engine, heartbeat, backups, monitoring — §15 p22 track A), all of training, documentation and the handover (§15 p23), so 47. The app and the website are one surface each, both largely rendering data the platform owns (0077's reasoning), the app slightly larger for the reservation model, the concurrency suite and the store submission it now carries: 20 and 17. The management panel is reports only — one build week (track D week 4) plus the reporting layer (track A week 3): 16. Starting point was 0077's track weights (platform 32 · app 16 · web 16 · desktop 26 · review 10), re-homed by the allocation in §6.

Worked example with the sketch's numbers (app 20 %, desktop 10 %, web 40 %, panel 10 %): overall = (20·20 + 47·10 + 17·40 + 16·10) / 100 = **17.1 %** → shown as 17 %.

---

## 2 · Column: app (20)

> **Column drawer.** The app a guest keeps on their phone to book a court. One codebase builds
> both the iPhone and Android apps through Expo EAS, published under Touch's own developer
> accounts. Padel only: the cafe deliberately lives on the website, because a guest at a table
> will not install an app to order a coffee, and the app is reserved for padel, where a guest
> has reason to return and hold an account (§02 p6). Payment is never taken in the app —
> guests reserve, then pay at the desk (§04 p8, §19 p28).

### 2.1 Auth — *Guest sign-in and account* · 15 % of the column

**Drawer.** How a guest gets into the app and who the app thinks they are. A guest creates an account with email and password, confirms the email, and can reset a forgotten password. Their profile holds their name, phone number and preferred language — and they can change language — and their confirmed bookings appear in their own account. Email rather than phone codes because SMS codes cost money per message and need a regional provider; the phone number is captured from day one so phone sign-in can be added later without a migration (§03 p7).

**Included**
- Guest sign-up and sign-in by email and password, with email verification and password reset (§03 p7)
- Guest profile: name, phone number, preferred language (§03 p7); the guest's language switch (§03 p7 acceptance — "change language")
- Session handling on mobile — one third of "session handling across mobile, desktop and web" (§03 p7)
- The reservation visible in the guest's account (§04 p8) — *the account half of the bullet "Booking confirmation, with the reservation visible in the guest's account"; the confirmation itself is 2.2*
- The email-auth model itself (track A week 1, "email auth") — counted here, once, because guest self-service accounts exist for the app (§15 p22)

**Done when** a guest can register, verify, sign in and change language in the app with the layout correctly mirrored (§03 p7 acceptance).

**Waits on Touch:** Supabase account funded in Touch's name — week 1 (§14 p20).
**Build week:** 1 ("App shell, EAS pipeline, authentication screens", track B — the shell and pipeline are counted in 2.4).

### 2.2 Reservation — *Courts, availability, holds and booking* · 45 % of the column

**Drawer.** The reason the app exists. A guest sees every court — name, indoor or outdoor, description, photo — and a day view of which slots are free and what each one costs, with the price for that exact slot. Picking a slot holds it exclusively for a short time while the guest finishes; walk away and it goes back on the grid automatically. A confirmed booking appears on the desk calendar immediately. Underneath, the database refuses to store two overlapping reservations, so the same court-time can never be sold twice — proven with automated tests that fire simultaneous requests at one slot and check that exactly one wins (§04 p8). While the venue is offline, bookings for today and tomorrow are blocked with a clear message and the venue's phone number; bookings further ahead continue as normal (§10 p14).

**Included**
- Day view of live availability per court, with the price for that specific slot (§04 p8)
- Court records: name, indoor or outdoor, description, photograph (§04 p8) — *listed by the scope under "Guest booking, mobile app"; the app displays them. Where they are entered is not written (§14 p19 makes the court list a Touch input) — this file assumes the desktop, see 3.1 and §14 Q9*
- Duration options configured per court (§04 p8) — *same note*
- A short exclusive hold on the slot while the guest completes booking, expiring automatically and returning the slot to the grid (§04 p8)
- Booking confirmation (§04 p8); the booking appears immediately on the desk calendar (§04 p8 acceptance)
- Released courts pushed back onto the booking grid live, without polling (§02 p6) — *consumes the realtime channels counted in desktop → Cafe & till; the app's grid refresh is what is counted here*
- **Double-booking prevention** — all court time (guest bookings, desk bookings, holds, maintenance blocks) in a single reservation table protected by a database exclusion constraint on court and time range (§04 p8); the reservation model and its **concurrency test suite** (track A week 2, §15 p22; acceptance condition §16 p25). *Counted once, here — it protects the desk calendar equally.*
- Degraded mode, app side: browsing and existing bookings stay visible; new bookings inside the protected horizon are blocked, with a clear message and the venue's phone number (§10 p14) — *the app's screens only; the heartbeat, the server-side refusal and the horizon setting are one piece of work counted in desktop → Cafe & till*
- Padel court reservation in the mobile app (§01 p4)

**Done when** a guest books a court from the app and it appears immediately on the desk calendar; the concurrency test suite passes; Touch has taken real bookings on the system (§04 p8, §16 p25); with the network disconnected the app refuses near-term writes (§10 p14 acceptance).

**Waits on Touch:** Court list, hours, rates, cancellation policy — week 1 (§14 p19: "Module 2 cannot be configured or tested"). Photography — week 1 branding assets (§14 p19).
**Build weeks:** 2 ("Court browsing, live availability grid, slot holds") and 3 ("Booking end to end"). Priority **01** — "the phase has no value without these and they are not negotiable. They are also on the critical path for the store submission, which cannot slip without spending the review buffer" (§15 p24).

### 2.3 Notifications — *Push notifications and cancellation* · 15 % of the column

**Drawer.** After booking, the guest's phone receives a push message confirming it, a reminder before it, and a message if it is cancelled (Expo Push, §02 p6). The guest can cancel their own booking from the app inside the cancellation window Touch configures (§04 p8). Notification text exists in both English and Arabic (§03 p7).

**Included**
- Push notifications for confirmation, reminder and cancellation (§04 p8; Expo Push §02 p6)
- Guest-initiated cancellation, subject to the configured policy (§04 p8)
- Notifications rendered from bilingual records (§03 p7) — *edited in desktop; rendered here*

**Done when** the confirmation, reminder and cancellation pushes arrive on a guest's phone for a real booking, and a guest cancellation succeeds inside the configured window and is refused outside it. The scope writes no separate acceptance test for push delivery (module 2's test covers booking) — this is the producer's check, recorded so it is not assumed.

**Waits on Touch:** cancellation policy — week 1 (§14 p19).
**Build week:** 3 ("push notifications, cancellation policy", track B).

### 2.4 Design & launch — *Bilingual design, polish and the stores* · 25 % of the column

**Drawer.** The app in both languages, in Touch's own look, and on both stores. Arabic is a true right-to-left layout, not a translated English one: numbers, dates, times and prices formatted the way each language expects, English fragments inside Arabic text reading correctly, and a fallback to the other language where a translation is missing (§03 p7). Week 4 is polish and store listing assets, then submission to Apple and Google under Touch's own accounts — Touch owns the listings from day one; ownership never passes through Kagu and no transfer is ever needed (§14 p21). The stores review on their own timetable, a rejection resets the clock, and weeks 5 and 6 are held for exactly that. **The app counts as accepted when a working build is submitted, not when the stores approve it** (§14 p21, §16 p25).

**Included**
- English and Arabic in the app; full RTL layout using logical properties; bidirectional text handling; numeral, date, time and currency formatting per locale; fallback language — the app's share of §03 p7
- Product design and interface for the app, in both languages and both directions — the app's share of §18 p27
- Touch branding from the week-1 assets; otherwise "interfaces ship in placeholder styling" (§14 p19)
- App shell, RTL foundation and the Expo EAS build pipeline (track B week 1, §15 p22); the app's share of "deployment pipeline for all three clients" (§03 p7)
- Over-the-air updates for copy and non-native fixes (§02 p6)
- Polish and store listing assets (track B week 4, §15 p22)
- **Store submission** to both stores under Touch's developer accounts (§01 p5, §18 p27); the listings in Touch's accounts from the outset, Kagu added as a developer, ownership never passing through Kagu (§14 p21, §17 p26)
- Fallback if Touch's accounts are not usable by end of week 3: Kagu submits under its own accounts and transfers afterwards at no charge, with Touch's written agreement (§14 p21)
- Review window: store review, one rejection and resubmission absorbed inside weeks 5–6, a rejection resetting the clock (§14 p21, §15 p23); defect fixing against the module 2 acceptance test — the app's side (§15 p23)
- Reaches 100 only when the **five-day production run** is complete (§16 p25 — see §11 below)

**Done when** a working build is submitted to both stores (§16 p25) and the production run has finished.

**Waits on Touch:** Apple Developer and Google Play accounts in Touch's name with Kagu added — **at start**, Touch beginning on day one; Apple organisation enrolment needs a D&B number and legal verification and can take 2–3 weeks (§14 p20–21). Branding assets — week 1; English and Arabic copy — week 2 (§14 p19–20).
**Build weeks:** 1 (shell, EAS, RTL) and 4 (polish, submission); weeks 5–6 store review.

### Not in the app column

Not included by the scope: phone/SMS one-time-code login; social or Apple/Google sign-in; household or family account linking; customer-facing profile history beyond their own bookings and orders; any third language (§03 p7). Payment at the time of booking; open matches, seat claiming and cost splitting; player levels and matchmaking; tournaments, leagues and fixtures; coaching and lesson booking; memberships, subscriptions and member rates; waiting lists; guest-created recurring series (§04 p8). Any cafe functionality in the app (§06 p10, §19 p28). Offline use of the app (§10 p14). RevenueCat or any payment SDK (§02 p6).

Lives elsewhere: rates, opening hours and the cancellation policy are configured in **desktop → Reservation desk**; the app only displays their result. Uptime monitoring on the booking path is platform work counted in **desktop → Shell**.

---

## 3 · Column: desktop (47)

> **Column drawer.** The application the venue is actually run from. One Windows build,
> installed on the till and desk machines so it opens on boot and cannot be closed like a
> browser tab, in which each role signs into its own workspace: reception, cashier, kitchen,
> manager, owner (§02 p6, §11 p15). The court calendar, the till, the kitchen screen, customer
> records and promotions, the stock system, and the mode that keeps the till trading when the
> internet drops all live here. The largest of the four systems by a distance.

### 3.1 Reservation desk — *Court calendar, bookings, rules and customers* · 20 % of the column

**Drawer.** The reception screen. A day and week calendar across every court where staff see today's bookings and live availability, take walk-ins with or without a guest account, move, shorten, extend or cancel a reservation, block court time for maintenance or a private event, and mark a guest arrived, completed or no-show (§04 p8). Whole recurring series — every Tuesday 20:00–22:00 for a stated number of weeks or until an end date — are created in one action, with clashes shown *before* the series is saved so staff can skip those dates or move them to another court (§04 p8). The venue's own rules live here: opening hours and closed days, peak and off-peak rates by weekday, time window and court, the cancellation window. One search box finds any customer by partial phone, name or email, in Arabic or Latin spelling, and their record shows bookings, no-shows, cafe orders, recurring series, and staff-only notes and flags the customer never sees (§05 p9).

**Included — desk and calendar (§04 p8)**
- Day and week calendar across all courts
- Create a booking for a walk-in, with or without a linked guest account
- Move, shorten, extend and cancel a reservation
- Block court time for maintenance or a private event
- Mark a booking as arrived, completed or no-show
- Every override written to the audit log with actor and reason — *the desk's writes; the log itself is counted in 3.4*
- Padel court reservation at the desk (§01 p4)

**Included — recurring & block bookings (§04 p8, §01 p4)**
- Staff create a whole series in one action — every Tuesday 20:00–22:00 for a stated number of weeks or until an end date
- Weekly, fortnightly, or a chosen set of weekdays
- Clashes anywhere in the series shown before it is created, with the choice to skip those dates or place them on another court
- Edit or cancel one occurrence or the whole series, leaving occurrences already played untouched
- No limit on how far ahead a series may run
- Each occurrence is an ordinary reservation — holds the slot, appears on the calendar, reports like any other booking
- Staff-created only (§04 p8)

**Included — rules & pricing (§04 p8; the Manager role holds "rates", §02 p6)**
- Rate rules by weekday, time window and court, with peak and off-peak
- Each booking stores the rule that produced its price, so a historical figure can always be explained — *the stored record; the panel's drill-through reads it*
- Configurable cancellation window and no-show handling
- Opening hours and closed days
- *Assumption:* court records (name, indoor/outdoor, description, photograph) and duration options per court are entered here — the scope lists them under the app's guest booking (§04 p8) and does not say where they are configured; the court list is a Touch input (§14 p19). See §14 Q9.

**Included — customers (§05 p9, §01 p4)**
- One search box at the desk matching on phone number, name or email, including partial entries; results as you type, tolerant of spacing and of Arabic or Latin spellings
- Attach a found customer to a booking or an open tab in one action; create a record at the desk for a walk-in who has no account
- Customer record: contact details and preferred language (editable, changes audited); booking history past and upcoming with court, date and status; cancellations and no-shows with running counts; cafe orders placed against that customer; recurring series the customer holds
- Internal notes on a customer and on an individual booking, kept separate; staff-visible only — never in the app, on the website or on any printed bill; short flags that surface wherever the customer appears (VIP, birthday, payment note, special request); each note stamped with author and time, edits recorded

**Included — the workspace (§11 p15)**
- Reception / court desk lands on **Today's board**: today's bookings and live court availability, arrivals and status, customer search, create/edit/cancel bookings including recurring series, booking notes, payment status at a glance

**Done when** staff create, move and cancel bookings; a guest's app booking appears immediately on the calendar (§04 p8); a customer is found by partial phone number and attached to a booking, and history and notes display correctly and appear nowhere guest-facing (§05 p9); a court-desk member reaches this workspace without navigating, in either language, and completes the role's daily tasks unaided after training (§11 p15).

**Waits on Touch:** Court list, hours, rates, cancellation policy — week 1 (§14 p19).
**Build week:** 2 (track D: "Reception … workspace, desk calendar with create, move, cancel and recurring series, customer search, notes"). Priority **01** (§15 p24).

### 3.2 Cafe & till — *Cashier, kitchen, promotions, menu editor, day close, degraded mode* · 32 % of the column

**Drawer.** Everything that makes the cafe trade. The cashier's till: a fast item grid, open tabs by table, court or name, merging tables and splitting bills, and charging a cafe order onto a court booking so a group pays for courts and drinks once. Payment is recorded as cash or card (the card terminal stays a separate machine), discounts and price overrides need an authorised PIN and a reason, and a printed or on-screen bill shows tax per item group (§07 p11). The kitchen works from a wall screen, not paper: tickets from the till and from phones at tables arrive in one list with their age, change colour past target time, and marking items ready tells the floor and updates the guest's page (§07 p11). Promotions are rules set up once — percentage or fixed, limited by day, hour, court or item, with expiry and usage limits — and the system applies the single best one automatically; overrides stay behind a PIN for genuine exceptions (§05 p9). The menu is written here once, in English and Arabic side by side, and is live on the website within seconds (§06 p10). At the end of the day the float and counted cash are compared with what the system expected, the card total is reconciled against the terminal batch, and every discount, void, refund and waste entry is listed with its authoriser (§07 p11). And when the internet drops, the till keeps trading from cached data and a local queue that replays exactly once on reconnect (§10 p14).

**Included — cashier (§07 p11, §01 p4, §11 p15)**
- Category and item grid built for speed, keyboard-first with touch supported
- Open tabs by table, by court or by name; add items with modifiers and sizes; edit a tab before sending
- Merge tables; split a bill by item or evenly
- Charge a cafe order to a court booking so a group settles courts and drinks in one payment
- Payment recorded at the desk — cash and card, with the card terminal operating independently of this system
- Change calculation and a cash drawer opening record
- Discounts and price overrides behind an authorised PIN with a reason code
- Voids after a ticket has been sent recorded as waste, not deleted; refunds by a manager role, reversing the stock movement
- Configurable tax rate per item group, applied and shown on the bill; set to zero, ten per cent, or different rates by category — a configuration Touch controls; no fiscal device, no e-invoicing (§13 p18)
- One trading currency configured at setup, in which all prices, bills, stock costs and reports are expressed (§13 p18)
- Printed or on-screen bill for the guest; thermal receipt printer supported, Arabic bills composed and sent as a rendered image because low-cost thermal printers cannot shape Arabic from their built-in character sets; Kagu issues the printer specification, Touch supplies the printer (§07 p11)
- Cafe orders arriving from the website onto the same till (§11 p15)
- Cashier workspace lands on **The till**: item grid and keypad, open tabs by table and by court, cafe orders arriving from the website, court and cafe bills, payment, promotions and discounts, refunds, cash drawer and shift functions (§11 p15)
- *Assumption:* the staff floor view of waiter calls — acknowledge and resolve, each stamped with who acted and when (§06 p10). The scope says only that "the waiter call reaches the floor view" and does not name the screen; this file places it with the cashier ("till, orders, table service", §02 p6). See §14 Q10.
- One till station in this phase (§07 p11, §01 p4)

**Included — kitchen display (§07 p11, §11 p15, §01 p4)**
- Live ticket list with age, items, modifiers, and table or court number
- Colour change as a ticket passes its target time
- Mark item ready and ticket complete, notifying the floor and the guest
- Actual preparation time stored per ticket
- "Tickets from the guest app and the till appear in one list, in arrival order, tagged with where they came from" — *scope wording; read as tickets from the website, since the app has no cafe section (§02 p6, §06 p10) — §14 Q5*
- New tickets pushed to the screen via Supabase Realtime without polling — the realtime channels of track A week 2 are counted once, here (§02 p6, §15 p22)
- Kitchen / prep workspace lands on **The pass**: active orders with waiting times, items in preparation, ready and completed orders, mark-ready controls; full screen, high contrast, readable across a kitchen and with no navigation to get lost in (§11 p15)
- One preparation station in this phase (§07 p11)

**Included — promotions (§05 p9, §01 p4; the engine is track A week 3)**
- Percentage or fixed amount; start and end dates with automatic expiry
- Restricted to chosen weekdays and hour windows; to specific courts, or to cafe items and categories
- Usage limits — total redemptions, per customer, and minimum spend
- Applied automatically when conditions are met, or selected by staff
- Public codes a customer can enter, shared or single-use, each with its own limits and expiry
- Enabled and disabled without deleting, keeping history intact
- Every application stored against the booking or order together with the promotion that produced it, so a historical price can always be explained — *the stored record; the panel's drill-through reads it*
- Where two promotions could apply to the same bill, the single best one applies — no stacking

**Included — menu & content editor (§06 p10, §03 p7, §09 p13; track D week 2)**
- Categories and items with photograph, description, price and availability; sizes and variants each with its own price; modifiers and options with price differences; allergen and dietary flags; add-on suggestions attached to an item
- Item marked unavailable by staff, restoring automatically the next day
- All content bilingual, edited once in the desktop app and live everywhere; menu items, court names, categories and notifications edited side by side in both languages (§03 p7) — *the editor; the one-record content model is counted in 3.4*
- Menu and recipe schema (track A week 2) — the menu half is counted here, the recipe half under 3.3

**Included — shift & day close (§07 p11, §13 p18, §10 p14; the day-close model is track A week 3)**
- Opening float, cash counted at close, expected against counted with the variance stated
- Card total for reconciliation against the terminal batch
- Summary of discounts, voids, refunds and waste with the authoriser named
- Tax reported at day close (§13 p18)
- Day cannot be closed while a tab is still open on the floor, nor while unsynced degraded-mode items remain (§10 p14)

**Included — degraded mode (§10 p14, §13 p18, §01 p4; heartbeat & lockout are track A week 3, cache & queue track D week 4)**
- The desktop app sends a heartbeat to the server on a short interval; when it stops the venue is marked degraded and **guest writes are refused server-side, not hidden in the interface** — the one lockout that the app's and the website's blocked screens render; normal operation resumes on the first successful heartbeat; every degraded period logged with start, end and duration
- The protected horizon — the lockout covers only what the desk could plausibly sell offline, today and tomorrow, configurable; bookings beyond it continue normally
- Single writer: during an outage only the desk writes — a cafe order is an append-only fact that is safe to replay, a court booking is not
- The desktop keeps trading from cached reference data — menu, prices, recipes, courts, tables and today's reservations; writes go to a durable local queue; the kitchen display continues from that same queue, so food still reaches the pass
- Every write flushed to disk before the screen confirms it, so a power cut cannot lose a confirmed ticket
- Device-prefixed identifiers and an idempotency key per write, so two stations cannot collide and a replay cannot double-charge
- Replayed in order on reconnect with server-assigned timestamps; stock settles server-side; anything driven negative is raised to the manager
- A banner states the mode and the queued count
- The honest limit: a booking made in the seconds between the desk losing its connection and the server noticing can still collide with one taken offline; the database constraint catches it on replay and shows the desk a conflict rather than an overwrite; a short heartbeat keeps that window to seconds — not to zero (§10 p14)
- The disconnection drill in the review weeks (§15 p23)

**Done when** a full trading day is completed on the system and the day close reconciles cash and card against the terminal batch, with every discount, void and refund traceable to a named actor (§07 p11); a promotion limited by day, hour and court applies automatically inside its window, refuses outside it, and expires unaided (§05 p9); a website order reaches the kitchen screen and the tab settles correctly at the till (§06 p10); with the network disconnected the till keeps taking orders and the kitchen screen keeps receiving them, app and website refuse near-term writes, and on reconnect every queued item appears exactly once with stock and totals reconciling (§10 p14); cashier and prep members reach their workspaces without navigating and complete their daily tasks (§11 p15).

**Waits on Touch:** Trading currency — confirmed before build starts (§13 p18) — and the tax decision — week 1 (§14 p19); full menu with prices, sizes and modifiers — week 1 (§14 p19); hardware in place — till, kitchen screen, printer, network — week 3 (§14 p20); a business internet connection wired to the till and a UPS on the till, printer, router and switch — Touch's responsibility (§13 p18).
**Build weeks:** 2 (cashier workspace, menu editor), 3 (cashier, tabs, splits, promotions, charge-to-booking, kitchen, day close), 4 (local cache and write queue). Priorities **02** cashier & kitchen, **05** degraded mode (the lockout is cheap and ships regardless; the cache & queue is the larger half and can follow in the review weeks), **07** promotions (public codes last, since manual discounts behind a PIN cover the gap) (§15 p24).

### 3.3 Stock management — *Ingredients, recipes, expiry, counts, variance* · 20 % of the column

**Drawer.** Stock falls as orders are made, not at month end. Every menu item has a measured recipe, so confirming an order deducts its ingredients automatically — oat milk deducts oat milk, a double shot deducts twice the coffee. Ingredients carry pack size, cost, supplier and shelf life; deliveries are received with an expiry date per batch and used oldest-first; staff record waste with a reason and run physical counts. The variance report compares what the recipes say should be left with what was counted, with every movement one click away; cost of goods and margin per item move with supplier cost; low-stock alerts fire, and a menu item greys out on the website when an ingredient runs out (§08 p12). Stock accuracy is capped by recipe accuracy — if quantities are estimated rather than measured, the variance report will show noise and staff will stop trusting it within a month. **Touch supplies measured recipes against Kagu's template by week 2 — the single largest client-side input in the phase and the most common cause of delay** (§08 p12, §14 p20).

**Included — ingredients & recipes (§08 p12)**
- Ingredient records with unit, pack size, cost and supplier
- A bill of materials per product — quantities per ingredient; usable yield percentage; waste allowance per unit, held separately from recorded waste
- Sub-recipes: a syrup or sauce batch produced once and consumed by many products
- Modifier-aware consumption; per-size quantities, not a multiplier
- The recipe schema (track A week 2) and the recipe template Kagu issues in week 1 (§08 p12)

**Included — stock ledger (§08 p12)**
- Stock held as an append-only ledger of movements, never an editable number
- Goods received against a delivery, with short-delivery capture and an expiry date per received batch
- Automatic deduction from the recipe when an order is confirmed
- Waste recorded by staff with a reason: spill, spoilage, void after send
- Adjustment only as the result of a physical count

**Included — expiry & shelf life (§08 p12)**
- Shelf life per ingredient; expiry captured or calculated at goods-in
- Stock tracked by batch, several expiry dates per ingredient at once; consumption deducts first-expiring-first
- Expiring-soon list with a configurable window, and an expired list — *the calculation and the operational screen; the panel's period report is 5.1*
- Expired stock written off with its own reason code, separated from spillage and spoilage in the variance report

**Included — counts, variance & cost (§08 p12)**
- Physical count entry per ingredient
- Variance — theoretical against counted, by ingredient and period, with the movements behind it one click away — *the calculation and the count screen; the panel's report view is 5.1*
- Cost of goods and gross margin per menu item, moving with supplier cost — *the calculation; reported in 5.1*
- Low-stock and par-level alerts; the out-of-stock trigger that greys a menu item out (the website renders it)
- One location in this phase (§08 p12); recipe-level stock with consumption, expiry tracking, counts and variance (§01 p4)

*Split rule for the whole level:* entry, calculation and the operational screens are here; the management panel (5.1) owns the **report views** of the same figures — by period, with comparison and CSV. Neither claims the other's half.

**Done when** a physical count is run against a period of trading and the variance report reconciles to Touch's satisfaction, with every movement traceable to the order, delivery or waste entry that caused it (§08 p12, §16 p25).

**Waits on Touch:** Measured recipes per product — week 2 ("Module 6 cannot be delivered — the single largest risk in this phase"); ingredients with pack size, cost, supplier, shelf life — week 2 (§14 p20).
**Build week:** 4 (track D). Priority **08** — "the largest module, last in the build and first to move; it will move if measured recipes have not arrived by the end of week 2"; **09** — if stock must be reduced rather than deferred, batch expiry gives way first and recipe-level consumption stays intact (§15 p24).

### 3.4 Shell, design & launch — *The Windows app, sign-in, workspaces, staff admin, platform, training and go-live* · 28 % of the column

**Drawer.** The program itself and everything that makes it the venue's system. A Windows installer (Electron or Tauri, confirmed in week 1 against thermal-printer support — the application inside is identical either way) that opens on boot and cannot be closed as a browser tab; staff sign-in with short-lived sessions on shared machines and a PIN for sensitive actions; five landing screens, one per role, each in English and Arabic with full right-to-left — one codebase, one deployment, one place to change a permission; the owner's administration of staff accounts, roles and permissions, enforced in the database rather than hidden in the interface; and an append-only audit log of who did what, before and after, with a reason code on discounts, voids, price overrides, stock adjustments and reservation overrides (§02 p6, §03 p7, §11 p15). Underneath it, the shared foundation every system stands on — the Supabase project, schema, environments, backups and monitoring (§03 p7, §15 track A). It finishes with the launch: installation on the till and desk machines, staff training per role recorded in both languages, the runbook and staff guide, five consecutive operating days in production, and the handover of every repository and account into Touch's name (§15 p23, §16 p25, §17 p26).

**Included — the shell (§02 p6, §01 p5)**
- Electron or Tauri wrapper, Windows only, around the same web application; installed on the till and desk machines so it opens on boot and cannot be closed as a browser tab; wrapper confirmed in week 1 against thermal-printer support, the application inside identical either way
- Windows installer deliverable; the desktop's share of "deployment pipeline for all three clients" (§03 p7)
- One application, role-based views: each role signs into its own workspace, not a shared screen with buttons hidden by permission; one codebase, one deployment, one place to change a permission, five purpose-built landing screens

**Included — staff sign-in, roles and audit (§03 p7, §02 p6, §11 p15)**
- Short-lived sessions on shared till machines, with a PIN for sensitive actions; one third of "session handling across mobile, desktop and web"
- The five roles — Cashier (till, orders, table service), Prep (kitchen display only), Court desk (reservation calendar, walk-in bookings), Manager (all of the above plus stock, menu, rates, day close and discounts), Owner (all of the above plus staff and role administration)
- Permissions enforced by row-level security in the database, independently of the workspace
- **Staff accounts created and managed by the owner role**; role assigned per staff account; a person may hold more than one and switch between workspaces — the sketch's "employee manager"
- An append-only audit log recording actor, action, before and after values, and a reason code on discounts, voids, price overrides, stock adjustments and reservation overrides (track A week 3) — *the log; its writers are 3.1/3.2, its filtered view is 5.2*

**Included — the workspaces (§11 p15; reception, cashier and kitchen content is counted in 3.1 and 3.2)**
- Five distinct landing screens with their own navigation and layout; kitchen laid out for a wall-mounted screen, till for keyboard speed; permissions decide what a person may do, a workspace decides what they see first
- Manager lands on **Operations overview**: bookings and cafe operations, stock and counts, staff activity, discounts, voids and refunds, day close, reports and operational controls — the shell and navigation are here; the report *content* is the management panel column
- Owner lands on the **management panel** workspace: everything above plus the advanced management panel, financial overview, exports, users, permissions and system settings — likewise shell here, reports in the panel column
- Manager and owner workspaces may be simpler at first and refined during the review weeks — priority **04** (§15 p24)

**Included — design & bilingual (§03 p7, §11 p15, §18 p27, §14 p19)**
- Each workspace bilingual with full right-to-left; logical properties not a mirrored stylesheet; bidirectional text; numeral, date, time and currency formatting per locale; fallback language — the desktop's share of §03 p7 (management-panel screens excluded; counted in 5.4)
- The bilingual content model — one record holding both languages (track A week 1, §03 p7)
- Product design and interface for the desktop, both languages and both directions — the desktop's share of §18 p27; Touch branding from week-1 assets

**Included — platform foundation, counted once here (§03 p7, §01 p5, §15 p22 track A)**
- Supabase project, schema, migrations and generated types; TypeScript throughout with database types generated from the schema (§02 p6)
- Staging and production environments (week 1)
- Uptime monitoring on the booking and ordering paths, and error tracking on the booking path (week 4; §03 p7) — *the website's ordering-path error tracking is the §09 p13 delivery item, counted in 4.4*
- Automated daily backups with point-in-time recovery on Touch's own project (week 4; the restore *test* is 5.4 — a decision of this file, see §6)
- Load test at twice peak (week 4)
- Backend owned and administered by Touch (§01 p5)

**Included — training, documentation and go-live (§15 p23, §16 p25, §17 p26, §01 p5, §18 p27)**
- Installation on the till and desk machines; hardware in place by week 3 (§14 p20)
- Staff training per role, remote, recorded in both languages — all five roles, including the owner's panel training, counted once here; includes the point the scope calls the single most important thing for staff to understand: ordering is not paying (§06 p10)
- Runbook, staff guide and technical handover documentation, English and Arabic; written so another team could take over without contacting Kagu — schema and migration history, generated types, environment and deployment instructions, documented local setup, seed and configuration data, architecture note (§01 p5, §17 p26) — *the website's deployment instructions are the one part counted in 4.4*
- Defect fixing against the acceptance tests of the desktop's own modules — 1, 2 (desk side), 3, 5, 6, 8, 9 (§15 p23)
- **Five consecutive operating days** in production with no unresolved major issue (§16 p25)
- Repository and account handover — full source code for all three clients in Touch's repositories, the database and migration history, Touch holding administrative ownership of every repository and account — then sign-off with Mustafa (§15 p23, §16 p25, §17 p26) — *the per-client ownership facts (store listings, domain, backup access) are noted in the other columns' launch levels as their proof, not re-counted*

**Done when** each of the five roles sees only what its permission set allows, confirmed by a written role test (§03 p7); a member of each role signs in and reaches a workspace containing the items listed without navigating, in either language, and can complete that role's daily tasks unaided after training (§11 p15); the production run is complete and Touch holds administrative ownership of every repository and account (§16 p25).

**Waits on Touch:** Branding assets — week 1; staff list with intended roles — week 3 ("accounts cannot be created for training"); hardware — week 3; staff available for training — week 5 (§14 p19–20); a named approver available weekly, throughout (§14 p19).
**Build weeks:** 1 (wrapper, shell, role routing, staff sign-in; track A foundations), 4 (manager and owner workspaces; backups, monitoring, load test), 5–6 (training, docs, production run, handover).

### Not in the desktop column

Not included by the scope: integration with a card terminal (operated separately, total entered at close); integrated or automated cash drawer hardware control; printed kitchen tickets; a second till or second preparation station; staff performance reporting; accounting system integration; fiscal or government-registered receipt devices (§07 p11, §13 p18). Purchase orders and supplier ordering workflow; supplier price history and cost drift; suggested order quantities; transfers between locations; retail or pro-shop stock; automated reordering; supplier lot numbers and recall tracing (§08 p12). Full offline operation from a local on-premises database; automatic conflict merging (§10 p14). Per-user customisation or draggable dashboard layouts; additional roles beyond the five — a change request, though the model supports them; separate installers per role; staff productivity scoring or league tables (§11 p15). Staff shift scheduling or time clock (§03 p7). Dual currency at the till — a second display currency, a fixed or editable daily rate, change given in the other currency, both totals reconciled at day close — quoted as an addition (§13 p18). Marketing email or SMS campaigns; notes visible to the customer; promotion stacking (§05 p9). Hardware and the UPS are Touch's (§18 p27).

---

## 4 · Column: web (17)

> **Column drawer.** The public website on Touch's own domain — and the whole cafe guest
> experience. A guest scans the table's code with the phone's own camera and the menu opens
> already tied to that table, with nothing to install and no account to create; they order,
> watch it progress, and call a waiter. Someone who searched for the venue last night sees the
> same site with the menu and the venue details (§02 p6, §09 p13). Ordering is not paying: the
> bill is settled at the desk before the guest leaves (§06 p10).

### 4.1 Menu & table QR — *The site, the menu, and the table code* · 35 % of the column

**Drawer.** The site itself and what a guest sees first. Built on Next.js, server-rendered from the same records the till edits, so a price or availability change made at the desk is live on the site within seconds with no second copy to keep in step (§09 p13) — which is also why this level can only be proven once the desktop menu editor exists. The menu shows categories and items with photo, description, price and availability, sizes and variants, options like milk type or an extra shot with their price differences, allergen and dietary flags, and suggested add-ons; an item staff mark unavailable comes back tomorrow, and items grey out on their own when an ingredient runs out (§06 p10). Each table gets a printed QR code in Touch's branding carrying a signed token rather than a table number, so nobody can fake a table by editing a web address; a photographed code can be retired, and the binding expires after a period of inactivity (§06 p10).

**Included — platform (§09 p13, §15 track C week 1)**
- Next.js application on Vercel; server-rendered, reading the same Supabase records as the desktop app
- Locale routing; mobile-first throughout; performance budget suited to a venue connection, with images optimised and served at device size — *the plumbing; the bilingual content and RTL layout are counted in 4.4*
- The Next.js shell and deploy pipeline — the website's share of "deployment pipeline for all three clients" (§03 p7; track C week 1) — *domain, TLS and go-live are 4.4*

**Included — menu (§06 p10, §09 p13; rendered here, edited in desktop → Cafe & till)**
- Categories and items with photograph, description, price and availability; sizes and variants each with its own price; modifiers and options with price differences; allergen and dietary flags; add-on suggestions as an item is added to the basket
- Unavailable items restoring automatically the next day; items greyed out when a required ingredient is out of stock — rendered from the desktop and stock triggers
- All content bilingual, live everywhere from one edit
- Menu stays readable during an outage (§10 p14)

**Included — table binding (§06 p10, §03 p7)**
- Printed QR code per table, scanned with the phone's native camera — no app, no scanner, no install
- The code carries a signed table token, not a plain table number, so the binding cannot be forged by editing a web address
- The page opens already bound to that table, in the guest's device language
- Tokens rotatable per table, so a photographed code can be retired; binding expires after a configured period of inactivity
- Print-ready QR artwork supplied for every table, in Touch's branding
- Anonymous table sessions on the cafe site — one third of "session handling across mobile, desktop and web"

**Done when** the site matches the desktop app exactly and reflects an availability change made at the till without a redeploy (§09 p13); a guest with no app and no account scans a table code and the page opens bound to that table (§06 p10).

**Waits on Touch:** Full menu with prices, sizes and modifiers — week 1 ("Track C has nothing to render; the website slips"); table numbering and floor layout — week 2 ("QR artwork cannot be issued"); English and Arabic copy — week 2; trading currency for the prices shown (§14 p19–20, §13 p18).
**Build weeks:** 1 (shell, locale routing, deploy pipeline) and 2 (menu from live data, signed table-token binding). Priority **03** — "the website itself carries the menu and must ship" (§15 p24).

### 4.2 Ordering — *Basket, send, and live order status* · 25 % of the column

**Drawer.** Guests build a basket, review it and send it to their table. No sign-up is needed; signing in is optional and simply attaches the order to an existing account. While the page is open the guest watches the order move through sent, being prepared and ready as the kitchen works, pushed live without refreshing — this is why there are no push notifications for cafe orders (§02 p6, §06 p10). At the desk the order is a tab against the table, prepared and served like a counter order and settled before the guest leaves (that tab is the till's work, 3.2); during an outage ordering is blocked and the guest is directed to a member of staff (§10 p14).

**Included (§06 p10, §02 p6, §10 p14, §03 p7)**
- Basket, review and send to the bound table
- Ordering anonymous by default — no sign-up required; signing in optional, attaching the order to an existing account (the website's only guest-account surface, §09 p13)
- Live order status on the page while it is open — sent, being prepared, ready — shown live on the web page instead of push (§02 p6) — *consumes the realtime channels counted in 3.2; the guest page is what is counted here*
- Degraded mode, web side: ordering blocked with a message directing the guest to a member of staff (§10 p14) — *the page only; the lockout is 3.2*

**Done when** a guest with no app and no account orders in either language, the ticket reaches the kitchen screen, the status updates on their page, and the tab settles correctly at the till (§06 p10); order to a table from the website with no app and no account, in English and in Arabic (§16 p25); with the network disconnected the website refuses near-term writes (§10 p14).

**Waits on Touch:** menu — week 1; table layout — week 2 (§14 p19–20).
**Build week:** 3 (track C: "Basket, ordering, … live order status"). Priority **03** — the cafe can trade at the till while this follows (§15 p24).

### 4.3 Call waiter — *One tap for a member of staff* · 10 % of the column

**Drawer.** One tap asks for staff, with a reason — order, bill, water, assistance. Calls are limited per table so they cannot be spammed, and each moves from raised to acknowledged to resolved, stamped with who handled it and when; the call reaches the staff floor view (§06 p10). During an outage the button is blocked and the guest is told to find a member of staff (§10 p14).

**Included (§06 p10, §10 p14)**
- One-tap waiter call with a reason — order, bill, water, assistance
- Calls rate-limited per table; the guest's view of raised → acknowledged → resolved (the staff actions are 3.2)
- Degraded mode, web side: waiter call blocked, directing the guest to a member of staff — *the page only*

**Done when** the waiter call reaches the floor view (§06 p10).
**Build week:** 3 (track C). Priority **03** (§15 p24).

### 4.4 Design & launch — *Touch's look, bilingual layout, venue pages, install, live on the domain* · 30 % of the column

**Drawer.** The website in Touch's own branding, in both languages with a true right-to-left Arabic layout, and live on Touch's domain. The same site serves the stranger who searched for the venue: address, opening hours, contact details and a map link, page titles and preview images so it looks right in search results and when shared, and a link to the mobile app on both stores for court booking. Regulars can add it to their home screen and come back without scanning. Every change goes to a preview link first, so Touch reviews before anything goes public (§09 p13).

**Included (§09 p13, §03 p7, §06 p10, §18 p27, §14 p19–21, §15 p23)**
- Touch branding applied from the week-1 assets; product design and interface for the website, both languages and both directions — the website's share of §18 p27
- Full bilingual English and Arabic with right-to-left layout across the whole site, ordering included (§06 p10's closing bullet); bidirectional text; numeral, date, time and currency formatting per locale; fallback language — the website's share of §03 p7. *Counted once, here; 4.1–4.3 carry only the plumbing*
- Venue information: address, opening hours, contact and map link
- Search-engine metadata, page titles, descriptions and social preview images
- A link through to the mobile app for padel booking, on both stores (depends on 2.4)
- Installable to the home screen, so a regular can return without scanning
- Preview deployment per change, so Touch can review before anything goes live
- Custom domain, TLS and DNS configuration; **live on Touch's domain** (track C week 4); the domain in Touch's name (§17 p26)
- Error tracking on the ordering path (§09 p13 delivery); hosting, build service and error tracking carried by Kagu (§14 p21)
- Review window: defect fixing against the module 4 and module 7 acceptance tests; the site's deployment instructions as its part of the technical handover (§15 p23)
- Reaches 100 only when the **five-day production run** is complete (§16 p25)

**Done when** the site is live on Touch's domain in both languages and completes an order end to end from a scanned table code (§09 p13); the production run has finished.

**Waits on Touch:** Domain registered with DNS access — week 1 ("the website cannot go live on Touch's domain"); branding assets — week 1; English and Arabic copy — week 2 (§14 p19–20).
**Build weeks:** 1 (RTL foundation, domain and TLS), 4 (venue information, metadata, home-screen install, live on Touch's domain), 5–6.

### Not in the web column

Not included by the scope: any cafe functionality in the mobile app; paying for the order on the web; web push notifications when an order is ready; an account requirement, tipping, or loyalty points on cafe spend; delivery, collection or ordering from outside the venue; scheduled or pre-orders and guest-to-guest bill splitting; behavioural analytics on menu views (§06 p10). Court booking from the website; a wider marketing site — about pages, galleries, blog, contact forms, events listings; guest account management on the web beyond optional sign-in at checkout; a content management system beyond what the desktop app edits; analytics, marketing tags or advertising pixels; copywriting, photography and translation (§09 p13). Offline use of the website (§10 p14).

---

## 5 · Column: management panel (16)

> **Column drawer.** The whole business in one place, every figure traceable to the transactions
> behind it, and everything exportable. Every number is calculated from the real bookings,
> orders, payments and stock movements in the database inside a dedicated reporting layer —
> nothing is estimated and nothing comes from an event-tracking pipeline, which is why the
> panel and the day close can never disagree (§12 p16). The owner's workspace lands on it; the
> manager's operations overview lists "reports" too, though the scope does not say which
> (§11 p15, §14 Q8). It reports; it does not write (§12 p17).

### 5.1 Business reports — *Revenue, courts, cafe and stock* · 45 % of the column

**Drawer.** The four report groups. **Revenue & payment**: revenue by day, week and month, padel and cafe separately and combined, cash against card, discounts, voids and refunds with the authoriser, tax collected by rate. **Courts**: occupancy and utilisation by court and by hour, revenue per court and per available hour, booking volumes and trend, cancellations and no-shows with rates, peak against off-peak. **Cafe**: order count and average order value, best-selling products and categories by volume and revenue, cost of goods, gross profit and margin per item and overall, waste by reason, preparation times by station. **Stock**: stock value on hand, variance theoretical against counted, low-stock and below-par items, expiring-soon and expired items, consumption by ingredient over a period (§12 p16).

**Included — revenue & payment (§12 p16)**
- Revenue by day, week and month; padel and cafe separately, and combined
- Cash against card
- Discounts, voids and refunds, with the authoriser
- Tax collected, by rate
- The owner workspace's "financial overview" (§11 p15) — *named alongside the panel in the owner row and not described further; this file reads it as this report group (§14 Q11)*

**Included — courts (§12 p16)**
- Occupancy and utilisation, by court and by hour; revenue per court, and per available hour
- Booking volumes and trend over time; cancellations and no-shows, with rates; peak against off-peak split

**Included — cafe (§12 p16)**
- Order count and average order value; best-selling products and categories, by volume and by revenue
- Cost of goods, gross profit and margin — per item and overall — *the report view; the calculation is 3.3*
- Waste, by reason; preparation times by station — *from the preparation time stored per ticket in 3.2*

**Included — stock (§12 p16) — *report views only; entry, calculation and operational screens are 3.3***
- Stock value on hand; variance — theoretical against counted
- Low-stock and below-par items; expiring-soon and expired items; consumption by ingredient over a period

**Included — the reporting layer (§12 p16, §15 p22 track A week 3)**
- Every figure calculated from the transactional records — bookings, orders, payments, stock movements — inside a dedicated reporting layer and its queries; nothing estimated, nothing from an event pipeline
- Every headline figure opens down to the individual transactions that produced it — *reads the price-rule and promotion records stored by 3.1 and 3.2*

**Done when** every report in the four groups renders for a chosen period with a working comparison and reconciles exactly to the day-close figures for that period (§12 p17, §16 p25).

**Waits on Touch:** trading currency and tax decision — week 1 ("till and reporting cannot be finalised"); ingredients with costs — week 2 ("margin reporting … unusable"); and, derived, the court list, menu and measured recipes the underlying data needs (§14 p19–20).
**Build weeks:** 3 (reporting layer, track A) and 4 (the panel, track D). Priority **06** — "the revenue, court, cafe and stock reports with CSV export come first" (§15 p24).

### 5.2 Staff activity — *What each member of staff did* · 15 % of the column

**Drawer.** Activity and exceptions per person: orders taken and bookings created, discounts, voids and refunds applied with their reasons, how quickly waiter calls were answered, cash variance at day close attributed to whoever closed, and a view of the audit log filtered to one person or one action type. Shown against shift context, because a quiet Tuesday and a full Saturday are not comparable — explicitly *not* productivity scoring or a league table (§12 p17).

*Mapping note (not scope):* this is the nearest node to the sketch's "sign in times"; the scope has no clock-in/clock-out (§03 p7).

**Included (§12 p17)**
- Orders taken and bookings created, per staff member
- Discounts, voids and refunds applied, with their reasons
- Waiter-call response times (from the raised/acknowledged/resolved stamps, §06 p10)
- Cash variance at day close, attributed to whoever closed
- Audit-log view filtered to one person or one action type — *the read side; the log itself is 3.4*
- Reported as activity and exceptions against shift context, not as scoring

**Done when** the staff-activity views render for a chosen period with a working comparison and export to CSV (§12 p17).

**Waits on Touch:** staff list with intended roles — week 3 (§14 p20).
**Build week:** 4; the staff-activity views are "the part that can be completed during the review weeks" — priority **06** (§15 p24).

### 5.3 Controls & CSV export — *Filters, comparison, drill-through, export* · 20 % of the column

**Drawer.** The controls that work identically on every report: any date and time range including custom ranges; comparison against the previous period or the same period last year, shown as both the change and the percentage; filters by court, category, staff member and payment method; and drill-through from any figure to the individual transactions that produced it (§12 p16). Everything exports as CSV that opens directly in Excel, encoded in UTF-8 so Arabic product and customer names survive the round trip — sales, bookings, customers, stock movements, waste, day-close reports, and any report at its current filter and date range (§12 p17).

**Included — controls (§12 p16)**
- Date and time-range filtering, including custom ranges
- Comparison against the previous period or the same period last year, as both change and percentage — *may be completed during the review weeks, priority 06*
- Filter by court, category, staff member and payment method
- Drill through from any figure to the underlying transactions

**Included — CSV export (§12 p17, §11 p15)**
- CSV, opens directly in Excel, UTF-8 so Arabic survives the round trip
- Sales and transactions; bookings, cancellations and no-shows; customers; stock movements and inventory counts; waste; day-close reports; any report at its current filter and date range
- The owner workspace's "exports" (§11 p15)

**Done when** every report exports to CSV that opens correctly in Excel with Arabic text intact, and comparison works on every report (§12 p17, §16 p25).
**Build week:** 4 ("management panel and CSV export", track D); comparison periods may complete in weeks 5–6 — priority **06** (§15 p24).

### 5.4 Design & launch — *Bilingual panel, reconciliation proof, backup test* · 20 % of the column

**Drawer.** The panel in both languages with a true right-to-left layout and locale-formatted numbers, dates and currency (§11 p15, §03 p7). Its launch is a proof rather than a demo: every report is checked against the till's day-close figures for the same period, and a real backup-and-restore test is performed together during handover, restoring to a separate environment and confirming the data is intact — an acceptance condition, not a claim. Touch holds direct access to the backups as project owner and can download or restore without Kagu (§01 p5, §16 p25, §17 p26).

**Included**
- Each panel screen bilingual with full right-to-left; numeral, date, time and currency formatting per locale — the panel's share of §03 p7 and §11 p15
- Product design and interface for the panel, both languages and both directions — its share of §18 p27
- The reconciliation check of every report against the day-close figures, done with Mustafa (§12 p17 acceptance — the proof; 5.1's Done-when is the behaviour)
- Defect fixing against the module 10 acceptance test (§15 p23)
- A real **backup and restore test** performed together during handover, restoring to a separate environment and confirming the data is intact (§01 p5, §15 p23, §16 p25) — *placed here rather than with the backups in 3.4 by decision of this file: it is the owner's proof, and the panel column otherwise had no launch event*
- Touch's direct access to the backups as project owner, able to download or restore without Kagu (§01 p5, §17 p26)
- Reaches 100 only when the **five-day production run** is complete (§16 p25)

**Done when** the management panel reconciles to the day-close figures (§16 p25); the backup and restore test has been performed together (§16 p25); the production run has finished.
**Build weeks:** 4 (panel screens, track D) and 5–6 (reconciliation, backup test); the bilingual/RTL requirement is undated in the scope.

### Not in the management panel column

Not included by the scope: Customer 360, lifetime value and cross-domain segments; editing data from the panel — it reports, it does not write; scheduled or emailed reports; forecasting and predictive analytics; user-built custom reports; direct accounting-system integration beyond CSV (§12 p17). PostHog behavioural analytics instrumentation — the panel reports from the database, not from an event pipeline (§01 p4). Staff performance reporting (§07 p11); productivity scoring or league tables (§11 p15, §12 p17). Staff shift scheduling or time clock (§03 p7).

Lives elsewhere: staff accounts, roles, permissions and system settings — **desktop → Shell**. Day close, stock counts, discounts/voids/refunds — **desktop → Cafe & till / Stock management**. The panel shows their results.

---

## 6 · Where cross-cutting work is counted

Every foundation, platform and review-window item, and the one level that owns it. The rule: an item is counted in the column whose software it lives in; genuinely per-client items (bilingual/RTL, design, pipelines, degraded-mode screens, session handling — split in equal thirds or quarters by client) are split by client, each client counting only its own share. "Shell" = desktop's *Shell, design & launch*.

| Scope item | Source | Counted in |
|---|---|---|
| Guest sign-up/sign-in by email, verification, reset; guest profile; language switch; email-auth model | §03 p7; track A wk1 | app → Auth |
| Session handling across mobile / desktop / web (incl. anonymous table sessions) | §03 p7 | thirds: app → Auth · desktop → Shell · web → Menu & table QR |
| Short-lived sessions on shared till machines + PIN | §03 p7 | desktop → Shell |
| Staff accounts created and managed by the owner; five roles; RLS | §03 p7, §02 p6 | desktop → Shell |
| Append-only audit log (the log) / its writers / its filtered view | §03 p7; track A wk3 / §04 p8, §07 p11 / §12 p17 | desktop → Shell / desktop → Reservation desk, Cafe & till / management panel → Staff activity |
| English/Arabic, RTL, bidi, locale formatting, fallback | §03 p7 | quarters: each column's Design & launch (desktop's excludes panel screens; 5.4 carries them) |
| Bilingual content model (one record) / side-by-side editor | §03 p7; track A wk1 | desktop → Shell / desktop → Cafe & till |
| Supabase project, schema, migrations, generated types; staging & production; TypeScript throughout | §03 p7, §02 p6; track A wk1 | desktop → Shell |
| Deployment pipeline for all three clients | §03 p7 | thirds: app (EAS) → Design & launch · web (Vercel) → Menu & table QR · desktop (installer) → Shell |
| Reservation model, exclusion constraint, concurrency tests | §04 p8; track A wk2 | app → Reservation |
| Court records and duration options (display / entry) | §04 p8 | app → Reservation / desktop → Reservation desk (entry location is an assumption, §14 Q9) |
| Menu and recipe schema | track A wk2 | desktop → Cafe & till (menu) · desktop → Stock management (recipe) |
| Realtime channels | §02 p6; track A wk2 | desktop → Cafe & till; the app grid refresh and the web status page count only their own screens |
| Tax configuration; day-close model | track A wk3 | desktop → Cafe & till |
| Reporting layer and queries | track A wk3 | management panel → Business reports |
| Promotions engine | track A wk3 | desktop → Cafe & till |
| Heartbeat, server-side refusal of guest writes, degraded periods logged, protected horizon, honest limit | §10 p14; track A wk3 | desktop → Cafe & till — **once**; the app and the website count only their blocked screens |
| Local cache, durable write queue, disk flush, idempotency, ordered replay, banner, day-close block; kitchen continues from queue; disconnection drill | §10 p14; track D wk4; §15 p23 | desktop → Cafe & till |
| Degraded-mode screens of the app / the website (menu readable, ordering and waiter call blocked) | §10 p14 | app → Reservation · web → Menu & table QR, Ordering, Call waiter |
| Backups with point-in-time recovery; uptime monitoring on both paths; error tracking on the booking path; load test | §03 p7; track A wk4 | desktop → Shell |
| Error tracking on the ordering path (website delivery item) | §09 p13 | web → Design & launch |
| Backup and restore test; Touch's direct access to backups | §01 p5, §16 p25, §17 p26 | management panel → Design & launch (decision of this file) |
| Role workspaces: reception / cashier / kitchen content | §11 p15 | desktop → Reservation desk / Cafe & till / Cafe & till |
| Role workspaces: manager and owner shells, role switching, users, permissions, system settings | §11 p15 | desktop → Shell |
| Report content the manager and owner see | §11 p15, §12 | management panel |
| Rates, hours, cancellation policy (configuration) | §04 p8 | desktop → Reservation desk |
| Customer search, record, internal notes | §05 p9 | desktop → Reservation desk |
| Promotions rules, public codes, single-best rule | §05 p9 | desktop → Cafe & till |
| Price-rule record per booking / promotion-application record | §04 p8, §05 p9 | desktop → Reservation desk / Cafe & till; the panel's drill-through reads them |
| Menu content (edited) / menu content (rendered) | §06 p10 | desktop → Cafe & till / web → Menu & table QR |
| Item unavailable, auto-grey when out of stock — trigger / rendering | §06 p10, §08 p12 | desktop → Cafe & till and Stock management / web → Menu & table QR |
| Stock figures — calculation and operational screens / period report views | §08 p12 / §12 p16 | desktop → Stock management / management panel → Business reports |
| QR artwork, signed tokens, rotation, binding expiry | §06 p10 | web → Menu & table QR |
| Waiter call — raise / acknowledge & resolve on the floor view | §06 p10 | web → Call waiter / desktop → Cafe & till (screen is an assumption, §14 Q10) |
| Receipt printing, printer specification, thermal Arabic rendering | §07 p11 | desktop → Cafe & till |
| One trading currency; tax per item group applied at the till | §13 p18 | desktop → Cafe & till |
| Product design and interface for all three clients; Touch branding | §18 p27, §09 p13, §14 p19 | quarters: each column's Design & launch |
| Store submission, listings in Touch's accounts, fallback, store review, OTA | §14 p21, §15 p22–23, §02 p6 | app → Design & launch |
| Live on Touch's domain, DNS/TLS, preview deploys, venue pages, install, SEO, app-store link, the domain in Touch's name | §09 p13, track C wk4, §17 p26 | web → Design & launch |
| Staff training per role, recorded EN/AR (all five roles) | §15 p23, §18 p27 | desktop → Shell |
| Runbook, staff guide, technical handover, "nothing Kagu-dependent" | §01 p5, §15 p23, §17 p26 | desktop → Shell; the website's deployment instructions alone in web → Design & launch |
| Repository and account handover; Touch's administrative ownership; sign-off with Mustafa | §15 p23, §16 p25, §17 p26 | desktop → Shell (the per-client ownership facts are each column's proof, not re-counted) |
| Defect fixing against module acceptance tests | §15 p23 | each column's last level, for its own modules: app 2 · web 4, 7 · desktop 1, 2 desk, 3, 5, 6, 8, 9 · panel 10 |
| **Five consecutive operating days in production** | §16 p25 | **not weighted** — the completion gate of every column's last level (see §11) |
| Weekly demonstrations and review calls with Mustafa | §15 p23 | process, not scope — timeline markers only (§9) |
| Automated tests and code review | §18 p27 | inside each feature level; the concurrency suite is named in app → Reservation |
| Client inputs, Touch-paid services, hardware, UPS, internet | §13, §14, §18 | not Kagu scope — shown as "waits on Touch" per level, never weighted |
| Warranty, support, after-warranty, later phases, change control | §16–§18 | not build scope — reference only (§13 below) |

---

## 7 · Completeness check — §01 "In scope" (p4), bullet by bullet

| §01 bullet | Level(s) |
|---|---|
| Accounts, email authentication, roles and permissions | app → Auth · desktop → Shell |
| Bilingual English / Arabic with full right-to-left | every column → Design & launch |
| Padel court reservation in the mobile app and at the desk | app → Reservation · desktop → Reservation desk |
| Cafe menu, QR table binding, ordering and waiter call — on the web, no app install | web → Menu & table QR · Ordering · Call waiter |
| Cashier and payment at the desk, tabs, splits, discounts | desktop → Cafe & till |
| Kitchen display screen for preparation dispatch | desktop → Cafe & till |
| Charge a cafe order to a court booking | desktop → Cafe & till |
| Recipe-level stock with consumption, expiry tracking, counts and variance | desktop → Stock management |
| Advanced management panel — revenue, occupancy, margin, stock and staff activity, with CSV export throughout | management panel → all four levels |
| Customer search and history, staff-only internal notes | desktop → Reservation desk |
| Configurable promotions and discounts, including public codes | desktop → Cafe & till |
| Recurring and block bookings created by staff | desktop → Reservation desk |
| A dedicated workspace for each staff role | desktop → Reservation desk, Cafe & till, Shell |
| Degraded mode — the till keeps trading and queues locally through an outage | desktop → Cafe & till (+ app Reservation, web Menu & table QR / Ordering / Call waiter for their screens) |
| Public website carrying the whole cafe guest experience | web → all four levels |
| Deployment, store publishing, and handover documentation | app → Design & launch (stores, EAS) · web → Menu & table QR (pipeline) · desktop → Shell (installer, docs, handover) |

And the ten modules (§03–§12): 1 Foundations → app Auth + desktop Shell + web Menu & table QR (anonymous sessions) + every Design level · 2 Padel reservation → app Reservation/Notifications + desktop Reservation desk · 3 Customers & promotions → desktop Reservation desk + Cafe & till · 4 Cafe guest side → web Menu & table QR / Ordering / Call waiter (+ desktop editor and floor view) · 5 Cashier & dispatch → desktop Cafe & till · 6 Stock & recipes → desktop Stock management · 7 The website → web Menu & table QR + Design & launch · 8 Degraded mode → desktop Cafe & till (+ app, web screens) · 9 Role workspaces → desktop · 10 Management panel → management panel.

---

## 8 · What Touch must provide (§14) — and which level it blocks

"Kagu works remotely. Everything below is client-side. The build is four weeks, so these land earlier than they would on a longer plan — a week's delay here is a week off the end" (§14 p19). The *Blocks* column is this file's derivation, not scope wording.

| Item | Needed by | Consequence if late (scope wording) | Blocks (derived) |
|---|---|---|---|
| Down payment | Before start | The four-week build begins on receipt, not before | everything |
| Named approver available weekly | Throughout | Phase acceptance cannot be signed | every Design & launch |
| Apple Developer and Google Play accounts in Touch's name, Kagu added | **Start** — Touch should begin on day one | The app cannot be submitted; Apple enrolment needs a D&B number and legal verification, 2–3 weeks | app → Design & launch |
| Court list, hours, rates, cancellation policy | Week 1 | Module 2 cannot be configured or tested | app → Reservation · desktop → Reservation desk |
| Trading currency and tax decision | Week 1 (currency: before build starts, §13 p18) | Till and reporting cannot be finalised | desktop → Cafe & till · panel → Business reports |
| Branding assets — logo, colours, photography | Week 1 | Interfaces ship in placeholder styling | every Design & launch |
| Full menu with prices, sizes and modifiers | Week 1 | Track C has nothing to render; the website slips | desktop → Cafe & till · web → Menu & table QR |
| Domain registered, with DNS access | Week 1 | The website cannot go live on Touch's domain | web → Design & launch |
| Supabase account funded in Touch's name | Week 1 | Production cannot be provisioned; the system stays on development limits | desktop → Shell (platform) — and so everything |
| English and Arabic copy for all content | Week 2 | The Arabic build cannot be accepted | every Design & launch |
| Table numbering and floor layout | Week 2 | QR artwork cannot be issued | web → Menu & table QR |
| Measured recipes per product | Week 2 | **Module 6 cannot be delivered — the single largest risk in this phase** | desktop → Stock management |
| Ingredients — pack size, cost, supplier, shelf life | Week 2 | Margin reporting and batch expiry are unusable | desktop → Stock management · panel → Business reports |
| Staff list with intended roles | Week 3 | Accounts cannot be created for training | desktop → Shell |
| Hardware in place — till, kitchen screen, printer, network | Week 3 | Installation and testing cannot proceed | desktop → Cafe & till, Shell |
| Staff available for training | Week 5 | Handover is incomplete | desktop → Shell |

Touch also carries, outside the fee (§14 p21, §18 p27, §13 p18): Supabase (from $25/mo), the domain (annual), Apple Developer Program ($99/yr), Google Play ($25 once); the hardware — till machine, kitchen screen, thermal printer, network equipment and the recommended UPS; a business internet connection wired to the till; translation, copywriting and photography. Website hosting, the build service and error tracking are carried by Kagu. **No further paid service is ever introduced without telling Touch first, stating its monthly or annual cost, and obtaining written approval — during this phase and afterwards** (§14 p21, §19 p28). A §14 dependency arriving after the week shown moves the delivery date by the delay it causes (§16 p25).

---

## 9 · Timeline — which levels move in which week

Build 4 weeks · review & handover 2 weeks · total 6 · starts on the down payment (§15 p22). A working build is demonstrated at the end of every week and a short review call with Mustafa closes it — four weeks is too short to discover a misunderstanding at the end (§15 p23).

| Week | Demo milestone (§15 p23) | app | desktop | web | management panel |
|---|---|---|---|---|---|
| 1 | Foundations, accounts, roles and initial system | Auth (auth screens; track A email auth); Design & launch (shell, EAS pipeline, RTL foundation) | Shell (wrapper, role routing, staff sign-in; track A schema, migrations, roles & RLS, bilingual content model, environments and pipeline) | Menu & table QR (Next.js shell, locale routing, deploy pipeline); Design & launch (RTL, domain and TLS) | — |
| 2 | Booking and basic POS | Reservation (court browsing, availability grid, holds; track A reservation model + concurrency tests) | Reservation desk (calendar, recurring series, customer search, notes); Cafe & till (cashier workspace, menu editor; track A menu schema, realtime channels); Stock management (track A recipe schema) | Menu & table QR (menu from live data, signed table token) | — |
| 3 | Cafe, kitchen and website | Reservation (booking end to end); Notifications (push, cancellation policy) | Cafe & till (cashier, tabs, splits, promotions, charge-to-booking, kitchen, day close; track A audit log, tax config, day-close model, promotions engine, heartbeat & lockout) | Ordering (incl. live order status); Call waiter | Business reports (track A reporting layer and queries) |
| 4 | Full integrated beta | Design & launch (polish, store listing assets, **submitted to both stores**) | Shell (manager & owner workspaces; track A backups, monitoring, load test); Cafe & till (local cache & write queue); Stock management (all of it) | Design & launch (venue information, metadata, home-screen install, **live on Touch's domain**) | Business reports, Staff activity, Controls & CSV export (the panel and CSV export); Design & launch (panel screens) |
| 5 | Real-world testing, fixes and training — **the five-day production run starts** | Design & launch (store review) | Shell (training per role, defect fixing); Cafe & till (disconnection drill) | Design & launch (fixes) | Controls & CSV export (comparison periods); Staff activity (views); Design & launch (reconciliation) |
| 6 | Final fixes, handover and production acceptance — **the run completes** | Design & launch (resubmission if rejected) | Shell (runbook, docs, repository & account handover, sign-off) | Design & launch | Design & launch (backup & restore test) |

Week 1 is foundation-led: tracks B, C and D build their shells immediately but cannot go deep until track A has landed the schema, the authentication model and the reservation table — the one genuine sequencing constraint (§15 p23).

---

## 10 · Priority order if the window tightens (§15 p24) → levels

Nothing here leaves Phase 1 — late work stays in the phase at the agreed price (§16 p25); this is only the order of completion.

| # | Scope wording | Level(s) |
|---|---|---|
| 01 | Platform and padel reservation — not negotiable; also on the critical path for store submission, which cannot slip without spending the review buffer | app → Reservation · desktop → Reservation desk, Shell (platform) |
| 02 | Cashier and kitchen display — the cafe cannot trade without them | desktop → Cafe & till |
| 03 | Web ordering and waiter call — the cafe can trade at the till while these follow; the website itself carries the menu and must ship | web → Ordering, Call waiter (Menu & table QR must ship) |
| 04 | Role workspaces — reception, cashier, kitchen ship with their modules; manager and owner simpler at first, refined during the review weeks | desktop → Shell (manager/owner shells) |
| 05 | Degraded mode — the heartbeat lockout is cheap and ships regardless, since it prevents a slot being sold twice; the desk-side cache and write queue is the larger half and can follow in the review weeks | desktop → Cafe & till |
| 06 | Management panel — revenue, court, cafe and stock reports with CSV export come first; comparison periods and the staff-activity views are the part that can be completed during the review weeks | panel → Business reports and the CSV half of Controls & CSV export first; comparison (in Controls & CSV export) and Staff activity later |
| 07 | Promotions — automatic and staff-applied rules first; public codes last, since manual discounts behind a PIN cover the gap until they land | desktop → Cafe & till |
| 08 | Stock and recipes — the largest module, last in the build and first to move; it will move if measured recipes have not arrived by the end of week 2 | desktop → Stock management |
| 09 | Batch expiry tracking — if stock must be reduced rather than deferred, expiry gives way first and recipe-level consumption stays intact | desktop → Stock management (expiry sub-items) |

The two-week buffer exists to absorb store review, including one rejection, and the defect fixing that follows a first real week of use. It is not spare build time: spending it on late scope leaves nothing to absorb a store rejection, and the mobile app is then the thing that slips. Store approval timing is controlled by Apple and Google and sits outside Kagu's commitment; the five-day production run also happens inside this window (§15 p24). What would extend the window: a §14 dependency arriving after the week shown, a change request accepted mid-phase, dual-currency handling at the till, a third interface language, more than one store rejection or a review beyond two weeks, developer-account enrolment not completed in time, major issues found during the five-day run (§15 p24).

---

## 11 · Acceptance — what "100 %" means (§16)

**The production run.** Before final sign-off and final payment, Touch operates the complete production system for **five consecutive operating days with no unresolved major issue** — the venue trading under real conditions, not a demonstration (§16 p25).

- *Operating day*: a day the venue is open and trading; closed days neither count nor break the sequence.
- *Major issue*: a defect that prevents taking a booking, taking payment, sending an order to the kitchen, or closing the day, and for which no reasonable workaround exists. Cosmetic faults, wording and requests for new behaviour are not major and do not stop the run.
- *Restart rule*: a major issue pauses the count; once fixed, the run continues from where it paused rather than starting again. An interruption caused by Touch — a venue closure, missing hardware, absent staff, or an outage on Touch's connection — pauses the count without counting against Kagu.

**In the progress view** the run is not a weighted level: it is the gate on the last level of every column (app, web and panel → *Design & launch*; desktop → *Shell, design & launch*) — none of the four can reach 100 until the run is complete, which is exactly the "when it's done, every row is full" rule.

**The phase is accepted when** all ten modules have been demonstrated to Mustafa, the production run is complete, and (§16 p25):

| Condition | Proven by |
|---|---|
| A guest can register and book a court in the app, and order to a table from the website with no app and no account, in English and in Arabic | app → Auth, Reservation, Design & launch · web → Menu & table QR, Ordering, Design & launch |
| Staff can run a full trading day and close it with cash and card reconciled | desktop → Cafe & till |
| A physical stock count produces a variance report that reconciles | desktop → Stock management |
| Each of the five roles reaches its own workspace and completes its daily tasks | desktop → Reservation desk, Cafe & till, Shell |
| The management panel reconciles to the day-close figures and exports to CSV | panel → Business reports (reconciles), Controls & CSV export (exports), Design & launch (the check) |
| The concurrency test suite passes on the booking path | app → Reservation |
| A real backup and restore test has been performed together | panel → Design & launch |
| Touch holds administrative ownership of every repository and account | desktop → Shell |

Acceptance is not withheld for out-of-scope items nor for matters outside Kagu's control such as store review timing; the mobile app is accepted on submission of a working build (§16 p25). **Nothing agreed for Phase 1 moves to Phase 2** — if a schedule becomes tight, work is delivered late, it does not become a paid addition; removals need written agreement from both parties and are removed from the phase, not resold. Counterpart: a §14 dependency arriving late moves the delivery date by the delay it causes — fixed scope and a fixed date can only hold together when the inputs arrive on time. **Change control**: any request that adds to, removes from or alters what is written is recorded in writing with its effect on the date and the fee, and approved by Touch or deferred before work begins. Nothing is absorbed silently, and nothing is refused out of hand (§16 p25).

---

## 12 · Out of scope — master list (never counted anywhere)

From §01 p4 and every module's "not included" box, deduplicated:

- Online and in-app payment — desk payment only (§01, §02, §04, §06, §19); RevenueCat or any payment SDK (§02)
- Coaching, courses, coach schedules, commission settlement, lesson booking of any kind (§01, §04, §18)
- Open matches, seat claiming/splitting, cost splitting between players; player levels and matchmaking (§01, §04)
- Tournaments, leagues and fixtures (§01, §04)
- Touch Shop retail and pro-shop inventory (§01, §08)
- Loyalty points, rewards and tiers, including on cafe spend (§01, §05, §06)
- Customer 360 — lifetime value, cross-domain segments, churn signals, marketing lists (§01, §05, §12)
- PostHog / behavioural analytics; analytics, marketing tags or advertising pixels (§01, §06, §09)
- Full offline operation from a local on-premises database; offline use of the app or website; automatic conflict merging (§01, §10, §13, §19)
- Purchase orders and supplier management; supplier price history; suggested order quantities; automated reordering; supplier lot numbers and recall tracing (§01, §08)
- Multi-venue, multi-location stock, transfers between locations (§01, §08)
- Phone/SMS one-time-code login; social or Apple/Google sign-in; household or family account linking; customer-facing profile history beyond their own bookings and orders (§03, §05)
- Any third language, e.g. Kurdish — a change request, to be raised before content is written (§03, §13)
- Staff shift scheduling or time clock (§03)
- Memberships, subscriptions and member rates; waiting lists; guest-created recurring series (§04)
- Marketing email or SMS campaigns; notes visible to the customer; promotion stacking (§05)
- Any cafe functionality in the mobile app (§02, §06, §19)
- Web push notifications when an order is ready; account requirement or tipping on cafe; delivery, collection or ordering from outside the venue; scheduled or pre-orders; guest-to-guest bill splitting (§06)
- Card-terminal integration; automated cash drawer control; printed kitchen tickets; a second till or second preparation station; staff performance reporting; accounting system integration; fiscal or government-registered receipt devices, e-invoicing (§07, §12, §13)
- Court booking from the website; a wider marketing site; guest account management on the web beyond optional sign-in at checkout; a CMS beyond what the desktop app edits (§09)
- Copywriting, photography and translation — supplied by Touch (§09, §18)
- Per-user customisation or draggable dashboards; additional roles beyond the five — a change request, though the model supports them; separate installers per role; productivity scoring or league tables (§11)
- Editing data from the panel; scheduled or emailed reports; forecasting and predictive analytics; user-built custom reports (§12)
- Dual currency at the till — a second display currency, a fixed or editable daily rate, change given in the other currency, both totals reconciled at day close — quoted as an addition (§13, §15)
- Hardware — till, kitchen screen, thermal printer, network, UPS; Supabase, domain and store account fees (§14, §18)
- Ongoing support and maintenance after the warranty — monitoring, backup verification, operating-system and store-compliance updates, a monthly change allowance — optional, quoted separately; Touch keeps a running system whether or not it is taken (§18)
- Anything not written in the scope document (§00 p3)

---

## 13 · Commercial, warranty and ownership — reference only

Not part of the progress arithmetic; recorded so the drawer copy and the finance page agree with the scope.

- **Fee** $6,500, US dollars. **Down payment 50 %** due before start — the build begins on receipt. **Final payment 50 %** on written acceptance, after the five-day production run (§18 p27).
- **In the fee**: product design and interface for all three clients in both languages and directions; all engineering, automated tests and code review; the ten modules in full; staging and pipeline; store submission under Touch's accounts; remote training per role, recorded; runbook, staff guide and technical handover; 90-day defect warranty with §17 response times; source code, database and account ownership transfer (§18 p27). **Not in the fee**: Supabase, the domain and the two store accounts; hardware and the recommended UPS; translation, copywriting and photography; anything listed as not included in a module section (§18 p27).
- **Warranty**: 90 days from acceptance, any behaviour that does not match the scope corrected at no charge, as often as needed — defects, not development; new capability, changes of mind and out-of-scope items are a new phase, quoted and agreed, never invoiced as a warranty fix (§17 p26).
- **Support channel**: a shared WhatsApp group including Touch's named contacts and Kagu's engineers, used for everything from a question to an outage. Critical issues are covered seven days a week; high and normal issues on working days; response times run from the moment an issue is reported in that group (§17 p26).
- **Severity** (§17 p26): *Critical* — the POS, booking system, database or another essential part is down, or payment cannot be taken; the venue cannot trade normally and there is no workaround — acknowledge within 2 hours, 7 days a week, then active continuous work until trading again, progress reported in the group at least every two hours. *High* — a major function is broken (stock, reporting, the kitchen screen, a role workspace) but the venue can still trade, or a workaround exists — acknowledge within 8 working hours; fix or a stated workaround within 2 working days. *Normal* — a minor defect, cosmetic fault, question, or small change within scope — acknowledge within 2 working days; scheduled into the next release, with the date stated. Severity is set by the effect on trading, not by who reports it; where Touch and Kagu disagree the higher applies until jointly agreed otherwise. Outages caused by a third party — Touch's internet, a power cut, an app store, or a provider outage — are worked on with the same urgency, though resolution timing is not within Kagu's control.
- **Touch owns, on acceptance and settlement** (§17 p26): full source code for all three clients in Touch's repositories; the database, schema and migration history; all customer, booking, transaction and stock data, exportable at any time; direct access to backups and the ability to restore without Kagu; the Apple and Google listings; the domain, the Supabase project and every account in Touch's name; runbook, staff guide and technical documentation in English and Arabic; recorded training per role. No technical dependency on Kagu: continued support is optional and quoted separately, and is never a condition of Touch keeping its own system running.
- **After the warranty** (§18 p27): ongoing support and maintenance — monitoring, backup verification, operating-system and store-compliance updates, a monthly change allowance — available and quoted separately; optional. **Later phases** (quoted separately, nothing committed): coaching and settlement, open matches, tournaments, Touch Shop, loyalty, Customer 360, online payment, full offline operation.
- **Operating in Iraq** (§13 p18): no general VAT and no fiscal device or e-invoicing; a 10 % sales tax applies to deluxe and first-class restaurants and hotels — whether Touch Cafe falls within it is for Touch's accountant; Kagu builds a configurable tax rate per item group. One trading currency, dinar or dollar, confirmed before build. A UPS on the till, printer, router and switch is Touch's — "most interruptions in practice are power rather than network, and a UPS costs little against the trading it protects".
- **The agreement (§19 p28)** — what signing confirms: the ten modules in §03–§12 delivered in full for the §18 fee; everything listed as not included excluded from the phase and its fee; Touch supplies the §14 items by the weeks shown; four weeks of build and two of review, beginning on receipt of the down payment; payment at the desk only; nothing agreed for Phase 1 becomes a paid Phase 2 item, removals need written agreement; final payment follows the five operating days; the 90-day warranty with §17 response times; all cafe guest functionality on the website, the app padel only; Touch pays for Supabase, the domain and the two store accounts, every other service carried by Kagu with no further paid service without written approval; the till keeps trading through an outage, full offline running is a later phase; changes follow §16 change control. Signatories: Mustafa for Touch Padel; Majed Ahdab for Kagu Software.
- **Document control**: v2.0 for signature, incorporating the sixteen points raised by Touch in review, all accepted; supersedes v1.0 and the proposal — where they disagree, this document governs. Approver: Mustafa (§00 p2–3).

---

## 14 · Open questions and assumptions found while extracting

None changes the level structure; each needs a sentence agreed with Touch before the drawer copy is final.

1. **Guest accounts on the website.** §03 p7 acceptance says a guest can "register, verify, sign in and change language on all three clients"; §09 p13 excludes "guest account management on the web beyond optional sign-in at checkout". This file counts *optional sign-in at checkout* under web → Ordering and full registration under app → Auth. Confirm the website does not need a registration flow.
2. **Promotion-adjusted prices in the app.** Promotions can be restricted to specific courts and apply automatically (§05 p9); the scope does not say whether the app shows a promotion-adjusted slot price. Counted as till-side application only.
3. **Where a public promotion code is entered.** Public codes "a customer can enter" (§05 p9) — on the web at checkout or at the desk is unstated. Counted at the desk.
4. **Tax on web prices.** The tax rate is "applied at the till, shown separately on the bill" (§13 p18); whether web menu prices are shown tax-inclusive is unstated.
5. **"Tickets from the guest app"** (§07 p11) — the app has no cafe section (§02 p6, §06 p10); read as tickets from the website.
6. **Audit-log timestamps.** §03 p7 lists actor, action, before/after values and reason code; a timestamp per entry is not written, though notes are "stamped with author and time" (§05 p9) and waiter calls "stamped with who acted and when" (§06 p10). Assumed logged.
7. **"System settings"** in the owner workspace (§11 p15) is never enumerated. The only venue-wide settings the scope names are the trading currency and tax rates (§13 p18).
8. **Manager vs owner report access.** The manager's operations overview includes "staff activity … reports" (§11 p15); the scope does not say which subset of the panel the manager gets versus the owner.
9. **Where court records and durations are entered.** §04 p8 lists them under the app's guest booking and names no editing screen; the court list is a week-1 Touch input (§14 p19). Assumed entered on the desktop (3.1).
10. **Which screen hosts the waiter-call floor view.** §06 p10 says only that the call "reaches the floor view". Assumed the cashier's till (3.2), whose role is "till, orders, table service" (§02 p6).
11. **"Financial overview"** in the owner row (§11 p15) is named alongside the panel and not described. Read as the revenue & payment report group (5.1).
12. **Web order in the honest-limit window.** A web order placed in the seconds before the server notices an outage is an append-only fact and safe to replay (§10 p14); the scope does not spell out the guest-side behaviour. No level claims it.

---

## 15 · Mapping onto KaguOs (`project_milestones`)

For the migration that follows review. The table already supports exactly this shape: two levels (0078), weights, hand-set completion, a rollup from children to parent, and `detail` text per row.

**Rows.** Four top-level phases (`parent_id null`, `depth 0`) — the columns — and sixteen sub-phases (`depth 1`) — the levels. Project: Touch Padel, `37024fb4-0852-4fe3-a9f8-3835f4ee4666` (0076–0079).

| Column row | `weight` (share of build) | `sort` | Level rows (`weight` = share of the column) |
|---|---|---|---|
| app | 20 | 10 | Auth 15 · Reservation 45 · Notifications 15 · Design & launch 25 |
| desktop | 47 | 20 | Reservation desk 20 · Cafe & till 32 · Stock management 20 · Shell, design & launch 28 |
| web | 17 | 30 | Menu & table QR 35 · Ordering 25 · Call waiter 10 · Design & launch 30 |
| management panel | 16 | 40 | Business reports 45 · Staff activity 15 · Controls & CSV export 20 · Design & launch 20 |

- `title` — the node label (column name; level name). `detail` — the **drawer** text from this file: the column drawer for a depth-0 row, the level's *Drawer* paragraph plus its *Done when* line for a depth-1 row. The *Included* lists are the producer's checklist for setting `completion`, not client copy; the italic split notes and assumptions stay out of the client's drawer.
- `completion` — hand-set on level rows only; column rows are computed by the 0078 rollup and must not be hand-set. `status` follows completion (0075 sync). Everything starts at 0 / planned.
- `visible_to_client` — true throughout; the plan is the scope, which Touch has signed.
- **What changes from 0079**: the five week-based tracks and their twenty children are replaced by four systems and sixteen feature levels. 0079's rows are deleted (cascade takes the children); 0079 needs a **supersession guard** the way 0077 got one — return early if a top-level row titled `management panel` exists on this project — so a replay cannot put the week-based plan back (see memory: migration-workflow). Application goes through the Supabase connector and the history row is re-stamped `0080`.
- The 0078 invariant "children's weights are a share of the parent" is exactly the level weights above; every column's levels sum to 100 as the rollup's comment requires, and the four column weights sum to 100.

**The progress view.** Four columns from `milestoneTree()`; the column's bar is `phase.completion` (rolled up); the headline is `milestoneProgress().pct` (weighted, depth-0 only — already implemented). Under each bar the levels are plain nodes: name and status dot only, **no percentage inline**. Clicking a level opens a drawer with the drawer text, its completion, status, target/done dates, and what it waits on. The existing rail `Timeline` is replaced for plans with exactly this shape; unweighted or flat plans keep the rail.
