# Touch Padel — Extension · Project Scope

> The data behind the client portal's progress view for the Touch Padel **extension**, cut from
> the signed *Scope Extension v1.0* (it extends Phase 1 v2.0; signed 2026-09-25) plus three
> additions recorded on 2026-09-29. Like Phase 1 (`Project Scope.md`) it is **four columns — one per
> delivered system — each made of levels**, and every in-scope item lands under exactly one level
> of one column, so when every level is done the extension is done.
>
> Source: `touchpadel-scope-extension-v1.pdf` (18 pages). The document numbers its sections 01–15
> and its ten modules 11–20 so they continue from Phase 1. Citations here are `§12` for a section
> and `M11`–`M20` for a module. Nothing is invented: if a capability is not written in the
> document, it is not in the extension (§00), and it is not in this file either — except the three
> additions in §0, which post-date the PDF and are marked as such. Where this file has to *decide*
> something the document leaves open, the decision is marked as one, and file §14 lists the open questions. (A bare `§` is the PDF's section number; `file §` is this file's own.)
>
> Data in prod: project `Touch Padel · Extension`, seeded by `supabase/migrations/0086_touch_padel_extension.sql`.
> The client-facing drawer text for every column and level is in that file; this file is the
> allocation, the producer's checklist for setting completion, and the record of why.

---

## 0 · Decisions this file is built on

Taken with the producer on 2026-09-29, before anything was written:

| Decision | Choice |
|---|---|
| Where the extension shows in the portal | **A separate project, `Touch Padel · Extension`.** Phase 1 keeps its own project, its own four bars and its own fee. The signed document says Phase 1 "stays on its own terms" and that Phase 1 acceptance does not wait for any module in the extension (§00), so folding the extension under Phase 1 would make its bars *drop* as unfinished levels were added, and would let one fee muddy the other |
| Columns | **The same four systems as Phase 1** — Mobile app · Desktop app · Website · Management panel — so the client reads both projects the same way |
| Column weights (share of the extension) | **Kagu's sizing, editable** — **30 · 49 · 6 · 15**, reasoning in file §1 |
| Levels | **20 at seeding** — Mobile app 6 · Desktop app 7 · Website 3 · Management panel 4. Mobile app and Desktop app have more than Phase 1's four per column, because the extension is ten modules where Phase 1 was one product; Website and Management panel do not: a level is a coherent group of modules or a coherent half of one, and *Design & launch* is always last |
| Where an item is counted | In the column whose software it lives in. Server-side work is counted where the feature it serves is operated (the payment provider integration in desktop → *Payments & refunds*), as Phase 1 counted platform work in desktop |
| **Addition 1 — screenshot protection, with reporting in the logs** | Screens in the phone's staff section and the Operator's windows are protected against capture **where the operating system allows it**: blocked on Android and on the Windows till and desk machines; on iOS and macOS a capture is *detected*, and the content is hidden while recording (and in the app switcher on iPhone). Not possible on the website. Every attempt is written to the audit log: **who, when, which device, which screen** |
| **Addition 2 — the assistant on the admins' phones** | **Owners and managers** get the Module 19 assistant in the phone's staff section, with the same permissions and branch limits as in the panel |
| **Addition 3 — a full training exam on the Operator** | Built **into the Operator**: a graded exam **per role**, in English and Arabic, each person's result saved and visible to managers and the owner |
| Customer 360 | **Removed from the roadmap** (§01: "removed entirely … not planned as a later phase"). It appears in no level of this plan. Loyalty (M16) works from each guest's own points record |
| Dates | Signed **2026-09-25**. Mobile build to store review **2026-10-13**; everything else **2026-11-03**; store review estimated at **three to four weeks** after submission. Every *Design & launch* carries **2026-11-10** (the end of that estimate, and of the five-day run that gates it), and so does the project |
| Payment | **$5,600** for the extension alone, in four monthly installments: **$1,500 · $1,500 · $1,500 · $1,100** on **30 Oct, 30 Nov, 30 Dec 2026 and 30 Jan 2027**. **Nothing is due on signing** (corrected 2026-09-29). None is marked paid |
| Where every bar starts | **0 / planned.** Some modules are already built in the product repository; setting completion is the producer's call |
| Publishing, and the input pack | Touch's login was linked to the project on 2026-09-29 (by the producer, not by this work). **No input pack:** `intake_pack = 'none'`, set the same day at the producer's request, and understood by the portal from the code change that adds `hasPack()`. See file §15 |

---

## 1 · The four columns at a glance

```
[ Mobile app 30 ]      [ Desktop app 49 ]            [ Website 6 ]          [ Management panel 15 ]   → overall %
   │                       │                             │                       │
   Pay in the app          Branches & stock              Pay the tab             Online, branch & shop reports
   Lessons, matches &      Payments & refunds            Branches on the site    Assistant
     tournaments           Coaching, matches &           Design & launch         Screenshots in the log
   Points & branches         tournaments                                         Design & launch
   Protocols & checklists  Shop & loyalty
   Staff tools             AI stock intake
   Design & launch         Safeguards & training exam
                           Design & launch
```

| Column | What it is | Share | Levels (share of column) |
|---|---|---|---|
| **Mobile app** | The guest app, now also carrying lessons, matches, tournaments, the loyalty QR and the **staff-only section** (protocols, checklists, receipt capture, the assistant) — one Expo codebase, iOS and Android (§01, M11–M14, M16, M18–M20) | **30** | Pay in the app 13 · Lessons, matches & tournaments 24 · Points & branches 7 · Protocols & checklists 24 · Staff tools 10 · Design & launch 22 |
| **Desktop app** | The Operator — the Windows application the venue is run from; the desk, the till, stock, and now branches, refunds, coaching admin, the shop, the loyalty scan, AI intake, the exam (M11–M18) | **49** | Branches & stock 18 · Payments & refunds 12 · Coaching, matches & tournaments 25 · Shop & loyalty 14 · AI stock intake 8 · Safeguards & training exam 9 · Design & launch 14 |
| **Website** | Touch's public site: settling a cafe tab from a phone, and a venue page and table codes per branch (M11, M17) | **6** | Pay the tab 45 · Branches on the site 30 · Design & launch 25 |
| **Management panel** | The reports panel: online and branch and shop figures, the assistant, and the screenshot events in the log (M11, M15, M17, M19, addition 1) | **15** | Online, branch & shop reports 30 · Assistant 40 · Screenshots in the log 10 · Design & launch 20 |

**How the numbers combine.** Same as Phase 1. A level's percentage is hand-set (0–100). A column's bar is the weighted average of its levels (the 0078 rollup — a column reaches 100 only when every level does). The overall figure is the weighted average of the four columns. Worked example: setting *Pay in the app* to 60 % moves the Mobile app bar to 7.8 % (13 % × 60 %) and the headline by 2.3 points (30 % × 7.8 %).

**On the column weights** (sum 100). A judgement about *size*, from what each system has to carry — not a measurement:

- **Desktop, 49.** Almost every module has a half that is set up, run or checked at the desk or the till: coaches, courses, tournaments, the shop, the loyalty scan, branches with a stock ledger each, transfers, AI intake, refunds. It also carries the payment provider integration, the two new roles, the exam, and most of the training and handover. The largest system by a distance, as in Phase 1.
- **Mobile, 30.** The guest side of five modules, the whole of Module 20 (a routed-request system with approvals, push and checklists), the assistant and capture on the phone, and the store submission and review that the PDF holds four weeks for.
- **Management panel, 15.** The assistant (M19: two languages, permissions, branch-awareness, logged, weekly review), the new report lines and the screenshot log view.
- **Website, 6.** Two things: the tab payment and the branch pages.

---

## 2 · Column: Mobile app (30) — target 2026-10-13 build · 2026-11-10 close

The *Included* lists below are the producer's checklist for setting `completion`, not client copy.

### 2.1 Pay in the app — M11, app side · 13 % of the column
- Pay for a court booking in full when booking; pay for a lesson or course place (M12), a seat in an open match (M13) or a tournament entry (M14) (§02)
- The provider's hosted checkout, so card details never pass through Touch's systems; card, plus the provider's own wallet where it offers one (§02)
- The Phase 1 slot hold covers the payment: if it fails or times out, the hold expires and the slot returns to the grid (§02)
- A receipt for every payment in the guest's account, in both languages (§02)
- Built against the provider's test environment, switched to live keys when Touch's merchant account is approved; if the account is not live at the end of the build the module is accepted on the test environment (§02 box)

*Done when*, in the build sent to the stores, a guest can pay for a court against the provider's test environment and a failed payment releases the slot; the desk showing it paid is checked under desktop → *Payments & refunds*.

### 2.2 Lessons, matches & tournaments — M12, M13, M14, guest side · 24 %
- **M12:** a guest books a private or small-group lesson (coach, court, date, length) and enrols in a group course until it is full; a coach signs in to the app and sees their own schedule, sessions and students (§03). *Derived:* the coach's half of attendance ("marked per session by the coach or the desk") can only happen in this app, since a coach has no Operator access
- **M13:** open a match when booking a court, or open seats on a booking already held; level range and a short note, each player's self-declared level on their profile; a list filtered by date, time and level; join in one tap, leave within the cancellation window; the organiser can remove a player before the start; the court price splits equally per seat and each player pays their share online or at the desk; the venue's cutoff with one rule for unfilled seats; notifications on join, leave, fill and cancel (§04)
- **M14:** pair registration in the app with the entry paid online; brackets, tables, fixtures and results in the app with a notification for each fixture and result (§05)

*Done when*, in the build sent to the stores, a guest can book a lesson with a chosen coach, a coach can see their own schedule, a match can fill with three other guests who each pay their share, and a pair can enter a tournament and see its bracket, all against the test setup.

### 2.3 Points & branches — M16 and M17, guest side · 7 %
- A personal QR code in every guest's app account; balance and history in the app (§07)
- Guests choose a branch in the app; bookings, lessons, matches and tournaments belong to a branch; the account, bookings and points work at every branch (§08)

*Done when*, in the build sent to the stores, a guest's QR code shows in their account, their points balance and history show in the app, and the same guest can book at either of two branches from one account, all against the test setup.

### 2.4 Protocols & checklists — M20 · 24 %
- A staff-only section of the app, which guests never see; several protocol types, each with its own form and route; routes of any length where a step can return to the person who raised the request; at every step approve and pass on, send back with a comment, or reject with a reason (§11)
- Photos and files attached from the phone; a push notification to whoever holds the next step and a list of what is waiting for them; a full timeline on every request, nothing deleted (§11)
- A checklist page; checklists set by a manager (opening, closing, cleaning), assigned to a role or a person, once or repeating daily or weekly, per branch; each tick stamped with who and when; managers see what is done, late or incomplete (§11)
- **Marketing** (new role): holds steps in protocol routes, no access to the till, stock or financial reports — the *account* is created in desktop → *Branches & stock*
- Every staff role can raise requests and complete its checklists from the app (§01 roles table)

*Done when* a member of staff raises a request and it travels its full route, including a return to the proposer, with each holder notified; a send-back and a rejection each work with the comment recorded; and a daily checklist is completed in the app with each tick stamped and visible to the manager. (§11 acceptance)

### 2.5 Staff tools — M18 capture, addition 2, addition 1 (phone) · 10 %
- **M18:** capture a supplier receipt with the phone camera in the staff section (§09) — the reading, matching and confirmation are desktop → *AI stock intake*
- **Addition 2 (2026-09-29):** the assistant on owners' and managers' phones, in the staff section — same permissions and branch limits as the panel; the assistant itself is panel → *Assistant*
- **Addition 1 (2026-09-29):** screenshot protection on the staff-section screens (Android blocked; iPhone detected and hidden while recording and in the app switcher); every attempt written to the audit log with who, when, device and screen — the *view* is panel → *Screenshots in the log*

*Done when*, in the build sent to the stores, a receipt can be photographed and sent from a phone, an owner can ask the assistant a question and get an answer, and a screenshot attempt in the staff section appears in the audit log, all against the test setup.

### 2.6 Design & launch · 22 %
- Product design and interface for the extension's mobile screens, in both languages and both directions (§14)
- Store submission of the updated app under Touch's developer accounts, and store review — sent by 2026-10-13, review estimated at three to four weeks (§14, §12 store-review box). The app is accepted on submission of a working build, not on store approval (§12)
- Defect fixing against the mobile-side acceptance tests (§13). The remote training is counted once, in desktop → Design & launch (file §6)
- **Gate, not weighted:** the five consecutive operating days (§13)

*Done when* the updated app is submitted to both stores, every new screen has been checked in English and Arabic, and the five-day run has finished with no unresolved major issue.

---

## 3 · Column: Desktop app (49) — target 2026-11-03 build · 2026-11-10 close

### 3.1 Branches & stock — M17, desk side, and the two new roles · 18 % of the column
- Branch records: name, address, hours, closed days, contact, in both languages; each branch with its own courts, rate rules, cafe tables, till, preparation station, promotions and degraded mode; one menu and one product catalogue, prices and availability set once or per branch (§08)
- Staff assigned to one or more branches; a cashier signs in to their branch and sees only that branch; the owner, and managers given several branches, switch between them or see all; branch access enforced by row-level security in the database (§08)
- Stock per branch: its own ledger, counts, variance and expiry batches; transfers sent by one branch and received by the other with short receipts, so stock is never counted in two places (§08)
- Day close per branch, each reconciled on its own; an outage at one branch locks near-term bookings for that branch only (§08)
- **Coach** and **Marketing** accounts, taking the staff roles from five to seven (§01)
- The branch model across every table — the one sequencing constraint of the plan (§13 box)

*Done when* a second branch is set up with its own courts, tables and stock, its staff see only that branch, and a transfer leaves one branch's stock and arrives in the other's. (§08 acceptance)

### 3.2 Payments & refunds — M11, desk side and server · 12 %
- The provider integration on the server: every payment confirmation verified and processed once, so a repeated notice cannot record a payment twice (§02); one provider, chosen by Touch, confirmed in week 1, merchant account in Touch's name (§02)
- For each kind of item the venue chooses: pay online, pay at the desk, or either (§02)
- Online payments show on the booking or tab they paid for, marked as paid online; a cafe tab settled from a phone closes at the till by itself once the provider confirms (§02)
- Refunds issued by a manager from the desk, back through the provider, following the cancellation policy, with actor and reason in the audit log (§02)
- Day close shows cash, card at the desk and online as separate lines (§02) — the panel's report line and the reconciliation to the provider's report are panel → *Online, branch & shop reports*

*Done when* a court paid in the app shows at the desk as paid online, a refund returns through the provider, a cafe tab settled from a phone closes at the till, and the day close shows online payments as their own line. (§02 acceptance)

### 3.3 Coaching, matches & tournaments — M12, M13, M14, staff side · 25 %
- **M12:** coach profiles (name, photograph, bio, languages, English and Arabic); weekly availability with days off and exceptions, managed by staff; lessons booked at the desk, each holding its court in the Phase 1 reservation table, with coach time protected so one coach cannot be booked twice; prices per coach and length with peak and off-peak through the Phase 1 rate rules; cancellation window and no-shows as for courts (§03)
- **M12:** group courses with a start date, weekly sessions, capacity and price; enrolment at the desk, the desk can add, move or remove a student; course sessions hold their courts for the whole run as a staff series; attendance marked per session by the coach or the desk (§03)
- **M12:** a commission rule per coach (percentage or fixed per session); a settlement report per coach for any period; a settlement marked paid with date and method and settled sessions locked; CSV export (§03)
- **M13:** the desk sees each open match on the calendar with its seats and who has paid; a seat's share is taken at the desk (§04)
- **M14:** tournaments set up by staff (dates, categories, entry fee, capacity, registration deadline); knockout, groups then knockout, Americano; pair registration at the desk; draw and fixtures with seeding set by staff, each fixture holding its court; scores entered at the desk advance the bracket and group tables; leagues with standings and points rules per league (§05)

*Done when* a lesson with a chosen coach appears on the desk calendar and neither court nor coach can be double-booked, a course refuses enrolment once full, a settlement for a period matches the sessions delivered, an open match shows on the calendar full and paid and the venue's cutoff rule applies when one does not fill, and a tournament's draw places fixtures on courts and advances as scores are entered, with a league's standings updating as results come in. (§03, §04, §05 acceptance)

### 3.4 Shop & loyalty — M15, M16 · 14 %
- **M15:** product catalogue (rackets, balls, grips, apparel, accessories; photo, price, cost, category, barcode) with variants each having its own price and stock; sold at the till in the same basket as cafe items and court bookings, in one payment; USB barcode scanning; stock as an append-only ledger (goods received, sales, returns, count adjustments); low-stock alerts and a reorder level; returns and exchanges by a manager reversing the stock movement (§06) — the panel's shop line is panel → *Online, branch & shop reports*
- **M16:** the QR scanned at the desk or till by camera or USB scanner; one earn rate set by the venue across courts, lessons, cafe and shop; points credited when the bill is paid and taken back on refund; a short list of rewards redeemed by scanning; optional expiry; every earn, redemption and adjustment recorded, adjustments needing a manager PIN and a reason; earn and redeem at every branch (§07)

*Done when* a racket and a drink are sold in one basket and the racket's stock falls by one, a return puts it back, a paid bill earns the set points and a refund takes them back, and a reward is redeemed by scanning a guest's QR. (§06, §07 acceptance)

### 3.5 AI stock intake — M18, desktop side · 8 %
- Upload a photo or PDF in the desktop app; printed receipts and invoices in Arabic and English; supplier, date, invoice number and each line's item, quantity, unit, unit price and total read; each line matched to an ingredient or shop product, remembering each supplier's wording once a match is confirmed; packs converted into stock units (§09)
- A review screen with every field editable, unmatched lines highlighted and the total checked against the receipt; on confirmation, goods-received entries with cost and expiry batch, new costs flowing into margin; the receipt image kept with the delivery and a warning when the same invoice is entered twice (§09)
- The AI provider integration for intake — the account is Touch's (§12, §14)

*Done when* printed receipts in Arabic and in English are photographed, read and matched, staff confirm them and goods-received entries with cost and expiry appear in stock, and the same receipt entered twice is flagged. (§09 acceptance)

### 3.6 Safeguards & training exam — additions 1 and 3, Operator side · 9 %
- **Addition 1 (2026-09-29):** the Operator's windows protected against capture where the OS allows (excluded from capture on the Windows till and desk machines; elsewhere detected and hidden while recording); every attempt written to the audit log with who, when, device and screen
- **Addition 3 (2026-09-29):** the full training exam built into the Operator — a graded exam per role, English and Arabic, each result saved per person and visible to managers and the owner

*Done when* a capture attempt on a till machine is stopped or hidden and appears in the audit log, and a member of staff can sit the exam for their role in their own language and their result is saved and shows for the manager.

### 3.7 Design & launch · 14 %
- Product design and interface for the extension's Operator screens, both languages and both directions (§14)
- Remote training for the new and changed roles, recorded in both languages; the runbook, staff guide and technical handover updated (§14)
- Defect fixing against the desk-side modules' acceptance tests (§13)
- **Gate, not weighted:** the five consecutive operating days

*Done when* each module's acceptance test has been shown to Mustafa, the training is recorded in both languages, the runbook and staff guide are updated, and the five-day run has finished with no unresolved major issue.

---

## 4 · Column: Website (6) — target 2026-11-03 build · 2026-11-10 close

### 4.1 Pay the tab — M11, web · 45 % of the column
- Settle the table's open cafe tab from the phone, in full, from the same page the guest ordered on; the tab closes at the till by itself once the provider confirms (§02)

*Done when* a cafe tab is settled from a phone and closes at the till with nobody at the desk doing anything.

### 4.2 Branches on the site — M17, web · 30 %
- Each branch has its own venue page and table codes on the website; prices and availability set once or per branch, as the guest sees them (§08)

*Done when* a table code at each of two branches opens the menu as that branch offers it and an order lands on that branch's kitchen screen.

### 4.3 Design & launch · 25 %
- Design in both languages and directions for the payment step and the branch pages (§14); live on Touch's domain; fixes against the five-day run

---

## 5 · Column: Management panel (15) — target 2026-11-03 build · 2026-11-10 close

### 5.1 Online, branch & shop reports — M11, M17, M15 · 30 % of the column
- Cash, card at the desk and online as separate lines in the panel; online payments reconciled against the provider's settlement report (§02)
- The panel filters by branch and shows branches side by side and combined; each branch reconciles to its own day close (§08)
- Shop sales, cost and margin on their own line, separately from padel and cafe (§06)

*Done when* online payments reconcile to the provider's report, the owner's panel shows each branch and a combined total that agrees with each branch's day close, and shop sales and margin have a line of their own.

### 5.2 Assistant — M19 · 40 %
- An assistant in the panel for the owner and managers; questions in plain English or Arabic; answers built from the panel's own figures with every figure linked to the report or transactions behind it; branch-aware (one, several or all); permissions respected; every question and answer logged; guest contact details never sent to the AI provider; a weekly written review for the owner (§10)
- The AI provider integration — the account is Touch's (§12, §14)

*Done when* ten test questions agreed with Touch are answered in each language with figures that match the panel, a manager is refused data outside their branches, and the weekly review is produced for a trading week. (§10 acceptance)

### 5.3 Screenshots in the log — addition 1, the view · 10 %
- Every screenshot or capture attempt, from a phone or the Operator, visible in the audit-log view in Staff activity with who, when, device and screen

*Done when* a screenshot attempt on a phone and one on a till machine each appear in the log with the right person, device and screen.

### 5.4 Design & launch · 20 %
- Design in both languages and directions for the new reports and the assistant (§14); the reconciliation of online payments and the ten agreed test questions shown to Mustafa; fixes against the five-day run

---

## 6 · Where cross-cutting work is counted

| Scope item | Source | Counted in |
|---|---|---|
| Payment provider integration on the server; verified-once confirmations | §02 | desktop → Payments & refunds |
| Merchant account approval; test environment → live keys | §02 box, §13 | not build scope — "waits on Touch"; stated in mobile → Pay in the app |
| Branch scoping of every table (week 1) | §13 box | desktop → Branches & stock — **once** |
| Branch-aware reports | §08 | panel → Online, branch & shop reports |
| Coach and Marketing accounts; seven roles | §01 | desktop → Branches & stock; the roles' screens are mobile → Lessons… (coach) and Protocols & checklists (marketing) |
| Audit-log **writer** for capture attempts / its **view** | addition 1 | mobile → Staff tools and desktop → Safeguards & training exam / panel → Screenshots in the log |
| AI provider integration (intake / assistant) | §12, §14 | desktop → AI stock intake / panel → Assistant |
| English / Arabic / right-to-left for every new screen, notification and receipt | §00 (carries over from Phase 1 §03) | each column's Design & launch |
| Product design and interface for the ten modules | §14 | each column's Design & launch |
| Store submission under Touch's accounts; store review | §14, §12 | mobile → Design & launch |
| Remote training for new and changed roles, recorded EN/AR | §14 | desktop → Design & launch |
| Runbook, staff guide, technical handover updates | §14 | desktop → Design & launch |
| Defect fixing against module acceptance tests | §13 | each column's last level, for its own modules |
| **Five consecutive operating days** | §13 | **not weighted** — the completion gate of every column's last level |
| Weekly demonstrations | §13 | process, not scope — timeline markers only (file §9) |
| Automated tests and code review | §14 | inside each feature level |
| Payment fees, AI usage, Supabase, USB scanners, hardware, UPS, translation, photography | §12, §14 | not Kagu scope — never weighted |
| Warranty (90 days from acceptance), support, ownership | §00, §14 | reference only (§13 below) |

---

## 7 · Completeness check — every module, item by item

| Module | Items | Level(s) |
|---|---|---|
| **M11 Online & in-app payment** (§02) | provider, card/wallet, hosted checkout, confirmations verified once | desktop → Payments & refunds (server) · mobile → Pay in the app · web → Pay the tab |
| | in the app: court, lesson/course, match seat, tournament entry; slot hold; receipts | mobile → Pay in the app |
| | on the website: settle the tab; it closes at the till | web → Pay the tab (+ desktop → Payments & refunds for the till side) |
| | pay-mode per kind of item; marked paid online; refunds; day-close lines | desktop → Payments & refunds |
| | online line and reconciliation to the provider's report | panel → Online, branch & shop reports |
| **M12 Coaching & courses** (§03) | profiles, availability, lessons, prices, courses, attendance, commission, settlement, CSV | desktop → Coaching, matches & tournaments |
| | guest booking and enrolment; coach accounts | mobile → Lessons, matches & tournaments |
| **M13 Open matches** (§04) | open/join/list/leave/remove, split, cutoff, notifications | mobile → Lessons, matches & tournaments |
| | the desk sees seats and who has paid | desktop → Coaching, matches & tournaments |
| **M14 Tournaments & leagues** (§05) | setup, formats, draw and fixtures on courts, scores, leagues | desktop → Coaching, matches & tournaments |
| | pair registration and brackets in the app | mobile → Lessons, matches & tournaments |
| **M15 Touch Shop** (§06) | catalogue, variants, till basket, scanner, ledger, alerts, returns | desktop → Shop & loyalty |
| | shop sales, cost and margin line | panel → Online, branch & shop reports |
| **M16 Loyalty** (§07) | QR, balance and history in the app | mobile → Points & branches |
| | scan, earn rate, credit/take back, rewards, expiry, PIN adjustments | desktop → Shop & loyalty |
| **M17 Multi-branch** (§08) | branches, per-branch config, staff, RLS, stock, transfers, day close, outage lock | desktop → Branches & stock |
| | guests choose a branch | mobile → Points & branches |
| | venue page and table codes per branch | web → Branches on the site |
| | filters, side by side, combined | panel → Online, branch & shop reports |
| **M18 AI stock intake** (§09) | capture with the phone camera | mobile → Staff tools |
| | upload, read, match, convert, review, confirm, duplicate warning | desktop → AI stock intake |
| **M19 AI analysis** (§10) | the assistant, weekly review, permissions, logging | panel → Assistant |
| **M20 Protocols & checklists** (§11) | everything | mobile → Protocols & checklists (Marketing account: desktop → Branches & stock) |
| **Addition 1** | capture protection and its log: phone / Operator / view | mobile → Staff tools / desktop → Safeguards & training exam / panel → Screenshots in the log |
| **Addition 2** | the assistant on owners' and managers' phones | mobile → Staff tools |
| **Addition 3** | the training exam | desktop → Safeguards & training exam |
| **Removed** | Customer 360 | — (appears nowhere) |

**Roles after the extension** (§01): **Reception** books lessons, courses, open matches and tournament fixtures on the same calendar, scans the loyalty QR and sees whether a booking was paid online → desktop → Coaching…, Shop & loyalty, Payments & refunds. **Cashier** sells shop products in the same basket, scans the QR and redeems rewards, and sees tabs paid from the web → desktop → Shop & loyalty, Payments & refunds. **Kitchen** sees only its own branch → desktop → Branches & stock. **Manager** refunds online payments, runs coach settlements, AI stock intake and branch transfers, holds steps in protocol routes, sets checklists and uses the assistant for their own branches → desktop → Payments & refunds, Coaching…, AI stock intake, Branches & stock; mobile → Protocols & checklists, Staff tools; panel → Assistant. **Owner** has everything above across every branch, plus branch setup, protocol routes and the assistant for the whole business → the same levels. **Coach** (new) signs in to the phone app for their own schedule, sessions and students, with no till, stock or reports → mobile → Lessons…. **Marketing** (new) holds steps in protocol routes and uses the staff section, with no till, stock or financial reports → mobile → Protocols & checklists. Both accounts are set up under desktop → Branches & stock. "Permissions stay enforced in the database, as in Phase 1."

**Phase 1 lines this extension replaces** (§01) are statements about scope, not work: payment at the desk only → M11; no payment SDK → one provider's checkout; the app carries padel only → the app also carries lessons, matches, tournaments, the loyalty QR and a staff-only section; one venue → branches; stock at one location → per branch with transfers; five roles → seven; later phases → in the extension; Customer 360 → removed.

---

## 8 · What Touch must provide (§12) — and which level it blocks

"Kagu works remotely, and everything below is client-side. The build is four weeks, so a week's delay here is a week off the end" (§12). The *Blocks* column is this file's derivation, not scope wording. *By* counts the PDF's weeks from signing on 2026-09-25 (week 1 ends 2 Oct, week 2 ends 9 Oct, week 3 ends 16 Oct, week 5 ends 30 Oct, counting seven days a week) — derived, and see file §14 Q7.

| Item | Needed by | Consequence if late (scope wording) | Blocks (derived) |
|---|---|---|---|
| First installment | ~~On signing~~ **30 Oct 2026** — nothing is due on signing (agreed 2026-09-29) | PDF wording: "The build begins on receipt, not before" — does not appear to apply any more, see file §14 Q3 | nothing, as far as anyone has said |
| Named approver available weekly | Throughout | Acceptance cannot be signed | every Design & launch |
| Payment provider chosen and merchant application submitted | Week 1 (2 Oct) | Module 11 runs on the test environment only | mobile → Pay in the app · web → Pay the tab · desktop → Payments & refunds · panel → Online, branch & shop reports |
| AI provider account opened and funded in Touch's name | Week 1 | Modules 18 and 19 cannot go live | desktop → AI stock intake · panel → Assistant · mobile → Staff tools |
| Branch details: address, hours, courts, tables, rates, staff for every branch | Week 1 | Module 17 is tested on a sample branch only | desktop → Branches & stock · web → Branches on the site |
| Protocol types with their form fields and routes, and the first checklists | Week 1 | Module 20 ships with the example route only | mobile → Protocols & checklists |
| Twenty or more real supplier receipts | Week 1 | Module 18 is tuned on generic receipts and matches less well at launch | desktop → AI stock intake |
| Coach profiles, photos, availability, prices and commission rules | Week 1 | Module 12 cannot be configured | desktop → Coaching, matches & tournaments · mobile → Lessons, matches & tournaments |
| Shop catalogue: products, variants, prices, costs, barcodes, opening stock | Week 2 (9 Oct) | The shop opens with an empty catalogue | desktop → Shop & loyalty |
| Loyalty earn rate and reward list | Week 2 | Module 16 cannot be switched on | desktop → Shop & loyalty · mobile → Points & branches |
| First tournament and league formats | Week 2 | Module 14 is demonstrated with sample events | desktop → Coaching, matches & tournaments |
| English and Arabic copy for all new content | Week 2 | The Arabic build cannot be accepted | every Design & launch |
| Coach and Marketing staff named, for accounts | Week 3 (16 Oct) | Accounts cannot be created for training | desktop → Branches & stock · Design & launch |
| Hardware and USB scanners in place at every branch | Week 3 | Installation and testing cannot proceed | desktop → Branches & stock · Shop & loyalty |
| Staff available for training | Week 5 (30 Oct) | Handover is incomplete | desktop → Design & launch (and the training exam) |

Touch also carries, outside the fee (§12, §14): the payment provider's per-transaction fees; AI provider usage ($15–50 a month, for one or two branches); Supabase (from $25 a month, growing with branches and stored receipt images); USB barcode scanners, once per till; hardware for new branches and the recommended UPS; translation, copywriting and photography including coach and product photos. Signing was the written approval Phase 1 §14 requires for these services. Website hosting, the build service and error tracking stay with Kagu, and no further paid service is added without Touch's written approval.

---

## 9 · Timeline

**Agreed dates (2026-09-29)** — signed 2026-09-25 · mobile build sent to store review by **2026-10-13** · everything else due **2026-11-03** · store review estimated at three to four weeks after submission (roughly 3 to 10 November) · every *Design & launch*, and the project, close on **2026-11-10**.

| Level(s) | `target_on` |
|---|---|
| Mobile app — Pay in the app, Lessons, matches & tournaments, Points & branches, Protocols & checklists, Staff tools | 2026-10-13 |
| Desktop app — every level but Design & launch · Website — Pay the tab, Branches on the site · Panel — Online, branch & shop reports, Assistant, Screenshots in the log | 2026-11-03 |
| Every Design & launch · the four column rows · the project's `due_on` | 2026-11-10 |

**The PDF's weekly demonstration list stays as the order of work** (§13); the calendar above is the one agreed later, which is shorter for the mobile app and different in shape from the PDF's 4 + 3–4 weeks (file §14 Q7):

| PDF week | Demonstration milestone (§13) | Levels |
|---|---|---|
| 1 | Branch model across the system, payment on the provider's test environment, protocols and checklists | desktop → Branches & stock; desktop → Payments & refunds (test env); mobile → Protocols & checklists |
| 2 | In-app and web payment end to end, coaching and courses, loyalty QR | mobile → Pay in the app; web → Pay the tab; desktop/mobile → Coaching, Lessons; mobile → Points & branches (QR) |
| 3 | Open matches, tournaments and leagues, Touch Shop, stock per branch and transfers | mobile/desktop → Lessons, matches & tournaments; desktop → Coaching…, Shop & loyalty, Branches & stock |
| 4 | AI stock intake, AI analysis, integrated beta, store submission | desktop → AI stock intake; panel → Assistant; mobile → Staff tools, Design & launch |
| 5–8 | Store review, real-world testing, fixes, training, handover and acceptance | every Design & launch |

---

## 10 · Priority order if the window tightens (§13) → levels

Nothing leaves the extension: late work stays in it at the agreed price; this is only the order in which modules are completed.

| # | Module | Level(s) |
|---|---|---|
| 01 | Online and in-app payment | mobile → Pay in the app · desktop → Payments & refunds · web → Pay the tab · panel → Online, branch & shop reports (the online lines) |
| 02 | Multi-branch model and stock per branch | desktop → Branches & stock · web → Branches on the site · mobile → Points & branches (branch chooser) · panel → Online, branch & shop reports (branch views) |
| 03 | Protocols and checklists | mobile → Protocols & checklists |
| 04 | Coaching and courses | desktop → Coaching, matches & tournaments · mobile → Lessons, matches & tournaments |
| 05 | Open matches | mobile → Lessons, matches & tournaments · desktop → Coaching, matches & tournaments (the calendar view) |
| 06 | Loyalty | mobile → Points & branches · desktop → Shop & loyalty (the till half) |
| 07 | Touch Shop | desktop → Shop & loyalty · panel → Online, branch & shop reports (the shop line) |
| 08 | Tournaments and leagues | desktop → Coaching, matches & tournaments · mobile → Lessons, matches & tournaments |
| 09 | AI stock intake | desktop → AI stock intake · mobile → Staff tools (capture) |
| 10 | AI analysis | panel → Assistant · mobile → Staff tools (the phone) |

The three 2026-09-29 additions have no place in the PDF's list (file §14 Q11).

---

## 11 · Acceptance — what "100 %" means (§13)

**The production run.** Each module's acceptance test is demonstrated to Mustafa, and the venue trades on the complete system for **five consecutive operating days with no unresolved major issue**, using the Phase 1 definitions of operating day, major issue and restart (§13, §00). In the progress view the run is not a weighted level: it is the gate on the last level of every column — none of the four *Design & launch* levels reaches 100 until the run is complete.

**Acceptance is not withheld** for anything listed as not included, store review timing, the provider's approval of Touch's merchant account, or an AI provider outage. The mobile app is accepted on submission of a working build, not on store approval. The 90-day warranty starts at acceptance (§13).

| Module | Acceptance test (§) | Proven by |
|---|---|---|
| M11 | A guest pays for a court in the app and the desk shows it paid; a failed payment releases the slot; a cafe tab is settled from a phone and closes at the till; a refund returns through the provider; the day close reconciles online payments to the provider's report | mobile → Pay in the app · web → Pay the tab · desktop → Payments & refunds · panel → Online, branch & shop reports |
| M12 | A guest books a lesson with a chosen coach and it appears on the desk calendar; neither court nor coach can be double-booked; a course fills to capacity and refuses the next enrolment; a coach sees their own schedule; a settlement for a period matches the sessions delivered | desktop → Coaching… · mobile → Lessons… |
| M13 | A guest opens a match with three free seats, three others join and each pays their share, the desk calendar shows it full and paid, and the cutoff rule applies as set when a match does not fill | mobile → Lessons… · desktop → Coaching… |
| M14 | Staff create a tournament, pairs register and pay, the draw places fixtures on courts without clashing with bookings, scores entered at the desk advance the bracket, and a league's standings update | desktop → Coaching… · mobile → Lessons… |
| M15 | A racket and a drink are sold in one basket, the racket's stock falls by one, a return puts it back, and shop sales and margin appear on their own line | desktop → Shop & loyalty · panel → Online, branch & shop reports |
| M16 | A guest's QR is scanned at the till, the paid bill earns the set points, the balance shows in the app, a reward is redeemed by scanning, and a refund takes the points back | mobile → Points & branches · desktop → Shop & loyalty |
| M17 | A second branch is set up with its own courts, tables and stock; its staff see only that branch; a guest books at either branch; a transfer leaves one branch's stock and arrives in the other's; the owner's panel shows each branch and the combined total, reconciling to each branch's day close | desktop → Branches & stock · mobile → Points & branches · web → Branches on the site · panel → Online, branch & shop reports |
| M18 | Printed receipts in Arabic and English are photographed, read and matched; after staff confirm, goods-received entries with cost and expiry appear in stock; the same receipt entered twice is flagged | mobile → Staff tools · desktop → AI stock intake |
| M19 | Ten test questions agreed with Touch are answered in each language with figures that match the panel, a manager is refused data outside their branches, and the weekly review is produced for a trading week | panel → Assistant |
| M20 | A member of staff raises a request and it travels its full route, including a return to the proposer, with each holder notified; a send-back and a rejection each work with the comment recorded; a daily checklist is completed with each tick stamped and visible to the manager | mobile → Protocols & checklists |
| Additions | *Done-when* lines in file §2.5, §3.6 and §5.3 (no acceptance test exists in the PDF) | mobile → Staff tools · desktop → Safeguards & training exam · panel → Screenshots in the log |

**What would extend the window** (§13): an item in §12 arriving after the week shown; a change request accepted mid-extension; more than one store rejection, or a review beyond four weeks; an installment more than 14 days late; major issues found during the five-day run. **Change control** is Phase 1 §16: any request that adds to, removes from or alters what is written is recorded in writing with its effect on the date and the fee, and approved by Touch or deferred before work begins.

---

## 12 · Out of scope — master list (never counted anywhere)

From §01 "Still out of scope", every module's "not included" box, and the additions:

- Full offline operation from a local on-premises database; PostHog or any behavioural analytics pipeline (§01)
- Purchase orders and supplier management — goods received only; supplier accounts or supplier payments (§01, M15, M18)
- Loyalty tiers, levels or status; **Customer 360 in any form — removed from the roadmap, and not planned as a later phase** (§01, M16)
- A dual-currency till; a third interface language; accounting-system integration beyond CSV (§01)
- Forecasting, predictions, predictive analytics and automated decisions; AI that changes data, prices or settings; questions about anything the system does not hold; sending the weekly review by email or WhatsApp; any guest-facing AI (§01, M19)
- **M11:** Apple or Google in-app purchase and RevenueCat; more than one provider, or changing provider after week 1; deposits and part payments; stored cards, wallets or credit balances held by Touch; splitting a cafe tab between guests on the web; tipping, and buying shop products online; payment in a second currency
- **M12:** paying coaches (the system records, the money moves outside it); payroll, contracts, tax or employment records; coaches editing their own availability or prices; lesson packs, memberships and prepaid bundles; waiting lists for full courses; ratings and reviews, training plans or video analysis
- **M13:** automatic ratings, rankings or matchmaking; chat, friends lists or social feeds; uneven splits, or one player paying for others; open matches visible to people without an account
- **M14:** scores entered by players, and score disputes; rankings across tournaments; prize money, sponsorship or ticketing; tournament pages on the website, screens or streaming at the venue; competitions shared with other clubs
- **M15:** selling shop products in the app or on the website; racket rental, restringing and repair jobs; gift cards, consignment stock, serial-number tracking
- **M16:** referrals, birthday bonuses, streaks or challenges; physical cards, Apple and Google Wallet passes; points for spend made before the module goes live
- **M17:** separate companies, currencies or tax setups per branch; a central warehouse that is not a branch, or automatic replenishment between branches; separate brands, franchising or white-label copies; hardware at new branches and on-site installation; setting up branches beyond those listed in §12 (the process is documented so Touch can add them, or Kagu can as a change request)
- **M18:** entry into stock without a person confirming it; guaranteed reading of handwritten receipts; reading expiry dates from product packaging
- **M20:** conditional or parallel routes, deadlines and automatic escalation; requests from guests; chat between staff beyond the comment on each step; photo proof on checklist items, and scoring or ranking staff; protocols on the website or in the desktop app
- **Screenshot protection (addition 1):** the website; stopping someone photographing a screen with another device; a guarantee that a screenshot is *blocked* on iPhone or macOS, where it is detected, logged and hidden while recording
- **Not in the fee** (§14): payment provider fees and AI usage; Supabase and the domain; hardware for new branches, barcode scanners and the recommended UPS; translation, copywriting and photography, including coach and product photos
- Anything not written in the document (§00) — except the three additions

---

## 13 · Commercial, warranty and ownership — reference only

Not part of the progress arithmetic; recorded so the portal's finance page and the drawer copy agree with the deal.

- **Fee $5,600**, US dollars, for the extension only (agreed 2026-09-29; the PDF's own fee pages read $5,250 and $5,000 — file §14 Q1). **Four monthly installments, starting 2026-10-30** — $1,500 on 30 Oct, $1,500 on 30 Nov, $1,500 on 30 Dec 2026, $1,100 on 30 Jan 2027 — and **nothing on signing**, which corrects the PDF's "$1,500 on signing … the build begins on receipt, not before" (file §14 Q3). Installments follow the calendar, not the delivery milestones.
- **If an installment is more than 14 days late**, work on the extension pauses until it is paid and every date in the document moves by the length of the pause; critical support for the system already trading continues regardless (§14).
- **Phase 1 is separate**: its fee and final payment are unchanged and fall due on Phase 1's own acceptance (§00, §14).
- **In the fee** (§14): product design and interface for the ten modules in both languages and directions; all engineering, automated tests and code review; the ten modules in full; integration with the payment provider and the AI provider; store submission of the updated app under Touch's developer accounts; remote training for new and changed roles, recorded in both languages; runbook, staff guide and technical handover updates; the 90-day defect warranty with the Phase 1 response times.
- **Warranty, support, ownership** carry over from Phase 1 §17: 90 days from the extension's acceptance, the same response times and WhatsApp group; Touch owns everything built.
- **The agreement** (§15): the ten modules delivered in full for the §14 fee; everything not included excluded from the extension and its fee; Customer 360 removed from the roadmap; Phase 1 v2.0 continues as signed except the lines replaced in §01; Touch supplies the §12 items by the weeks shown; four weeks of build and three to four for review, beginning on signing and receipt of the first installment (the PDF's wording; the first payment is now 30 Oct, file §14 Q3); real-world services paid through one payment provider, never through Apple or Google in-app purchase. Signatories: Mustafa for Touch Padel; Parsa for Kagu Software.
- **Document control**: v1.0 for signature, extends Phase 1 v2.0; where the two disagree about the extension, the extension governs. Approver: Mustafa (§00).

---

## 14 · Open questions and assumptions found while building this

None changes the level structure; each needs a sentence agreed before the drawer copy is final or the paper trail is tidy.

1. **The fee on paper.** The PDF as attached has two "Commercial terms" pages that disagree — **$5,250** (1,500 · 1,500 · 1,500 · 750) and **$5,000** (… · 500) — and lists neither the three additions nor $5,600; both show $1,500 on signing, which is no longer the deal. The agreed fee is **$5,600**, first paid on **30 Oct**. If a v1.1 was signed, nothing is wrong; if the signed paper is v1.0, it does not match the portal.
2. **The schedule is derived.** Three payments of $1,500 and a last of $1,100 ($5,600 − 3 × $1,500), on the 30th of four consecutive months from 30 Oct. Only "$1,500 a month", "$5,600" and "first payment 30 Oct" were stated; the count, the $1,100 and the 30th of each month are mine. Confirm.
3. **Nothing is due on signing, so the PDF's start rule no longer applies.** §14 says the build begins on receipt of the first installment, not before; with the first payment on 30 Oct and the mobile build due 13 Oct, work cannot be waiting on it. Worth a line in writing, together with whether the 14-day late-payment pause now runs from the new dates. No installment is marked paid.
4. **"Admins" = owner and managers.** Addition 2 is read as the two roles §01 gives the assistant to; a manager is limited to their own branches. Confirm no other role is meant.
5. **Screenshot protection is what the operating systems allow** (addition 1, as approved): blocked on Android and on the Windows till and desk machines; detected — not blocked — on iPhone and macOS, with the content hidden while recording. Not possible on the website. Touch should hear this before it hears "screenshot protection".
6. **The exam** (addition 3) is built into the Operator, graded per role, in both languages, with results saved per person for managers and the owner. **Undecided:** which roles sit which exam (Coach and Marketing do not use the Operator), the pass mark, retakes, whether a pass gates anything, and who writes the questions.
7. **Two timelines.** The PDF promises four weeks of build and three to four of review from signing (build to about 23 Oct, close 13–20 Nov). The dates given on 2026-09-29 are different in shape — mobile to review by 13 Oct, the rest by 3 Nov, close 10 Nov. The portal uses the agreed dates; the PDF's *Week n* input deadlines in file §8 are counted from signing, so several fall due within days of this being written.
8. **This work does not touch Phase 1.** Its `due_on` is still 2026-09-25 (past), and its installments are still $2,000 "one month after the start date" (due 2026-09-25, still *scheduled*) and $3,000 on delivery (dated 2026-10-15). If the extended deadline is meant to move Phase 1 too, that is a separate edit. (Phase 1's plan has been updated by the producer since this was seeded — most levels marked done on 2026-09-29 — which is theirs, not part of this work.)
9. **Some of the extension is already built** in the product repository — multi-branch is live, the Touch Shop is built, the staff-phone protocols section exists, the assistant is built and switched off — and M20 "began during the Phase 1 build" (§11 box). Every bar starts at 0 anyway.
10. **The product repo's change order is out of step** with the signed extension: `docs/scope/phase2-change-order-2026-09-21.md` (last revised 2026-09-27) still lists AI receipt scanning as deferred and AI analysis as dropped, has blank fees and signatures, and redesigns open matches around a reusable ticket paid at the desk, where the PDF says each player pays their share online or at the desk (§04). Not changed by this work.
11. **The priority list (§13) has no slot for the three additions.**
12. **No input pack (decided 2026-09-29).** The producer asked for none: the extension has no inputs to collect. It is stored as `intake_pack = 'none'`, which the portal understands from the code change that adds `hasPack()` (`src/lib/intake.ts`): the project form offers "No input pack", the sidebar no longer counts the project, the dashboard and Progress pack panels and the Inputs pages skip it, and the "inputs reminder" email refuses it. PDF §12 ("What Touch must provide") remains the list of what Touch owes, tracked by hand rather than in a pack.

---

## 15 · Mapping onto KaguOs

**Rows.** Project `Touch Padel · Extension` — `1349bd84-77df-46d9-9752-6f1917594a76` (client `Touch Padel`, status active, `due_on` 2026-11-10). One plan, `Extension fee` (`installments`, USD, 2026-10-30 → 2027-01-30, four payments, `amount_each` null so the page says "4 payments" rather than "4 payments of $1,500"). Four top-level phases (the columns, weights 30 · 49 · 6 · 15, sorts 10–40) and twenty sub-phases at seeding (the levels, weights a share of the column, summing to 100 in each). `visible_to_client` true throughout; `completion` 0 and `status` planned everywhere; `completion` is hand-set on level rows only — column rows are computed by the 0078 rollup.

**The progress view** needs no code change: `columnar()` (client portal, progress page) renders any plan with 2–6 top-level phases that each have steps as columns, and the portal already lists every project a client is linked to. The client sees two sections — `Touch Padel` and `Touch Padel · Extension` — on Progress, Finance and the dashboard.

**Publishing.** A project is visible to Touch when a client login is linked to it in `client_projects` (Admin page, or the insert in the header of migration 0086). Touch's login was linked on 2026-09-29 at 17:01 UTC, by the producer, not by this work. There is no input pack (file §14 Q12), so once the `hasPack()` change is deployed the client sees no pack panel, no Inputs entry for this project and no extra "pack to finish"; until then the portal still reads `'none'` as the general pack.

**Applied.** The data was written to prod on 2026-09-29 by REST inserts with the service-role key, row for row as `0086_touch_padel_extension.sql` describes it, because the Management API token was still expired and no Supabase connector was available. The file is replay-safe (it finds the project by name and inserts nothing twice) but its history row is **not** stamped. Verified after applying: one project, one plan, four installments totalling 5,600, four systems weighing 100, twenty levels each column summing to 100, everything 0 / planned, `columnar()` true, no client linked at that moment, and Phase 1's rows byte-identical to a snapshot taken before (checked straight after applying; any later difference is the producer's own edits). The payment rows were then corrected in place the same day — nothing on signing, first payment 30 Oct — and the file regenerated to match; nothing else in prod was rewritten by this work. The file was also run in an in-memory Postgres against the real milestone triggers: a fresh run, replays, and a replay after a level was removed and re-weighted and a payment marked paid all pass without changing anything. Later the same day twelve drawer texts were corrected after a review by a second reader (an "offline mode" that should have read "degraded mode", a per-branch menu that the PDF makes one shared menu, capture and exam wording, and Done-when lines that needed work from another system), only on rows still identical to the seed; and `intake_pack` was set to `'none'`.

**Since seeding (2026-09-29).** The producer has edited the plan in the editor: `Website → Pay the tab` was removed and `Branches on the site` set to 75, so prod has 19 levels and the Website column has two. This file and migration 0086 describe the *seed*; file §4.1, the M11 rows of file §7, §10 and §11, the Website column text and the desktop *Payments & refunds* text still show the tab payment until it is confirmed whether it left the scope or only the plan. Prod is authoritative.
