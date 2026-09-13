/**
 * Kagu Digital Marketing — the trainee curriculum for a new marketing hire,
 * seeded as a 90-day sprint. The source is the syllabus document at
 * `public/learn/kagu-digital-marketing.html`; everything below is taken from it.
 *
 * How the document maps onto a sprint, and why:
 *
 * - Module 00 ("How to use this") is the program's study rules, not a stage.
 *   Stage nodes number themselves from 01, so keeping 00 as a stage would put
 *   Meta Ads (module 04) under a node reading 05, beside a syllabus that says 04.
 * - Modules 01–14 are the fourteen stages, in order. "You must be able to
 *   explain" bullets are the goals: a short title, the bullet word for word as
 *   the detail. Modules 13 and 14 have no such list, so their goals are the
 *   module's own headings and certification rows.
 * - Key facts, tables, callouts and the Türkiye panels live in each stage's
 *   `detail`, one paragraph per fact or table row — detail renders paragraphs
 *   and nothing richer.
 * - Days come from the 90-day path. A row that covers several modules gives each
 *   of them its whole range rather than an invented split. Module 13 is
 *   "ongoing" and module 14 isn't in the path, so both are undated.
 * - Proofs are the 90-day path's "what you do" tasks. Modules 07, 11 and 13 have
 *   no task there, so they clear on their goals alone.
 * - The myths table and the maintenance note stay in the document, which is the
 *   first resource on the sprint's shelf.
 */
import type { ProgramSeed } from "../seed-learn-levels";

/** A stage's detail, one argument per paragraph. */
const paras = (...paragraphs: string[]) => paragraphs.join("\n\n");

export const DIGITAL_MARKETING: ProgramSeed = {
  title: "Kagu Digital Marketing",
  tagline: "From zero to agency-ready media buyer",
  description:
    "Everything a new Kagu marketing hire needs to learn, in the order they should learn it. Every link is free — no paid courses, no paid tools, no gated downloads. Written for the Turkish market: the platforms, the tax stack, and the advertising law that actually applies here. Fourteen stages over 90 days, ending in running a client alone.",
  outro:
    "Module 13 is not a one-off. Re-read the disclosure rules before every creator brief and the tax table before every billing conversation.",
  days: 90,
  syllabus: {
    title: "Kagu Digital Marketing syllabus (full document)",
    url: "/learn/kagu-digital-marketing.html",
  },

  stages: [
    /* ------------------------------------------------------------------ 01 */
    {
      title: "The language of performance",
      summary:
        "Every metric below is derived from the one above it. Learn them as a chain, not as a glossary. You should be able to write each formula from memory by the end of week one.",
      detail: paras(
        "CPC = CPM ÷ (CTR × 1,000) · CPA = CPM ÷ (1,000 × CTR × CVR) · Revenue = Impressions × CTR × CVR × AOV. Memorise these. Every performance problem you will ever diagnose is one of those four terms moving. CPC never rises for a mystery third reason — either CPM went up or CTR went down.",
        "Break-even ROAS — 1 ÷ gross margin %. A 40% margin means break-even is 2.5×. Compute this for every client on day one.",
        "Healthy MER band — DTC target cited for 2026 is 3.0–5.0× total revenue ÷ total marketing spend. Immune to attribution games.",
        "Social vs search CVR — paid social converts at ~1.5%, paid search at ~3.2%. Colder traffic, lower intent. Prepare for that client conversation.",
        "Landing page median — 6.6% across all industries (Unbounce, 464M visits). Ecommerce ~2.35%; B2B services 1–3%.",
        "Where to start: Fundamentals of Digital Marketing is the correct starting point for an absolute beginner — free, certified, and it covers this vocabulary properly. Google Digital Garage no longer exists; it folded into Skillshop, and old learndigital.withgoogle.com links are dead. Watch Ben Heath's playbook early even though it is a Meta video: it sets the modern mental model — consolidation, broad targeting, creative as targeting — before you pick up legacy habits from older tutorials."
      ),
      proof: "Compute break-even ROAS for three real Kagu clients.",
      proofBrief: paras(
        "Take three real Kagu clients and compute each one's break-even ROAS: 1 ÷ gross margin. The number is only as good as the margin behind it, so get the gross margin from the client or their own figures rather than guessing it.",
        "Where a client already runs ads, put the break-even next to the ROAS the account reports. A ROAS that looks healthy in Ads Manager can sit below break-even — and that is why MER, contribution margin and break-even are the numbers that say whether the client is making money."
      ),
      proofSubmit:
        "For each client: the gross margin and where it came from, the break-even ROAS with the arithmetic, and one line on what it means for the account.",
      criteria: [
        "Three real Kagu clients, not hypothetical businesses",
        "Each gross margin says where it came from — the client, their figures, or a stated assumption",
        "Break-even is computed as 1 ÷ gross margin, with the arithmetic shown",
        "Where an account already reports ROAS, you say whether it sits above or below break-even",
      ],
      day_from: 1,
      day_to: 14,
      hours_low: 6,
      hours_high: 6,
      goals: [
        {
          title: "Impressions vs reach vs frequency",
          detail:
            "Impressions vs reach vs frequency — and why impressions are not people.",
        },
        {
          title: "The core metrics, CPM to LTV",
          detail:
            "CPM, CTR (link CTR vs all CTR), CPC, hook rate, hold rate, CVR, CPA/CPL, ROAS, AOV, LTV.",
        },
        {
          title: "MER, contribution margin and break-even ROAS",
          detail:
            "MER / blended ROAS, contribution margin, and break-even ROAS — and why only these three tell you whether the client is making money.",
        },
        {
          title: "Intent capture vs demand generation",
          detail:
            "Why Google Search is intent capture and Meta/TikTok are demand generation, and what that means for a client with no search volume.",
        },
      ],
      proofGoal: "Break-even ROAS computed for three real Kagu clients",
      resources: [
        {
          title: "Fundamentals of Digital Marketing",
          url: "https://skillshop.exceedlms.com/student/collection/1830706-fundamentals-of-digital-marketing",
          kind: "link",
          source: "Google Skillshop",
        },
        {
          title: "The Complete Playbook To Running Meta Ads in 2026",
          url: "https://www.youtube.com/watch?v=kuSq-pmNfnM",
          kind: "video",
          source: "Ben Heath",
        },
        {
          title: "Jon Loomer",
          url: "https://www.jonloomer.com/",
          kind: "read",
          source: "Independent blog",
        },
        {
          title: "PPC Land",
          url: "https://ppc.land/",
          kind: "read",
          source: "Independent",
        },
      ],
    },

    /* ------------------------------------------------------------------ 02 */
    {
      title: "Account access & governance",
      summary:
        "The single most damaging structural mistake a junior account manager makes has nothing to do with advertising. It is taking a client's personal login, or creating the client's ad account inside Kagu's own portfolio. Learn the correct way once and never deviate.",
      detail: paras(
        "The complete Meta asset checklist: ad account (Advertiser role is enough) · Facebook Page · Instagram account, linked in the Business Portfolio not just \"connected to the Page\" · Pixel / Dataset · Catalogue if ecommerce · Custom Conversions · WhatsApp Business Account — essential in Turkey for click-to-WhatsApp · Domain verification completed in their portfolio. Approval takes 24–48 hours; build it into the launch timeline.",
        "Türkiye gotcha: Turkish clients very often hand you an Instagram account that is personal, not professional. Convert it first — nothing else works until you do. Also check whether the client actually has a Business Portfolio at all; many local businesses have never created one, and \"just add me in Ads Manager\" is a stopgap, not the destination.",
        "Google: you need the client's 10-digit Customer ID; they accept under Access and security → Managers. Standard access is right for day-to-day work.",
        "TikTok: set up Kagu's own Business Center before onboarding your first TikTok client. Watch the trap — the TikTok organic profile and the advertiser account are separate assets and must be shared separately, and Spark Ads need the organic one."
      ),
      proof: "Set up a sandbox Business Portfolio and request partner access to a test asset.",
      proofBrief: paras(
        "Create a sandbox Business Portfolio that stands in for a client, and from Kagu's side request partner access to one of its assets — exactly the way you will with every real client. No shared password, and nothing created inside Kagu's own portfolio on the client's behalf.",
        "Walk the full Meta asset checklist against the sandbox as you go, and note which items a real client would have to grant as well. Approval takes 24–48 hours, so start early in the fortnight."
      ),
      proofSubmit:
        "Say which asset you requested access to, with which role, and whether it was granted. Attach a screenshot of the request or the granted access. Then list the checklist items a real client would still have to share.",
      criteria: [
        "The sandbox portfolio owns the asset — it was not created inside Kagu's portfolio",
        "Access came through a partner request, not a shared login",
        "The role requested is named",
        "The rest of the Meta asset checklist is listed, with what a real client would still have to grant",
      ],
      day_from: 1,
      day_to: 14,
      hours_low: 3,
      hours_high: 3,
      goals: [
        {
          title: "The client owns the assets",
          detail:
            "The rule: the client owns the assets, the agency gets permissioned access. Partner access, never a shared password.",
        },
        {
          title: "Business Portfolio vs Business Suite vs Ads Manager",
          detail:
            "Meta Business Portfolio (the old \"Business Manager\") vs Meta Business Suite vs Ads Manager — three different things people use interchangeably.",
        },
        {
          title: "The full asset checklist",
          detail:
            "The full asset checklist — and why requesting only the ad account means you can't select the Page on launch day.",
        },
        {
          title: "The pixel lives in the client's portfolio",
          detail: "Why the pixel/dataset must live in the client's portfolio, not yours.",
        },
        {
          title: "Google MCC linking and TikTok Business Center access",
          detail: "Google MCC linking and TikTok Business Center partner access.",
        },
      ],
      proofGoal: "Sandbox Business Portfolio set up, partner access requested",
      resources: [
        {
          title: "7-STEP Client Onboarding Checklist for Agencies! (+FREE TEMPLATE)",
          url: "https://www.youtube.com/watch?v=BM-uvTzZfIc",
          kind: "video",
          source: "AgencyAnalytics",
        },
        {
          title: "Link a client account to a manager (MCC) account",
          url: "https://support.google.com/google-ads/answer/7459601",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "Invite partners into TikTok Business Center",
          url: "https://ads.tiktok.com/help/article/invite-partners-into-tiktok-business-center?lang=en",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
        {
          title: "TikTok Business Center",
          url: "https://business.tiktok.com/",
          kind: "link",
          source: "TikTok",
        },
      ],
    },

    /* ------------------------------------------------------------------ 03 */
    {
      title: "Measurement first",
      summary:
        "This module sits before campaign building on purpose. Everything downstream depends on signal quality, and a broken pixel is invisible for weeks while you optimise toward nothing. In 2026 the browser pixel alone captures roughly 40% of actual conversions. An account running browser-only tracking is optimising on less than half its data.",
      detail: paras(
        "Event Match Quality — under 5 = significant data loss, fix now. 7–8 = good, the target. At EMQ 4 Meta learns from ~40% of conversions; at EMQ 8, ~80%.",
        "Biggest EMQ lever — hashed phone number. Email gets you to ~5–6; adding phone pushes past 7. Phone is near-universal in Turkey, so this is unusually easy here.",
        "Normal Meta vs GA4 gap — Meta reports 20–50% more conversions than GA4. Different models, windows, identity and date basis. Expecting agreement is the error.",
        "The 25% rule — if view-through conversions exceed 25% of total reported conversions, your ROAS is probably inflated. Cross-check the backend before scaling.",
        "Meta attribution changed twice in 2026. 12 January 2026: Meta removed the 7-day-view and 28-day-view windows entirely; the longest view window is now 1-day view, and some advertisers saw reported conversions drop 15–30% overnight. 3 March 2026: click-through was narrowed to link clicks only; likes, comments, shares, saves and profile taps moved into a new \"engage-through\" bucket with a fixed 1-day window. That reclassification inflated reported ROAS by a median ~38% while actual CRM revenue rose only ~8%. If a trainee compares February to April in Ads Manager and reports \"ROAS up 38%\", they have reported a reporting change as a business result.",
        "Never mix them: use Meta's numbers to optimise inside Meta. Use blended/backend numbers to decide budgets.",
        "On the resources: the MeasureSchool GA4 course dates from 2023 — interface details have shifted, but the event model and reporting fundamentals are intact. Google Analytics Academy no longer exists; it redirects to Skillshop. In the Campaign URL Builder, use Meta's dynamic macros so utm_content self-populates and never drifts: &utm_content={{ad.name}}&utm_id={{ad.id}}. TikTok deduplicates on event_id and keeps the first event, within 48 hours. For Turkish local businesses, set the WhatsApp click as a GA4 key event — it is usually the real conversion. The Stape video is advanced and not reviewed: only once you've done this stage and Meta Ads, and skip it on first pass."
      ),
      proof:
        "Install a pixel and Conversions API on a real site, get EMQ above 7, build the UTM spreadsheet and naming convention, and set a WhatsApp click as a GA4 key event.",
      proofBrief: paras(
        "Install a Meta pixel and a Conversions API connection on a real site, deduplicated on a shared event_id, and get Event Match Quality above 7. The biggest lever is hashed phone number — email alone gets you to about 5–6.",
        "Then build the two things the rest of the programme leans on: the UTM spreadsheet with the agency naming convention — one uppercase letter breaks a client's whole GA4 channel report, so the convention has to hold every time — and a WhatsApp click set as a GA4 key event."
      ),
      proofSubmit:
        "Name the site. Attach screenshots of the EMQ score and of the WhatsApp key event in GA4, and attach or paste the UTM spreadsheet with its naming convention. Say how you confirmed the pixel and CAPI events deduplicate.",
      criteria: [
        "Pixel and Conversions API both send events from a real site, sharing an event_id",
        "Event Match Quality is above 7, shown in a screenshot",
        "The UTM spreadsheet states a naming convention, and every row follows it exactly",
        "A WhatsApp click is set as a GA4 key event",
        "No customer personal data in the hand-in — crop screenshots to scores and settings (KVKK)",
      ],
      day_from: 15,
      day_to: 28,
      hours_low: 8,
      hours_high: 8,
      goals: [
        {
          title: "The Pixel is now a Dataset",
          detail:
            "Why the Meta Pixel is now called a Dataset, and that your old Pixel ID is the Dataset ID.",
        },
        {
          title: "Pixel + Conversions API, deduplicated on event_id",
          detail:
            "Pixel + Conversions API running together, deduplicated on a shared event_id. This is the single most important technical skill in the whole curriculum.",
        },
        {
          title: "Event Match Quality",
          detail:
            "Event Match Quality: what it is, what a good score is, and which parameter moves it most.",
        },
        {
          title: "Aggregated Event Measurement",
          detail: "Aggregated Event Measurement and the 8-event prioritisation exercise.",
        },
        {
          title: "Why Meta and GA4 never agree",
          detail: "Why Meta and GA4 will never agree, and why that is not a bug.",
        },
        {
          title: "UTM conventions",
          detail:
            "UTM conventions, and why one uppercase letter breaks a client's whole GA4 channel report.",
        },
      ],
      proofGoal: "Pixel + CAPI live with EMQ above 7, UTMs and a WhatsApp key event",
      resources: [
        {
          title: "Full Google Analytics 4 Course for Beginners",
          url: "https://www.youtube.com/watch?v=ZaBycjPJztk",
          kind: "video",
          source: "MeasureSchool",
        },
        {
          title: "Google Analytics 101 → 301 + certification",
          url: "https://skillshop.exceedlms.com/student/catalog/browse",
          kind: "link",
          source: "Google Skillshop",
        },
        {
          title: "Campaign URL Builder",
          url: "https://ga-dev-tools.google/campaign-url-builder/",
          kind: "link",
          source: "Google",
        },
        {
          title: "TikTok — About Event Deduplication",
          url: "https://ads.tiktok.com/help/article/event-deduplication?lang=en",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
        {
          title: "TikTok — About Events API",
          url: "https://ads.tiktok.com/help/article/events-api?lang=en",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
        {
          title: "Set up Google Analytics 4",
          url: "https://support.google.com/analytics/answer/9304153",
          kind: "read",
          source: "Google Analytics Help",
        },
        {
          title: "About consent mode",
          url: "https://support.google.com/google-ads/answer/10000067?hl=en",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "How to Correctly Install Facebook / Meta Conversions API + Event Deduplication",
          url: "https://www.youtube.com/watch?v=ytNnSVodsA4",
          kind: "video",
          source: "Stape · not reviewed",
        },
      ],
    },

    /* ------------------------------------------------------------------ 04 */
    {
      title: "Meta Ads",
      summary:
        "Instagram reaches 70.9% of Turkey's population — nearly double Facebook. For a Kagu client, Meta means Instagram-first, and Facebook is additional inventory rather than the home page. Everything you read in English-language training assumes Facebook-first; correct for it.",
      detail: paras(
        "Advantage+ is not a campaign type — since API v24.0 (Oct 2025) it is three toggles, Advantage+ budget, audience and placements, applied to a normal campaign. Enough of them on, and the campaign enters an Advantage+ state.",
        "Learning phase exit — ~50 optimization events per ad set per rolling 7 days. Below that: Learning Limited, and waiting does not fix it — the arithmetic doesn't work.",
        "Minimum daily budget — (Target CPA × 50) ÷ 7. At a ₺500 target CPA that's ~₺3,570/day per ad set. This is why small accounts must run one ad set, not five.",
        "Detailed-targeting exclusions — eliminated 31 March 2025. You can no longer exclude by interest. Older tutorials that teach exclusion stacks are teaching a dead feature.",
        "Feed creative — 4:5 · 1080×1350 minimum. Stories and Reels 9:16 · 1080×1920. Meta's upload flow asks for 1:1 while its own guidance recommends 4:5 — a real mismatch you'll hit.",
        "9:16 safe zones — top 14%, bottom 35%, sides 6%. Meta's own published percentages. Use the strict version for anything that might get boosted.",
        "The rejection that catches everyone: personal attributes. An ad may not state or imply that it knows the viewer's race, ethnicity, religion, age, sexual orientation, gender identity, health condition or financial status. Learn the rewrite: \"Are you struggling with acne?\" → \"Our cream helps clear skin.\" Appeals run through Account Quality and take 7–10 business days, so getting it right first time is a scheduling issue as much as a policy one.",
        "Watch the videos in order: Nick Theriot's free course is the operational anchor; Ben Heath's campaign structure video answers \"how many ad sets should I run\" — fewer than you think; Nick Theriot's testing video is week 2–3 material, not day one. Meta Blueprint's courses are free but its certification exams cost money, so treat the exams as optional. In the Ad Library, set country to Türkiye: an ad running 60+ days is almost certainly profitable. Track ten competitors weekly and log what persists."
      ),
      proof:
        "Build and launch one real Meta campaign on a small budget, and get one ad set out of the learning phase.",
      proofBrief: paras(
        "Build and launch one real Meta campaign on a small budget, then get one ad set out of the learning phase. That takes roughly 50 optimisation events per rolling 7 days, so do the budget arithmetic before launch: (target CPA × 50) ÷ 7 per ad set. If that number is out of reach, run one ad set, not five.",
        "Build Instagram-first — 4:5 for feed, 9:16 for Stories and Reels, inside the safe zones — and check every line of copy against the personal-attributes rule before it goes to review. An appeal costs 7–10 business days."
      ),
      proofSubmit:
        "Name the client and account. Paste the campaign structure — objective, budget setting, ad sets, optimisation event — and the budget arithmetic. Attach a screenshot of the ad set after it left learning.",
      criteria: [
        "A real campaign on a real client account, not a draft",
        "The budget arithmetic is shown: (target CPA × 50) ÷ 7 per ad set",
        "The number of ad sets is justified against the budget",
        "One ad set has exited the learning phase, shown in a screenshot",
        "Any ad rejected for personal attributes is shown with its rewrite",
      ],
      day_from: 29,
      day_to: 49,
      hours_low: 12,
      hours_high: 12,
      goals: [
        {
          title: "The three-level hierarchy",
          detail:
            "The three-level hierarchy and the rule that what you choose at each level constrains what you may choose below it.",
        },
        {
          title: "The six ODAX objectives",
          detail:
            "The six ODAX objectives: Awareness, Traffic, Engagement, Leads, App promotion, Sales.",
        },
        {
          title: "\"ASC\" is a historical term",
          detail:
            "Why \"Advantage+ Shopping Campaigns\" is a historical term in 2026 — clients will still say \"ASC\" and you translate it to \"an Advantage+ Sales campaign\".",
        },
        {
          title: "CBO vs ABO",
          detail:
            "CBO (now labelled \"Advantage campaign budget\") vs ABO, and when to use each.",
        },
        {
          title: "Hard controls vs audience suggestions",
          detail:
            "Hard controls vs audience suggestions — the conceptual key to 2026 targeting.",
        },
        {
          title: "The learning phase and Learning Limited",
          detail:
            "The learning phase, the 50-event rule, and what \"Learning Limited\" actually means.",
        },
        {
          title: "The personal-attributes policy rule",
          detail:
            "The personal-attributes policy rule, which causes more surprise rejections than anything else.",
        },
      ],
      proofGoal: "One real Meta campaign launched, one ad set out of learning",
      resources: [
        {
          title: "Master Facebook Ads In 2026 With This Video (FREE COURSE)",
          url: "https://www.youtube.com/watch?v=fysbqw31UvA",
          kind: "video",
          source: "Nick Theriot",
        },
        {
          title: "The BEST Facebook Ad Campaign Structure for 2026",
          url: "https://www.youtube.com/watch?v=13s-G9Uj51A",
          kind: "video",
          source: "Ben Heath",
        },
        {
          title: "The BEST Way to Test Facebook Ads in 2026 (I show everything)",
          url: "https://www.youtube.com/watch?v=IO0hAgX8Bx8",
          kind: "video",
          source: "Nick Theriot",
        },
        {
          title: "Meta Blueprint",
          url: "https://www.facebookblueprint.com/",
          kind: "link",
          source: "Meta",
        },
        {
          title: "Meta Ad Library",
          url: "https://www.facebook.com/ads/library/",
          kind: "link",
          source: "Meta",
        },
        {
          title: "Meta Advertising Standards",
          url: "https://transparency.meta.com/policies/ad-standards/",
          kind: "read",
          source: "Meta Transparency Center",
        },
        {
          title: "Meta Marketing API docs",
          url: "https://developers.facebook.com/docs/marketing-api/",
          kind: "read",
          source: "Meta for Developers",
        },
      ],
    },

    /* ------------------------------------------------------------------ 05 */
    {
      title: "TikTok Ads",
      summary:
        "TikTok uses the same three-level structure as Meta, so learn it as a delta rather than from scratch. It reaches 68.6% of Turkish adults — effectively matching Instagram — and the platform is fully operational and officially supported here, with its own Turkey VAT documentation.",
      detail: paras(
        "Why Spark Ads matter more than any other TikTok format: Spark Ads promote an existing organic post — yours, or a creator's via an authorisation code. Every view, like, comment, share and follow is attributed to the original organic post. So the value compounds beyond the campaign flight and builds the account, where a standard in-feed ad simply disappears when the spend stops. Video up to 10 minutes, no ratio or file-type restriction, max 10,000 Spark Ads per Ads Manager account.",
        "Creative specs — 9:16, min 720p. Land engagement in the first 6 seconds; state the proposition in the first 3. Captions at 5–10 words per second.",
        "Creative volume — 3–5 creatives per ad group, 3–5 diversified ad groups per campaign. TikTok's own guidance, not folklore.",
        "Budget rule — TikTok's stated guidance is that an ad group budget should cover at least 5× target CPA. The widely-quoted \"$50/day minimum\" does not appear in TikTok's own CBO docs — check inside a live Turkish account.",
        "Learning & scaling — ~50 conversions to exit learning. Scale in 20–30% steps. Creative fatigues faster than on Meta — plan a higher refresh cadence.",
        "On the resources: the ZoCo Marketing course is the cleanest technical onboarding available, with zero dropshipping hype. TikTok Academy has two learning paths, Creative Expert and Media Buying Expert, and the Media Buying certification prep is free. The Top Ads library is the single best free creative-research tool in this curriculum — filter by Region (Türkiye is available), Objective, Ad Language, Format and Likes. The Creative Center's Commercial Music Library is licensed audio that is safe to use in ads. The Smart+ page, updated August 2026, is the one that makes older TikTok tutorials look wrong."
      ),
      proof: "Launch one TikTok campaign on a small budget and run a Spark Ad.",
      proofBrief: paras(
        "Build and launch one real TikTok campaign on a small budget, and run a Spark Ad in it — an existing organic post, yours or a creator's through an authorisation code. The organic profile and the advertiser account are separate assets, and the Spark Ad needs the organic one.",
        "Follow TikTok's own numbers rather than folklore: 9:16 at 720p or better, the proposition in the first 3 seconds, 3–5 creatives per ad group, and an ad group budget that covers at least 5× target CPA."
      ),
      proofSubmit:
        "Name the client and account. Paste the setup — objective, ad groups, creatives per ad group, budget against target CPA — and link or screenshot the Spark Ad with the organic post it promotes.",
      criteria: [
        "A real campaign on a real TikTok account",
        "A Spark Ad runs, and the organic post behind it is shown",
        "Each ad group budget covers at least 5× target CPA, with the arithmetic",
        "Ad groups carry 3–5 creatives, in 9:16",
      ],
      day_from: 29,
      day_to: 49,
      hours_low: 6,
      hours_high: 6,
      goals: [
        {
          title: "The eight objectives",
          detail: "The eight objectives across Awareness, Consideration and Conversion.",
        },
        {
          title: "Spark Ads, and why they are different",
          detail:
            "Spark Ads and why they are strategically different from every other ad format.",
        },
        {
          title: "Smart+ and the August 2026 creation flow",
          detail:
            "Smart+ campaigns, the August 2026 unified creation flow, and how Smart+ differs from the older Smart Performance Campaign.",
        },
        {
          title: "TikTok's creative specs, and sound",
          detail: "TikTok's own creative specs, and why sound is not optional.",
        },
        {
          title: "Creator Marketplace is now TikTok One",
          detail:
            "That the Creator Marketplace no longer exists — it became TikTok One on 1 April 2025.",
        },
      ],
      proofGoal: "One TikTok campaign launched, with a Spark Ad",
      resources: [
        {
          title: "The FULL TikTok Ads Course (Learn Tiktok Ads 2026)",
          url: "https://www.youtube.com/watch?v=T1xOxbGUB-A",
          kind: "video",
          source: "ZoCo Marketing",
        },
        {
          title: "TikTok Academy",
          url: "https://www.tiktokacademy.com/",
          kind: "link",
          source: "TikTok",
        },
        {
          title: "TikTok Top Ads library",
          url: "https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en",
          kind: "link",
          source: "TikTok Creative Center",
        },
        {
          title: "TikTok Creative Center",
          url: "https://ads.tiktok.com/business/creativecenter/pc/en",
          kind: "link",
          source: "TikTok",
        },
        {
          title: "About Spark Ads",
          url: "https://ads.tiktok.com/help/article/spark-ads",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
        {
          title: "Smart+ Upgraded Experience",
          url: "https://ads.tiktok.com/help/article/about-updates-to-smart-plus?lang=en",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
        {
          title: "Creative best practices",
          url: "https://ads.tiktok.com/help/article/creative-best-practices?lang=en",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
        {
          title: "Choose the right objective",
          url: "https://ads.tiktok.com/help/article/choose-right-objective?lang=en",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
      ],
    },

    /* ------------------------------------------------------------------ 06 */
    {
      title: "Google Ads",
      summary:
        "Google holds roughly 90% of Turkish search. Search is a different discipline from social: you harvest demand that already exists rather than creating it. A client with no search volume for their category cannot be fixed with better Google ads — learn to say that out loud.",
      detail: paras(
        "The two PMax criticisms you must be able to discuss with a client. Brand cannibalisation: PMax absorbs branded queries that Search should win, inflating apparent ROAS and destroying keyword-level insight. Fix with exact-match brand keywords in Search and brand terms as negatives in PMax. Lead quality: reported 20–40% lower than Search for most B2B and service businesses — volume rises while qualified conversions fall. Budget heuristic: B2B / professional services / regulated → 60–70% Search. Ecommerce with 50+ SKUs → 60–70% PMax.",
        "Quality Score — 1–10, keyword level, three components rated against competitors over the previous 90 days. Google states plainly it is not an input in the ad auction.",
        "PMax controls that now exist — negative keywords raised from 100 to 10,000 per campaign; search themes from 25 to 50; brand exclusions; channel and search-term reporting.",
        "AI Max, Sept 2026 — auto-upgraded campaigns using campaign-level broad match or automatically created assets between 1–30 September 2026. Dynamic Search Ads move on a February 2027 timeline.",
        "Turkey CPC, median — e-commerce ₺5.8–9.2; restaurant/cafe ₺5.8–25.8; education ₺15.3–40.3; healthcare/dental ₺21.4–114.7. Treat as orientation, not client-facing benchmarks.",
        "On the resources: watch Aaron Young's \"How I Would Learn Google Ads\" first. His 2026 beginner tutorial is the main hands-on course (not reviewed; the typo in \"Beginers\" is in the real title), and Grow My Ads is a second walkthrough if his pacing doesn't suit you (also not reviewed). The Performance Max set-up video is advanced — do standard Search first, then come back to it. On Skillshop, start with the Search certification. Broad Match Modifier no longer exists, and negative keywords follow different matching rules. AI Max's final URL expansion serves landing pages other than your configured URL, which silently breaks UTM parsing. Bookmark the announcements feed."
      ),
      proof: "Build one Search campaign end to end with proper negatives.",
      proofBrief: paras(
        "Build one Search campaign end to end for a real client: the conversion action, keywords by match type, ad groups, ads and a negative keyword list. All three match types are AI-interpreted at auction time now, which makes negative keywords more important, not less — so maintain the list from the search-terms report once it has data.",
        "If the client also runs Performance Max, protect the brand: exact-match brand keywords in Search, brand terms as negatives in PMax. And check whether AI Max was switched on during September 2026 — final URL expansion will send traffic to pages you didn't set."
      ),
      proofSubmit:
        "Name the client and account. Paste the structure — ad groups, keywords with match types, the negative list — and the conversion action it optimises to. Say whether AI Max is on and whether PMax runs alongside.",
      criteria: [
        "A real campaign on a real client account, linked through Kagu's MCC",
        "Keywords are listed with their match types",
        "A negative keyword list exists, and you say where its terms came from",
        "The conversion action is named and recording",
        "AI Max status is stated; if PMax runs too, brand terms are negatives there",
      ],
      day_from: 50,
      day_to: 63,
      hours_low: 10,
      hours_high: 10,
      goals: [
        {
          title: "MCC → account → campaign → ad group → ads",
          detail:
            "MCC → account → campaign → ad group → ads/keywords, and why agencies link rather than own.",
        },
        {
          title: "The 2026 campaign types",
          detail:
            "The 2026 campaign types, and that Display is being retired into Demand Gen.",
        },
        {
          title: "Broad, phrase and exact match in 2026",
          detail:
            "Broad, phrase and exact match — and the 2026 reality that all three are now AI-interpreted at auction time, which makes negative keywords more important, not less.",
        },
        {
          title: "Quality Score is a diagnostic, not an auction input",
          detail:
            "That Quality Score is a diagnostic, not an auction input. Ad Rank is the actual mechanism. Most training material gets this wrong.",
        },
        {
          title: "Performance Max and its two criticisms",
          detail: "Performance Max, its real controls, and its two honest criticisms.",
        },
        {
          title: "AI Max for Search",
          detail:
            "AI Max for Search, which Google auto-enabled on eligible campaigns during September 2026.",
        },
      ],
      proofGoal: "One Search campaign built end to end, with proper negatives",
      resources: [
        {
          title: "How I Would Learn Google Ads... if I could start over",
          url: "https://www.youtube.com/watch?v=_XNJilszSvk",
          kind: "video",
          source: "Aaron Young",
        },
        {
          title: "Google Ads Tutorial for Beginers [Updated for 2026]",
          url: "https://www.youtube.com/watch?v=h7xOSw1i7Jw",
          kind: "video",
          source: "Aaron Young · not reviewed",
        },
        {
          title: "Google Ads Beginners Tutorial for 2026 (Step By Step)",
          url: "https://www.youtube.com/watch?v=16X5a0Ii7kg",
          kind: "video",
          source: "Grow My Ads · not reviewed",
        },
        {
          title: "Performance Max Campaign Set Up in 2026 | Step by Step Tutorial",
          url: "https://www.youtube.com/watch?v=N9XNZCyAIrM",
          kind: "video",
          source: "Aaron Young · advanced",
        },
        {
          title: "Google Skillshop",
          url: "https://skillshop.withgoogle.com/",
          kind: "link",
          source: "Google",
        },
        {
          title: "About keyword matching options",
          url: "https://support.google.com/google-ads/answer/7478529?hl=en",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "Quality Score",
          url: "https://support.google.com/google-ads/answer/6167118?hl=en",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "About Performance Max",
          url: "https://support.google.com/google-ads/answer/10724817",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "About AI Max for Search campaigns",
          url: "https://support.google.com/google-ads/answer/15910366?hl=en",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "Display campaigns move into Demand Gen",
          url: "https://support.google.com/google-ads/answer/17051545?hl=en",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "Google Ads — new features & announcements",
          url: "https://support.google.com/google-ads/announcements/9048695?hl=en",
          kind: "read",
          source: "Google Ads Help",
        },
      ],
    },

    /* ------------------------------------------------------------------ 07 */
    {
      title: "Instagram & TikTok ranking",
      summary:
        "Two reframes before any tactic. First: Instagram is not one algorithm — Feed, Stories, Explore, Reels and Search each rank separately with different signal weights, and anyone saying \"the algorithm\" as one thing will make wrong decisions. Second: ranking is a per-post prediction, not an account reputation. Reach is an outcome of early performance, not a property your account has.",
      detail: paras(
        "Sends per reach = Sends ÷ Reach. 350 sends on 10,000 reach = 3.5%. Coach against the account's own trailing median, never an invented industry benchmark.",
        "The design question to drill into every junior: \"Who is the specific person a viewer would send this to, and what would they type when they send it?\" If there is no answer, the post will not travel to non-followers. That is the whole of Instagram growth strategy in one sentence.",
        "Hashtags, Dec 2025 — capped at 5 per post, down from 30. They appear in no official ranking-signal list on any surface. Use 3–5 niche tags as topic labels, not as a reach lever.",
        "Reels reach rate — by account size: 1–5K 9.78%; 10–50K 7.10%; 100K–1M 5.00%. Skip rate is 60–65% — two in three viewers swipe away. Set client expectations with this.",
        "Only 21% grew — just 21% of accounts under 10,000 followers grew at all in 2026. The single most useful number for an honest client conversation.",
        "Format deltas — Reels drive 4× the interactions of single images; carousels drive 9× the saves. Single-image engagement fell 46% year on year.",
        "TikTok, official — \"Neither follower count nor whether the account has had previous high-performing videos are direct factors in the recommendation system.\" That is the structural difference from Instagram.",
        "Trial Reels — public accounts, generally 1,000+ followers. Goes only to non-followers, metrics at ~24 h, auto-publish option at 72 h. Schedulable since early 2026 — the only native A/B test on Instagram.",
        "On the resources: read TikTok's own newsroom page alongside the Modern Millie video, because the \"traffic pool\" tiers everyone repeats are not in TikTok's documentation. Read Instagram Ranking Explained side by side with it too. TikTok's For You Feed standards list watermarks, fake engagement, QR codes, and alcohol and tobacco — which any Turkish F&B or hospitality client will hit constantly. Check Settings → Account Status before blaming the algorithm; \"shadowbanning\" is not a real mechanism. DataReportal's Turkey figures: Instagram 62.3M · YouTube 57.9M · TikTok 44.9M adults · Facebook 34.7M."
      ),
      day_from: 64,
      day_to: 77,
      hours_low: 6,
      hours_high: 6,
      goals: [
        {
          title: "Ranking signals per surface, and what Reels optimises for",
          detail:
            "Instagram's stated ranking signals per surface, and the four things Reels optimises for — including \"goes to the audio page\", which is why audio choice is an algorithmic input rather than a taste decision.",
        },
        {
          title: "Sends per reach",
          detail:
            "Sends per reach: the formula, where to find it, and why there is no credible benchmark for it.",
        },
        {
          title: "Likes for followers, sends for non-followers",
          detail:
            "Mosseri's May 2026 position: like rates matter more for your followers; send rates matter more for people who don't follow you.",
        },
        {
          title: "Removal vs not eligible for recommendation",
          detail:
            "The two distinct suppression mechanisms — content removal vs \"not eligible for recommendation\" — and where to check (Account Status).",
        },
        {
          title: "TikTok's three signal families",
          detail:
            "TikTok's three official signal families, and its published line that follower count is not a direct ranking factor.",
        },
        {
          title: "The originality policy and watermarks",
          detail:
            "The originality policy, and why a TikTok watermark on a client Reel is the most common junior error there is.",
        },
      ],
      resources: [
        {
          title: "Instagram Algorithm 2026: How It REALLY Works (New Updates Explained)",
          url: "https://www.youtube.com/watch?v=gLeeMc_Injw",
          kind: "video",
          source: "Jade Beason",
        },
        {
          title: "THE TIKTOK ALGORITHM EXPLAINED | Your 2026 Guide To TikTok Success!",
          url: "https://www.youtube.com/watch?v=diJ172jDsxA",
          kind: "video",
          source: "Modern Millie",
        },
        {
          title: "The Complete Instagram For Business Tutorial 2026",
          url: "https://www.youtube.com/watch?v=JkMhBKi12q4",
          kind: "video",
          source: "Learn With Shopify",
        },
        {
          title: "Instagram Ranking Explained",
          url: "https://about.instagram.com/blog/announcements/instagram-ranking-explained",
          kind: "read",
          source: "Instagram",
        },
        {
          title: "How TikTok recommends videos #ForYou",
          url: "https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you",
          kind: "read",
          source: "TikTok Newsroom",
        },
        {
          title: "For You Feed eligibility standards",
          url: "https://www.tiktok.com/community-guidelines/en/fyf-standards",
          kind: "read",
          source: "TikTok Community Guidelines",
        },
        {
          title: "Instagram Recommendations Guidelines",
          url: "https://help.instagram.com/313829416281232",
          kind: "read",
          source: "Instagram Help Centre",
        },
        {
          title: "Account Status",
          url: "https://help.instagram.com/1584158414160055",
          kind: "read",
          source: "Instagram Help Centre",
        },
        {
          title: "Digital 2026: Turkey",
          url: "https://datareportal.com/reports/digital-2026-turkey",
          kind: "read",
          source: "DataReportal",
        },
      ],
    },

    /* ------------------------------------------------------------------ 08 */
    {
      title: "Short-form craft",
      summary:
        "Do not teach the \"3-second rule\" as a law. Teach it as this: you have roughly one second to stop the scroll and roughly three to justify it, and the first three seconds are the only part of the video most people will ever see, so they must carry the value proposition.",
      detail: paras(
        "The Cliff — a 30–50% drop between second 1 and second 3, then gradual decay. Diagnosis: the opening is dead — an intro, a logo, a slow setup, a greeting. Fix: trim ruthlessly; delete everything before the first substantive frame.",
        "The Hump — holds above 60% through the middle, declines at the end. Diagnosis: strong mid-video payoff. Fix: good share-rate content; move the payoff earlier and tighten the tail.",
        "The Plateau — flat above 70% end to end, with a spike above 100% at second 1. Diagnosis: clean loop plus rewatches, the algorithm's preferred shape. Fix: nothing; replicate the structure — this is your template.",
        "A sharp drop at a specific second is almost always a talking-head cut, a slow text card, or a pacing pause. Scrub to it and cut that beat. A spike above 100% at second 1 means your loop closed — it is the strongest positive indicator available.",
        "The one number to memorise — design inside the centre 1010 × 1160 px of a 1080×1920 canvas and nothing will ever be covered by UI on any platform.",
        "Length, Instagram Reels — 30–60 s peaks at 5.60% reach rate. Falls to 4.30% above 90 s and 3.50% above 120 s.",
        "Length, TikTok — engagement rate is nearly flat across all lengths (4.2–6.0%), but median views rise sharply with length — 120–180 s peaks at 11,136 median views. Two-track it: short for engagement, long for reach.",
        "The 80% heuristic — average view duration at or above 80% of video length is the informal threshold where algorithmic push expands. Unofficial, but a useful working target.",
        "Creative hit rate by format — text only 11.6% · product image 8.75% · UGC 7.56% · high production 6.87%. High-production video is the worst performer per asset. You do not need a film crew.",
        "Turkish typography — check every font renders ç ğ ı İ ö ş ü, dotless ı versus dotted i especially. Turkish runs 10–20% longer than English, so fewer words per card and wider margins.",
        "The music licensing trap — non-negotiable agency rule. Business accounts see a restricted music library; the popular label-licensed tracks visible on personal accounts are not available to them, and that is licensing, not a bug. Worse: a Reel that performs organically with library music can fail when you boost it — paid distribution triggers extra checks, and tracks get muted, delivery-limited or rejected in ad review. So: for anything that might ever be boosted, use Meta Sound Collection or separately licensed music only; build two cuts of every asset, an organic cut and an ad-ready cut; and keep a proof pack of licences and track IDs. The in-app picker is not a licence.",
        "Cross-posting: yes, with three hard conditions. 1. Remove the watermark — always export the clean master from the editor; never download your own post from the platform. 2. Respect the reused/inauthentic content policies — YouTube's July 2025 rename now also catches mass-produced templated uploads even when original. 3. Adapt, don't dump — reposition text per platform, re-cut the hook, rewrite the caption keywords.",
        "On the resources: the Evan Seech and Joris Hermans videos are not reviewed. Published safe-zone numbers genuinely disagree between sources; always verify with each platform's own preview before final export."
      ),
      proof:
        "Write five hooks for one concept and test them, and read three retention curves and name the shape.",
      proofBrief: paras(
        "Take one concept and write five different hooks for it — five openings on the same body — then run them and compare hook rate. Hooks carry the most variance and are the cheapest part to reshoot. Watch for the failure mode: a strong pattern interrupt with a weak payload holds second 1 and then drops steeply.",
        "Then pull three real retention curves and name each shape — Cliff, Hump or Plateau — with the fix it calls for. If a curve drops sharply at one specific second, scrub to it and say what's there."
      ),
      proofSubmit:
        "Paste the concept, the five hooks word for word, how you ran them, and each one's hook rate. Then attach the three retention curves, each labelled with its shape and the fix it calls for.",
      criteria: [
        "One concept, five genuinely different hooks, written word for word",
        "All five were run, with a hook rate for each",
        "Three real retention curves, each named Cliff, Hump or Plateau",
        "Each curve carries the fix its shape calls for",
        "Any clip that ran as an ad used Meta Sound Collection or separately licensed audio",
      ],
      day_from: 64,
      day_to: 77,
      hours_low: 8,
      hours_high: 8,
      goals: [
        {
          title: "Seven hook patterns, and bait-and-switch",
          detail:
            "Seven hook patterns, and the critical failure mode: a strong pattern interrupt with a weak payload produces high 1-second retention and a steep drop — the algorithm reads that as bait-and-switch.",
        },
        {
          title: "The Cliff, the Hump and the Plateau",
          detail:
            "Retention curve diagnosis: the Cliff, the Hump and the Plateau, and the different fix each one calls for.",
        },
        {
          title: "Loops are a ranking tactic",
          detail: "Why loops are a ranking tactic and not a style choice.",
        },
        {
          title: "Safe zones, and the one number to memorise",
          detail: "Safe zones, and the one number to memorise.",
        },
        {
          title: "The music licensing trap",
          detail: "The music licensing trap — the single biggest legal risk in this module.",
        },
      ],
      proofGoal: "Five hooks tested on one concept, three retention curves named",
      resources: [
        {
          title: "How to Write Ad Hooks That Scale",
          url: "https://www.youtube.com/watch?v=SE1aIOgO-lM",
          kind: "video",
          source: "Blue Sense Digital",
        },
        {
          title: "How To Make Scroll-Stopping Meta Video Ad Creatives [Full Masterclass]",
          url: "https://www.youtube.com/watch?v=2-d64pcmYEk",
          kind: "video",
          source: "Evan Seech · not reviewed",
        },
        {
          title: "How to Edit SHORTS & REELS Like a PRO For FREE! | CapCut Video Editing Tutorial",
          url: "https://www.youtube.com/watch?v=_o3KwJ0gUZI",
          kind: "video",
          source: "Joris Hermans · not reviewed",
        },
        {
          title: "Safe zones across TikTok, Facebook, Instagram Stories & Reels",
          url: "https://houseofmarketers.com/guide-to-safe-zones-tiktok-facebook-instagram-stories-reels/",
          kind: "read",
          source: "House of Marketers",
        },
        {
          title: "Instagram Reels benchmarks — 140,000 Reels analysed",
          url: "https://www.socialinsider.io/blog/instagram-reels-statistics/",
          kind: "read",
          source: "Socialinsider",
        },
        {
          title: "TikTok video length — 6 million brand videos analysed",
          url: "https://www.socialinsider.io/blog/how-long-are-tiktok-videos/",
          kind: "read",
          source: "Socialinsider",
        },
        {
          title: "Instagram study 2026 — 24.36M posts, 375,118 accounts",
          url: "https://metricool.com/press-release-instagram-study-2026/",
          kind: "read",
          source: "Metricool",
        },
      ],
    },

    /* ------------------------------------------------------------------ 09 */
    {
      title: "Creative strategy & the offer",
      summary:
        "Beginners work bottom-up from budget mechanics. Professionals work top-down from the offer. Get the leverage hierarchy straight and most of your decisions make themselves.",
      detail: paras(
        "The leverage hierarchy: 1 · Product/market (can't fix with ads) → 2 · Offer → 3 · Creative → 4 · Landing page → 5 · Targeting (largely automated) → 6 · Budget mechanics (smallest).",
        "The real hit rate — roughly 49–54% of launched ads are outright losers; only 3.7–8.2% are winners. Launch 20 ads, expect 0.7–1.6 winners. Plan production accordingly.",
        "Weekly launch volume — under $10K/month, the median account launches 2.8 creatives a week; the top quartile launches 4.8. That gap is most of the performance gap.",
        "Hook variety — ten ads with ten different hooks on one concept outperform ten ads with one hook and ten different bodies. Test hooks first — most variance, cheapest to reshoot.",
        "CRO levers — only 17% of marketers A/B test landing pages, yet testing yields ~37% average gains. Adding a second CTA roughly halves conversion rate.",
        "Offers that work in Türkiye. Taksit options stated near the price are often a bigger conversion lever than the price itself. WhatsApp-first CTAs beat forms and beat link-in-bio in most verticals — the standard Turkish funnel is Instagram → DM → WhatsApp → sale, and \"DM'den yazın\" outperforms \"link in bio\". Risk reversal: memnun kalmazsanız iade, ücretsiz ilk seans, ücretsiz keşif.",
        "Write Turkish copy in Turkish. Direct translations of English direct-response copy fail: English headlines expand 20–30% in characters and break layouts, and imperative CTAs that read as energetic in English read as pushy in Turkish. \"Hemen inceleyin\" usually beats \"Get yours now!\". Scarcity must be genuine — fake countdowns are a Reklam Kurulu problem (stage 13).",
        "On the resources: Dara Denney's UGC recipe dates from 2022 and is still the clearest explanation of modular direct-response scripting. Her creative-strategy and creator-brief videos are not reviewed. For competitor research, build a tracked list of ten competitors in the Meta Ad Library, check weekly, and log which ads persist — what a competitor keeps running tells you far more than what they launch."
      ),
      proof: "Produce a one-page creative brief with the hook written word for word.",
      proofBrief: paras(
        "Write one creative brief for a real client that fits on one page, with the hook written word for word. A brief is now a targeting specification: who appears on screen, and in what situation, is an instruction to the algorithm, not an aesthetic preference.",
        "Work top-down from the offer, not up from the budget. For a Turkish buyer that usually means taksit near the price, a WhatsApp-first CTA and genuine risk reversal. Write the Turkish copy in Turkish rather than translating it."
      ),
      proofSubmit:
        "Attach or paste the brief. Add one line naming the concept it belongs to, and one on what you would test first and which metric reads it.",
      criteria: [
        "One page, for a real client",
        "The hook is written word for word, not described",
        "The offer is stated, and the brief is built from it",
        "It says who appears on screen and in what situation",
        "Turkish copy is written in Turkish, not translated from English",
      ],
      day_from: 64,
      day_to: 77,
      hours_low: 6,
      hours_high: 6,
      goals: [
        {
          title: "Concept vs format vs variation",
          detail:
            "Concept vs format vs variation — and the rule that when a concept fatigues, a variation will not save it.",
        },
        {
          title: "The six-field creative brief",
          detail:
            "The six-field creative brief, on one page, with the hook written word for word.",
        },
        {
          title: "Modular testing",
          detail:
            "Modular testing: hook rate tests the hook, hold rate tests the body, CTR tests the offer framing, CVR tests the landing page.",
        },
        {
          title: "Creative volume beats hit rate",
          detail:
            "Why creative volume beats hit rate: 50 ads at a 10% hit rate produces 5 winners; 5 ads at 20% produces 1.",
        },
        {
          title: "What AIDA and PAS can't do",
          detail:
            "Why frameworks like AIDA and PAS structure arguments but don't generate insight — and why AI defaults to framework-shaped copy, which is the most recognisable slop in advertising.",
        },
      ],
      proofGoal: "A one-page creative brief, hook written word for word",
      resources: [
        {
          title: "The Recipe for the Perfect UGC Ad (Facebook Ads & TikTok Ads)",
          url: "https://www.youtube.com/watch?v=Yi_1Vb4sfoQ",
          kind: "video",
          source: "Dara Denney",
        },
        {
          title: "How to Develop a Creative Strategy That Converts (Facebook Ads & TikTok Ads)",
          url: "https://www.youtube.com/watch?v=rNsOaXtlmRM",
          kind: "video",
          source: "Dara Denney · not reviewed",
        },
        {
          title: "How to Brief UGC Creators (My Exact Template)",
          url: "https://www.youtube.com/watch?v=Ss7bdFf0bsk",
          kind: "video",
          source: "Dara Denney · not reviewed",
        },
        {
          title: "Meta Ad Library — competitor research method",
          url: "https://www.facebook.com/ads/library/",
          kind: "link",
          source: "Meta",
        },
      ],
    },

    /* ------------------------------------------------------------------ 10 */
    {
      title: "Scaling & diagnosis",
      summary:
        "Scaling is not \"spend more money\". Scaling is buying more of a result at an acceptable cost. Three levers: vertical (budget), horizontal (more ad sets, audiences, placements, platforms), and creative (more concepts, faster refresh). The hierarchy is creative > offer > budget mechanics, and budget mechanics is the smallest lever and the one beginners obsess over.",
      detail: paras(
        "The signal-density ladder. Under 30 daily conversions: 5–10% safe daily budget increase; overshoot and learning resets, with a measured penalty of a 35–60% CPA increase for 48–72 hours. 50–100: 10–20%, the classic \"20% rule\" zone; usually survivable, and space steps 3–4 days apart for a clean read. 200+ with CPA stable for 5 days: 30–50%; typically only a 10–15% CPA bump that normalises within 24 hours.",
        "Meta has never published \"20%\" as a threshold anywhere in official documentation. It is a practitioner heuristic that hardened into folklore. The real variable is signal density.",
        "The kill table — zero conversions at 3× target CPA is ~95% confidence the ad won't hit target. 0 conversions: kill at ~2.3× target CPA (90% confidence) or ~3.0× (95%). 1 or fewer: ~3.9× or ~4.7×. 2 or fewer: ~5.3× or ~6.3×. 3 or fewer: ~6.7× or ~7.8×.",
        "Hard rules: never kill on data less than 48–72 hours old — attribution lags, and this is the most common beginner error. Pause, don't delete. Document the rationale so the agency doesn't re-test dead concepts in six months. And always have replacements ready before you kill, so you never create a creative vacuum.",
        "Fast triage, \"results dropped\". CPM up, CTR and CVR stable → auction: check competitors and seasonality, consider new placements or geos. CTR down, CPM and CVR stable → creative: a new concept, not a new variant of the tired one. CVR down, CPM and CTR stable → landing page or funnel: page speed, offer, checkout, stock. Everything stable but reported revenue down → attribution: compare to backend before touching anything. CPM up and CTR down together → ad fatigue, confirmed: substitute creative gradually, don't pause the winner.",
        "Before any of this, ask the client what they changed. Layer one of the diagnostic tree is business economics — AOV, margin, price changes, discount depth, stock. Did the client change price, promo or stock without telling you? It is usually yes. Layer two is demand: Ramazan, bayram, school term, salary dates, an exchange-rate shock. Only then do you look at the auction, the creative, the click, the site, and finally attribution. Raising budget doesn't help a creative problem, and broadening an audience doesn't help an attribution problem.",
        "Small-budget reality — most Kagu clients live here. ₺30,000 a month spread across five ad sets gives each ₺200 a day and none of them will ever learn. The same ₺30,000 in one ad set at ₺1,000 a day might. On small budgets you need 7–14 days for a read, you test creative inside the live ad set rather than in a separate test budget, you stay on Highest Volume because cost caps starve small budgets, and you accept Learning Limited while optimising for a cheaper upstream event such as a lead or add-to-cart instead of a purchase.",
        "On the resources: Ben Heath's scaling video covers automated budget rules and explains why duplicating campaigns causes auction overlap. The Motion video with Dara Denney is not reviewed: once Advantage+ controls budget distribution, spend share stops being a quality signal, so evaluate at the creative level instead."
      ),
      proof:
        "Scale one ad set using the signal-density ladder, and run the diagnostic tree on a live account.",
      proofBrief: paras(
        "Scale one working ad set with the signal-density ladder: read its daily conversions, take the step that band allows, space steps 3–4 days apart, and record CPA before and after each one. Raise budget on the working ad set rather than duplicating it.",
        "Separately, run the diagnostic tree on a live account, top-down, and stop at the first layer where the evidence contradicts what you expected. Start where the tree starts — ask the client what they changed — and compare to backend before you call anything a performance problem."
      ),
      proofSubmit:
        "Scaling: the ad set, its daily conversions, each budget step with its date and percentage, and CPA before and after. Diagnosis: each layer in the order you checked it, what the evidence said, and the layer where you stopped.",
      criteria: [
        "Each budget step matches the ladder band for that ad set's daily conversions",
        "Steps are dated, with CPA shown before and after each one",
        "The diagnosis walks the layers in order, starting with business economics",
        "It stops at the first layer where evidence contradicts expectation, and names it",
        "No customer personal data in the hand-in (KVKK)",
      ],
      day_from: 78,
      day_to: 84,
      hours_low: 6,
      hours_high: 6,
      goals: [
        {
          title: "The signal-density ladder",
          detail:
            "The signal-density ladder, and why the famous \"20% rule\" is a useful default rather than a law.",
        },
        {
          title: "Duplicating winners is mostly a myth",
          detail:
            "Why duplicating winning ad sets is mostly a 2026 myth, and the one case where it still makes sense.",
        },
        {
          title: "The kill table and its Poisson arithmetic",
          detail:
            "The kill table, and the Poisson arithmetic behind it — so you trust it rather than memorise it.",
        },
        {
          title: "Gradual substitution over the kill switch",
          detail:
            "Gradual substitution instead of the kill switch when a winner starts to tire.",
        },
        {
          title: "The seven-layer diagnostic tree",
          detail:
            "The seven-layer diagnostic tree, top-down, stopping at the first layer where evidence contradicts expectation.",
        },
      ],
      proofGoal: "One ad set scaled on the ladder, the diagnostic tree run live",
      resources: [
        {
          title: "The BEST Way To Scale Meta Ads (from $300M ad spend)",
          url: "https://www.youtube.com/watch?v=FyWyHJh_6Ng",
          kind: "video",
          source: "Ben Heath",
        },
        {
          title: "Dara Denney Reveals the BIGGEST Creative Analysis Mistake in 2026 (Most Strategists Do This)",
          url: "https://www.youtube.com/watch?v=Lhl4o7yyuDQ",
          kind: "video",
          source: "Motion · not reviewed",
        },
      ],
    },

    /* ------------------------------------------------------------------ 11 */
    {
      title: "Publishing operations",
      summary:
        "\"Best time to post\" is the most over-claimed topic in social media, and it makes an excellent case study in reading evidence critically. Clock time appears in no official ranking-signal list on Instagram, TikTok or YouTube. It has a real but second-order effect, by improving the odds of early engagement density — which is a ranking input. A junior who spends an hour optimising post time and five minutes on the hook has the ratio exactly backwards.",
      detail: paras(
        "Instagram in-app — free. 75 days ahead, 25 scheduled posts/day; posts, carousels, Reels. The catch: no Stories. Any public account since March 2026 — professional account no longer required.",
        "Meta Business Suite — free. Does schedule Instagram Stories, which the app can't, plus FB Page scheduling, unified inbox, basic analytics. The catch: one Instagram account and one Facebook Page at a time — fine for one brand, unworkable for a roster.",
        "TikTok Studio — free. 10 days ahead; Creator or Business account required. The catch: browser only, not in the mobile app, and you cannot edit after scheduling — delete and re-upload.",
        "Buffer free — 3 channels, 10 scheduled posts per channel, 1 user; Instagram and TikTok auto-publish both work. The catch: the post cap. Enough to learn on, and enough for one small client.",
        "Metricool free — 1 brand, 20 posts/month, with genuinely good analytics for the price. The catch: one brand only. Best free analytics of the group.",
        "Learn the native tools first so you understand what is actually possible, then add a third-party tool only when the roster demands it. Third-party tools publish via the platform APIs, and the TikTok Content Posting API caps at 10 minutes regardless of the account's native limit. Always verify a format publishes before promising a client a workflow.",
        "Cadence, Instagram — 3–5 posts a week yields 12–24% more reach per post than 1–2, with diminishing returns above. Stories daily, 3–7 frames.",
        "Cadence, TikTok — 2–5 a week minimum; 1–2 a day in growth phases. Moving from 1 to 2–5 a week lifts views ~17%. Set cadence from production capacity: a cadence the team can't sustain at quality does more damage than a lower one held consistently.",
        "Turkish peak — primary evening peak 20:00–23:00, secondary 12:00–14:00, tertiary 17:00–19:00. Turkey is UTC+3 year-round with no DST, which removes a whole class of scheduling errors.",
        "Ramazan — iftar creates a hard usage trough followed by a very large spike. During Ramazan, rebuild the schedule around iftar rather than the standard evening peak.",
        "The monthly cycle to run for every client: W−4 strategy review, pillar check, Turkish key dates, brief written · W−3 ideation, scripts, shot list · W−2 batch shoot day — one day yields 4–6 weeks of raw footage · W−1 edit, caption, internal QA, client approval, schedule · W0 publish, engage, monitor · W+1 report, and feed the learnings into the next brief. Set an explicit client-side approval SLA in the contract — approvals are the number one bottleneck in agency social.",
        "Turkish content calendar — build these into every annual plan: Ramazan (shifts ~11 days earlier each year) · Ramazan Bayramı · Kurban Bayramı · 23 Nisan · 19 Mayıs · 30 Ağustos · 29 Ekim, very high engagement and brand posts are expected · 10 Kasım — solemn; commercial posting reads badly, plan a respectful post or go dark · Efsane Cuma, 11.11, back-to-school in September, and the July–August coastal holiday shift.",
        "On the resources: Jade Beason's Metricool guide is not reviewed — a longer second take on the same tool."
      ),
      day_from: 78,
      day_to: 84,
      hours_low: 4,
      hours_high: 4,
      goals: [
        {
          title: "Best-time tables, and the defensible method",
          detail:
            "Why aggregate \"best times to post\" tables are near-worthless for a specific account, and the only defensible method: read the account's own Insights → Audience → Most Active Times, pick two or three windows, hold them constant for four weeks, then compare.",
        },
        {
          title: "Scheduled posts are not penalised",
          detail:
            "That scheduled posts are not penalised. No platform exposes upload method as a ranking signal.",
        },
        {
          title: "Batch by stage, not by client",
          detail:
            "Batch by stage, not by client. Context-switching between clients mid-stage is the largest hidden cost in agency social.",
        },
        {
          title: "The account-scoping safeguard",
          detail:
            "The account-scoping safeguard — publishing to the wrong client account is the most damaging routine error in this job.",
        },
      ],
      resources: [
        {
          title: "How to schedule and grow your social platforms (Full Metricool Tutorial)",
          url: "https://www.youtube.com/watch?v=cvzsihm4qU8",
          kind: "video",
          source: "Modern Millie",
        },
        {
          title: "Complete guide to Metricool! | 2026 Social Media Management Tool",
          url: "https://www.youtube.com/watch?v=_5GWhkr6EUo",
          kind: "video",
          source: "Jade Beason · not reviewed",
        },
        {
          title: "Posting frequency guide — 100,000+ accounts",
          url: "https://buffer.com/resources/social-media-frequency-guide/",
          kind: "read",
          source: "Buffer",
        },
        {
          title: "Metricool — free tier",
          url: "https://metricool.com/pricing/",
          kind: "link",
          source: "Metricool",
        },
        {
          title: "Buffer — free tier",
          url: "https://buffer.com/pricing",
          kind: "link",
          source: "Buffer",
        },
      ],
    },

    /* ------------------------------------------------------------------ 12 */
    {
      title: "Client work",
      summary:
        "Commit to inputs and process with certainty, and to outcomes with ranges and conditions. That one distinction prevents most of the relationships that go wrong.",
      detail: paras(
        "The month-one conversation, scripted: \"Month one we are buying data, not results. Expect volatile costs while the algorithm learns. We need roughly 50 conversion events per week before anything is stable. I'll show you the learning-phase status in the first report so you can see it directly.\" Then record a baseline before launch: monthly leads, CPA if known, conversion rate, AOV, average response time. Without a baseline, every future conversation is opinion.",
        "Never commit to: a guaranteed number of sales. \"First page\", \"viral\", or a follower count. A ROAS figure before you've seen a month of data. And never let a monthly report be the first time a client hears bad news — if something breaks on the 8th, they hear it on the 8th.",
        "Questions to add to the onboarding form for a Turkish local client: Which cities and districts do you actually serve? (Default radius targeting is usually wrong.) Is your Instagram a business account linked to a Business Portfolio? Do you have a website, or is Instagram the whole business? Do you want leads by WhatsApp, phone, DM or form? Who answers the WhatsApp, and how fast? (Lead response time destroys more accounts than targeting ever will.) Do you have e-fatura set up, and ETBİS registration if you sell online? Is there a vergi levhası that matches the ad account?",
        "What a monthly client report contains. 1 · Headline — one sentence, plain language: what happened and what it means; never lead with impressions and reach. 2 · Business metrics — spend, leads or sales, CPA/CPL, revenue, MER, each against target. 3 · Trend — this month vs last month vs the same month last year, on the same calendar window every time. 4 · What we did — actions taken, tests run. 5 · What we learned — including the failures. 6 · Next month — three specific commitments. 7 · Appendix — creative-level and campaign-level tables, plus a backend cross-check line.",
        "Annotate platform changes in the report. \"Meta changed attribution on 3 March; the +38% in reported ROAS is a reporting change, not a performance change.\" Doing that once buys years of credibility.",
        "Escalation triggers — automatic, not discretionary: CPA above target for 7 consecutive days · spend pacing off by more than 20% against plan · any ad account or Page restriction · pixel or CAPI events stop firing for more than 24 hours · client stops responding for more than 5 business days · client mentions \"results\" and \"contract\" in the same message.",
        "AI in the workflow: drafts, never signatures. AI is genuinely good at volume variations on a human-validated winner, reading 200 reviews to extract recurring objections in the customer's own vocabulary, first drafts, and Turkish voiceover. It is a liability for unverified factual claims in ads, and AI-cloned likenesses of real people are outright illegal in Turkey since 1 August 2026, with no disclosure exemption. Three gates before anything ships: every claim traceable to a document the client can produce; a native Turkish speaker reads it aloud; AI disclosure applied where required. And never paste a client's customer list or CRM export into a consumer AI tool — that is a KVKK transfer abroad with no legal basis.",
        "On the resources: the AgencyAnalytics checklist is also in stage 02 — rewatch it here with the client conversation in mind rather than the access checklist. Looker Studio's paid part is the connectors, since Meta and TikTok are not native Google sources; the free workaround is to schedule Meta and TikTok exports into Google Sheets and connect Sheets to Looker Studio — about an hour of setup per client, refreshing daily."
      ),
      proof: "Write one full monthly client report and present it internally.",
      proofBrief: paras(
        "Write one full monthly report for a real client in the seven sections this stage sets out: headline, business metrics against target, trend on the same calendar window, what we did, what we learned including the failures, three commitments for next month, and an appendix with a backend cross-check line.",
        "Then present it internally. Lead with the headline sentence, never with impressions and reach, and annotate any platform change that moved the numbers so nobody reads it as performance."
      ),
      proofSubmit:
        "Attach the report. Add who you presented it to, and the hardest question you were asked with how you answered it.",
      criteria: [
        "All seven sections are present, in order",
        "The headline is one plain-language sentence: what happened and what it means",
        "Business metrics are each shown against target, MER included",
        "The appendix carries a backend cross-check line",
        "No customer personal data — aggregates only (KVKK)",
      ],
      day_from: 78,
      day_to: 84,
      hours_low: 4,
      hours_high: 4,
      goals: [
        {
          title: "What you can commit to, and what needs a range",
          detail:
            "What you can safely commit to — creatives produced, tests run, reporting cadence, tracking verified — versus what needs a range and a condition attached.",
        },
        {
          title: "The month-one script",
          detail: "The month-one script, word for word.",
        },
        {
          title: "What a real strategy document contains",
          detail:
            "What a real strategy document contains, and its test: a new account manager can pick it up and run the account without asking anyone anything.",
        },
        {
          title: "Measurement, execution or fundamentals",
          detail:
            "The three situations when an account isn't working — measurement problem, execution problem, fundamentals problem — and that each needs a different conversation.",
        },
        {
          title: "Lead quality is your job",
          detail: "Why lead quality is your job, not the client's.",
        },
      ],
      proofGoal: "A full monthly client report, presented internally",
      resources: [
        {
          title: "HOW TO ONBOARD A SOCIAL MEDIA CLIENT IN 2026 (Our Exact Agency Workflow)",
          url: "https://www.youtube.com/watch?v=G2PI12jWz1o",
          kind: "video",
          source: "Milou Pietersz",
        },
        {
          title: "7-STEP Client Onboarding Checklist for Agencies!",
          url: "https://www.youtube.com/watch?v=BM-uvTzZfIc",
          kind: "video",
          source: "AgencyAnalytics",
        },
        {
          title: "Looker Studio",
          url: "https://lookerstudio.google.com/",
          kind: "link",
          source: "Google",
        },
      ],
    },

    /* ------------------------------------------------------------------ 13 */
    {
      title: "Türkiye: tax & law",
      summary:
        "This module is the difference between a competent account manager and one who loses client trust at invoice time. It is also the module where a mistake costs real money — advertising fines in Turkey reach 8,635,800 TL for internet ads, multiplied up to tenfold for a repeat violation within a year.",
      detail: paras(
        "This stage is not a one-off, which is why it carries no dates. Re-read the disclosure rules before every creator brief and the tax table before every billing conversation.",
        "The 1 August 2026 advertising regulation — the single most important thing in this program. Amendment to the Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği, Resmî Gazete 1 July 2026, issue 33297, Article 23/A. In force since 1 August 2026, enforced by the Reklam Kurulu.",
        "Only \"Reklam\" or \"Tanıtım\" satisfy disclosure. #işbirliği, #sponsorlu, #ortaklık and #hediye no longer do — and neither does Instagram's built-in \"Paid partnership\" label on its own. This catches every agency, because #işbirliği was the universal convention for five years.",
        "The disclosure must identify the advertiser — the brand name directly, or \"@[marka] tarafından sağlandı\", or \"@[marka]'a teşekkürler\". Expected format: REKLAM | @brand. Placement: visible at first glance without scrolling or tapping \"daha fazla\", before all other hashtags, high contrast, not overlapping platform icons.",
        "Every frame of a carousel or Story needs its own disclosure; reposting from feed to Story means adding it again. Video requires a spoken disclosure in addition to the written label. Podcasts: stated twice. Scope now includes gifted products, affiliate arrangements, giveaways and event invitations — not just classic paid posts.",
        "AI-generated content and digital characters must be disclosed. Deepfake endorsements using a real person's cloned likeness are strictly prohibited, with no disclosure exemption. Discounts: the reference price must be the lowest price in the 10 days before the discount starts. Reviews: only verified purchasers. Environmental claims need third-party certification.",
        "Brands are liable alongside creators. Assuming creator compliance is not a defence — put the exact wording in every creator contract. Operationally: make disclosure a blocking item in internal QA, build a Turkish disclosure snippet library so juniors copy-paste rather than compose, and re-brief every creator on the roster — most are still using #işbirliği.",
        "Stopaj, withholding on internet advertising — 15%, paid by you / the payer. Presidential Decision 476, in force since 1 Jan 2019. Applies to payments to foreign entities without a Turkish presence; 0% to resident Turkish companies. Declared on the monthly Muhtasar Beyanname. The Danıştay has rejected the treaty defence — withhold.",
        "KDV (VAT) — 20%, paid by you. If the client's VKN is registered with Meta, Meta charges no VAT and the client self-assesses via KDV-2, then deducts it. If no VKN is registered, Meta charges 20% directly and it cannot be recovered. A five-minute fix worth real money — put it on the onboarding checklist.",
        "Dijital Hizmet Vergisi (DST) — 5% in 2026, dropping to 2.5% on 1 Jan 2027, paid by Meta and Google, not you. Presidential Decision 10767, RG 25 Dec 2025. Levied on the platform's gross revenue. Clients will ask — the answer is \"DST is levied on Meta, not on you.\"",
        "Google \"Turkey Regulatory Operating Cost\" — 4.5% since 1 Jan 2026, down from 7%, paid by you. A separate line item on the invoice, applied wherever ads serve in Turkey regardless of where the advertiser is.",
        "Meta \"Location Fee\" — 5%, new since 1 July 2026, paid by you. Charged on where the audience is, not where the business is. Added on top of spend after delivery. Appears only on invoices and in Billing, never in Ads Manager — which is why the two now disagree.",
        "The worked example every account manager must be able to do live: ₺100,000 of Meta spend delivered in Turkey: ₺100,000 media + ₺5,000 location fee = ₺105,000, plus 20% VAT = ₺126,000 billed — before any withholding obligation. Ads Manager will show ₺100,000. Budget an extra 15–17.6% beyond stated ad spend for the tax stack, and decide in the contract whether Kagu's card or the client's card pays Meta, because that determines who carries the stopaj and the KDV-2. Most Turkish agencies push ad spend onto the client's card and invoice only the management fee. It is administratively far cleaner.",
        "KVKK — yes, cookie consent is required in Turkey. Explicit consent (açık rıza) before setting marketing and analytics cookies — KVKK's guidance explicitly puts Google Analytics outside the exemption. Banners need opt-in defaults, equal prominence for accept and reject, no cookie walls, and withdrawal as easy as granting. Per Board Decision 2026/347, combining the aydınlatma metni and the açık rıza metni into one document is now prohibited.",
        "Meta Pixel, TikTok Pixel and GA4 all transfer personal data abroad, which triggers the Article 9 transfer regime and needs a lawful mechanism — in practice the standard contractual clauses, notified to the Board within 5 business days. Server-side tracking does not create a legal basis; vendors market it as \"recovering lost data\", which is legally misleading.",
        "The practical consequence you must warn the client about before it shows up in a report: a compliant banner means the pixel fires only after consent, so you lose signal — worse EMQ, fewer events, a bigger Meta-vs-backend gap. This is the most common \"why did our numbers drop\" conversation in the Turkish market.",
        "On the resources: print the CBHukuk guide and keep it next to the QA checklist; Vibemetri is a second independent read on the same amendment. Read Erdem & Erdem before the billing conversation with a client's mali müşavir. On TikTok, VAT ID review takes 24–72 hours and VAT charged during the review window is non-refundable — do it on day one of onboarding. VERBİS has no GDPR equivalent, and an agency processing client customer data is itself a data controller. İYS: if a Meta Lead Form collects a phone number and the client then SMSes that lead, İYS consent is required, and fines are per message. There is no credible public Meta CPM benchmark for Turkey — pull Kagu's own blended CPM, CPC and CTR from live accounts and use those as the house benchmark."
      ),
      hours_low: 5,
      hours_high: 5,
      goals: [
        {
          title: "The 1 August 2026 disclosure rules (Article 23/A)",
          detail:
            "Only \"Reklam\" or \"Tanıtım\" satisfy disclosure; #işbirliği, #sponsorlu, #ortaklık and #hediye no longer do. The label names the advertiser (REKLAM | @brand), is visible at first glance, repeats on every frame, is spoken in video — and brands are liable alongside creators.",
        },
        {
          title: "The tax stack on ad spend",
          detail:
            "Stopaj 15% and KDV 20% fall on the payer; DST 5% falls on Meta and Google, not you; Google's 4.5% operating cost and Meta's 5% location fee are line items you pay.",
        },
        {
          title: "The ₺100,000 worked example, done live",
          detail:
            "₺100,000 media + ₺5,000 location fee = ₺105,000, plus 20% VAT = ₺126,000 billed while Ads Manager shows ₺100,000 — and whose card pays Meta decides who carries the stopaj and the KDV-2.",
        },
        {
          title: "KVKK: cookie consent and transfers abroad",
          detail:
            "Explicit consent before marketing and analytics cookies, the Article 9 transfer regime for pixels and GA4, and the warning to give the client before the report shows it: a compliant banner means less signal.",
        },
        {
          title: "İYS consent for email, SMS and calls",
          detail:
            "Marketing by email, SMS or automated call needs prior consent deposited in İYS — a Meta Lead Form phone number is not that consent, and fines are per message.",
        },
      ],
      resources: [
        {
          title: "Influencer advertising rules in Türkiye",
          url: "https://www.cbhukuk.com/en/influencer-advertising-rules-turkey/",
          kind: "read",
          source: "CBHukuk",
        },
        {
          title: "Türkiye's new advertising regulation, in force 1 August 2026",
          url: "https://vibemetri.com/en/blog/ad-regulation-2026-guide",
          kind: "read",
          source: "Vibemetri",
        },
        {
          title: "The withholding tax issue in digital advertising services",
          url: "https://www.erdem-erdem.av.tr/en/insights/withholding-tax-issue-in-digital-advertising-services",
          kind: "read",
          source: "Erdem & Erdem",
        },
        {
          title: "TikTok — Türkiye: Value Added Tax",
          url: "https://ads.tiktok.com/help/article/turkey-vat?lang=en",
          kind: "read",
          source: "TikTok Ads Help Centre",
        },
        {
          title: "Jurisdiction-specific surcharges",
          url: "https://support.google.com/google-ads/answer/9750227?hl=en",
          kind: "read",
          source: "Google Ads Help",
        },
        {
          title: "KVKK — Kişisel Verileri Koruma Kurumu",
          url: "https://www.kvkk.gov.tr/",
          kind: "read",
          source: "Official regulator",
        },
        {
          title: "İYS — İleti Yönetim Sistemi",
          url: "https://iys.org.tr/",
          kind: "read",
          source: "State-run consent platform",
        },
        {
          title: "Google Ads CPC benchmarks, Turkey 2026",
          url: "https://avangardreklam.com/en/blog/google-ads-pricing-turkey-2026/",
          kind: "read",
          source: "Avangard Reklam",
        },
      ],
    },

    /* ------------------------------------------------------------------ 14 */
    {
      title: "Free certifications",
      summary:
        "Certifications don't make anyone good at this job, but they force structured coverage and they look right on a proposal. Take them in this order. Everything here is free — Meta's Blueprint courses are free but its certification exams are not, so treat those as optional and skip them unless a client asks.",
      detail: paras(
        "The 90-day path places three of these inside the program: start Fundamentals of Digital Marketing in weeks 1–2, sit the TikTok Media Buying path in weeks 5–7, and sit the Google Ads Search certification in weeks 8–9.",
        "Two corrections to what you'll find by googling. Google Digital Garage no longer exists as a separate platform — learndigital.withgoogle.com redirects to grow.google, and Fundamentals of Digital Marketing now lives on Skillshop. Google Analytics Academy no longer exists either; it redirects to Skillshop too. And metacertified.com is not Meta's site — it is a parked domain for sale."
      ),
      proof: "Sit the Google Ads Search certification and the TikTok Media Buying path.",
      proofBrief: paras(
        "Two of the six are scheduled inside the 90-day path, and they are the hand-in: the TikTok Media Buying path in weeks 5–7, alongside TikTok Ads, and the Google Ads Search certification in weeks 8–9, alongside Google Ads.",
        "The Search exam is roughly 75 minutes and 46–50 questions, needs 80% to pass, and is valid for one year. Both are free — take them on Skillshop and TikTok Academy, not on a lookalike site."
      ),
      proofSubmit:
        "Attach the Google Ads Search certificate and proof that the TikTok Media Buying path is complete — its certificate, or a screenshot of the finished path.",
      criteria: [
        "The Google Ads Search certificate is attached, in your name, and in date",
        "The TikTok Media Buying path shows as complete",
        "Both came from the official platforms — Google Skillshop and TikTok Academy",
      ],
      goals: [
        {
          title: "Fundamentals of Digital Marketing",
          detail: "Google Skillshop · 17 modules, ~40 hours · free.",
        },
        {
          title: "Google Analytics Certification",
          detail: "Google Skillshop · 50 questions, 75 min, 80% to pass · free.",
        },
        {
          title: "Google Ads Search Certification",
          detail: "Google Skillshop · ~75 min, 46–50 questions, valid 1 year · free.",
        },
        {
          title: "Google Ads Measurement Certification",
          detail: "Google Skillshop · same format as Search · free.",
        },
        {
          title: "TikTok Media Buying Expert path",
          detail: "TikTok Academy · learning path + exam prep · free.",
        },
        {
          title: "Meta Blueprint learning paths",
          detail:
            "Meta Blueprint · microlearning, 1–5 min modules · courses free, exams paid — skip the exams.",
        },
      ],
      proofGoal: "Google Ads Search certified, TikTok Media Buying path done",
    },
  ],

  // Module 00, "How to use this". It is the method rather than a stage — see
  // the note at the top of the file.
  rules: [
    {
      label: "In order",
      title: "Work the stages in order",
      body: "They are sequenced so that nothing later depends on something you haven't met yet — measurement comes before campaign building, not after, because signal quality is where juniors do damage that can't be undone.",
    },
    {
      label: "Out loud",
      title: "Explain it before you move on",
      body: "Each stage lists what you must be able to explain out loud before moving on. If you can't, rewatch.",
    },
    {
      label: "2026",
      title: "Feed and steer the system",
      body: "2025–26 was the year Meta, TikTok and Google all collapsed their manual controls into AI-driven campaign types. You are not learning how to pick interests any more; you are learning how to feed and steer an automated system — conversion signal quality, creative volume, and structural discipline.",
    },
    {
      label: "Creative",
      title: "Your creative decides who sees your ad",
      body: "Meta's ranking system (Andromeda) now identifies buyers from creative signals rather than from your audience settings. So a creative brief is a targeting specification: \"Show a 35-year-old mother in a kitchen\" is an instruction to the algorithm, not an aesthetic preference.",
    },
    {
      label: "Dates",
      title: "Check the date, then the primary source",
      body: "Before you accept any marketing claim — from a YouTuber, a blog, a client, or this program — ask where the number came from and when. A Turkish law firm listed #İşbirliği as valid ad disclosure in February 2026; it became illegal on 1 August 2026.",
    },
  ],
};
