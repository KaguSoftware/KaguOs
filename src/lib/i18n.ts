/**
 * The client portal's chrome, in both languages.
 *
 * ── What belongs here and what doesn't ──────────────────────────────────────
 *
 * Here: every word the PORTAL says in its own voice — the header, the nav, the
 * buttons, the progress line, the send panel, the finance table, the account
 * page. These are written once and shown to every client.
 *
 * Also here, less obviously: what a server action says BACK. An action reads
 * the locale cookie and resolves its own sentence before returning, so a toast
 * shows a dictionary value rather than a code the client has to map. And the
 * /login copy — the one screen a client meets before the portal shell exists.
 *
 * NOT here: the questions. Those live in `lib/intake.ts` as pack data, already
 * carrying their own `labelAr` / `hintAr` / `titleAr` beside each English
 * string, and they differ per pack. `pick()` from `lib/locale.ts` chooses
 * between those two halves at render time. Copying them into a dictionary would
 * mean two places to edit a reworded question and one of them silently winning.
 *
 * ── Why a plain object and not a library ────────────────────────────────────
 *
 * Two locales, one namespace, and no translator workflow. Arabic's counted-noun
 * agreement is the one genuine rule, and `arPlural` below covers it in four
 * lines — less than the setup cost of an ICU plural engine, and unlike one it
 * can fix the verb as well as the noun. `next-intl` would add a provider, a
 * build step and a routing convention to solve problems this app does not have.
 * A typed record gives the same completeness guarantee the compiler-checked
 * way: `Dict` is derived from the English, so a missing Arabic key is a type
 * error rather than a blank label found in production.
 *
 * Interpolation is a function per string that needs it, not a `{count}` mini
 * language — Arabic and English put the number in different places, and a
 * template string lets each say so.
 */
import type { Locale } from "@/lib/locale";
import type {
  InstallmentStatus,
  InvoiceStatus,
  MilestoneStatus,
  PaymentCadence,
  PaymentPlanKind,
} from "@/lib/types";

const en = {
  /* ── shell ─────────────────────────────────────────────────────────────── */
  skipToContent: "Skip to content",
  yourProjects: "Your projects",
  yourProjectsAria: "KaguOs — your projects",
  yourAccount: "Your account",
  signOut: "Sign out",
  language: "Language",
  footerOwner: "Kagusoftware",
  footerWhat: "Client portal",

  /* ── the rail ──────────────────────────────────────────────────────────── */
  yourDashboard: "Your dashboard",
  dashboardAria: "KaguOs — your dashboard",
  portalNav: "Portal",
  menu: "Menu",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  accountAria: (who: string) => `Account — ${who}`,
  navDashboard: "Dashboard",
  navDashboardHint: "Everything at a glance",
  navInputs: "Inputs",
  navInputsHint: "What we need from you",
  navProgress: "Progress",
  navProgressHint: "Where the build is",
  navFinance: "Finance",
  navFinanceHint: "Invoices and payments",

  /* ── portal index ──────────────────────────────────────────────────────── */
  indexBlurb:
    "Everything Kagu is building for you, and what we still need from you to build it.",
  yourInputs: "Your inputs",
  inputsBlurb:
    "One pack per business — everything Kagu needs from you to build it. It saves as you type.",
  nothingSharedTitle: "Nothing shared with you yet",
  nothingSharedHint:
    "Your account is set up. As soon as Kagu shares a project with it, it appears here — no need to check back, you'll be told.",
  filledIn: (pct: number) => `${pct}% filled in`,
  sentAgo: (rel: string) => `sent ${rel}`,

  /* ── dashboard ─────────────────────────────────────────────────────────── */
  hello: (name: string) => `Hello, ${name}`,
  dashNothingSharedHint:
    "Your account is set up. As soon as Kagu shares a project with it, everything about that build shows up here — you'll be told, so there's no need to keep checking.",
  packNotStarted: "your input pack hasn't been started",
  packFilledIn: (pct: number) => `your input pack is ${pct}% filled in`,
  finishIt: "finish it",
  invoicesOverdue: (n: number) =>
    n === 1
      ? "One invoice is past its due date"
      : `${n} invoices are past their due date`,
  seeFinance: "see finance",
  nothingNeedsYou: "Nothing needs you right now — everything is on our side.",
  build: "Build",
  buildProgressAria: (name: string) => `${name} build progress`,
  yourInputPack: "Your input pack",
  outstanding: "Outstanding",
  nextUp: "Next up",
  targetOn: (date: string) => `target ${date}`,
  recently: "Recently",

  /* ── progress page ─────────────────────────────────────────────────────── */
  progressDescription:
    "What Kagu has finished, what's underway, and what we're waiting on.",
  /* The "nothing shared yet" pair lives in the portal-index block above —
     the same sentence, said once. */
  noPlanTitle: "No plan shared yet",
  noPlanHint:
    "Kagu will publish the steps of this build here. Until then, the input pack is the thing to get on with.",
  phasesDone: (done: number, total: number) => `${done}/${total} done`,
  nextIs: (title: string) => `Next: ${title}`,
  planNotShared: "The plan hasn't been shared yet",
  everythingDone: "Everything on the plan is done",
  weightedNote:
    "Phases count for different amounts — the bigger ones move this further.",
  sentThankYou: "Sent to Kagu — thank you",
  carryOn: "Carry on filling it in",
  blockedCount: (n: number) =>
    n === 1 ? "One thing is blocked" : `${n} things are blocked`,
  ofTheProject: (pct: string) => `${pct}% of the project`,
  countedSoFar: (pct: string) => `${pct}% of it counted so far`,
  phaseProgressAria: (name: string) => `${name} — how far through this phase`,
  /* One function rather than a literal, because the sign differs: "%" here,
     "٪" in Arabic, and a number rendered by the component must match the
     sentences around it. */
  percent: (pct: number) => `${pct}%`,
  statusPlanned: "Planned",
  statusInProgress: "In progress",
  statusDone: "Done",
  statusBlocked: "Blocked",
  late: "Late",
  doneOn: (date: string) => `done ${date}`,

  /* ── progress: the four systems ─────────────────────────────────────────── */
  systemsAria: "The systems being built, one column each",
  systemProgressAria: (name: string) => `${name} — how far along`,
  shareOfBuild: (pct: string) => `${pct}% of the build`,
  shareOfSystem: (pct: string) => `${pct}% of this system`,
  stepsDone: (done: number, total: number) => `${done}/${total} steps done`,
  partOf: (system: string) => `Part of ${system}`,
  systemProgress: "How far through this system",
  stepProgress: "How far through this step",
  stepProgressAria: (name: string) => `${name} — how far through this step`,
  whatThisIs: "What this is",
  notStartedYet: "Not started yet",
  closeStep: "Close this step",
  closeSystem: "Close this system",
  /* The sentence under the greeting. A whole function rather than fragments a
     caller joins: English needs the comma-and list and a leading capital, and
     Arabic needs neither — a shared join() in the page would have to know
     both. */
  headline: (packs: number, overdue: number, blocked: number) => {
    const parts: string[] = [];
    if (packs > 0) {
      parts.push(
        packs === 1
          ? "one input pack still needs finishing"
          : `${packs} input packs still need finishing`
      );
    }
    if (overdue > 0) {
      parts.push(
        overdue === 1
          ? "one invoice is past due"
          : `${overdue} invoices are past due`
      );
    }
    if (blocked > 0) {
      parts.push(
        blocked === 1 ? "one step is blocked" : `${blocked} steps are blocked`
      );
    }
    if (parts.length === 0) {
      return "Everything is with us — nothing is waiting on you.";
    }
    const sentence =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  },

  /* ── the pack ──────────────────────────────────────────────────────────── */
  packBlurb:
    "Everything Kagu needs from you to build this, in one place. It saves as you type — you can leave and come back.",
  answered: (pct: number) => `${pct}% answered`,
  saving: "Saving…",
  saved: "Saved",
  savesAsYouGo: "Saves as you go",
  sections: "Sections",
  sectionsNav: "Pack sections",
  back: "Back",
  next: "Next",
  stepOf: (i: number, n: number) => `Step ${i} of ${n}`,
  goToReview: "Review and send",
  required: "required",
  optionalIfApplies: "only if it applies",
  nothingYet: "Nothing yet.",
  remove: "Remove",
  removeSure: "Sure?",
  removeLineAria: (n: number, card: string) => `line ${n} of ${card}`,
  lineCount: (n: number) => (n === 1 ? "1 line" : `${n} lines`),
  linesIncomplete: (n: number) =>
    n === 1
      ? "1 line is missing something"
      : `${n} lines are missing something`,
  stillToAnswer: (n: number) => `${n} still to answer`,
  weekLeft: (n: number) => `${n} left`,
  weekLeftRest: "in the answers that unlock the build",
  weekAllDone: "Everything the build needs to start is answered",
  sectionDone: "Done",
  weekShort: (n: number) => `Week ${n}`,
  packProgressAria: (name: string) => `${name} input pack completion`,

  /* ── finance ───────────────────────────────────────────────────────────── */
  financeBlurb:
    "What you have been invoiced, what is scheduled next, and where each of them stands. Drafts aren't shown — an invoice appears here once it's been sent.",
  financeNothingSharedHint:
    "As soon as Kagu shares a project with your account, its invoices appear here.",
  pastDueCount: (n: number) => (n === 1 ? "One past due" : `${n} past due`),
  nothingOverdue: "Nothing overdue",
  nothingOwedNow: "Nothing owed right now",
  overdueLabel: "Overdue",
  settleWhenYouCan: "Please settle when you can",
  paidToDate: "Paid to date",
  nextScheduledPayment: "Next scheduled payment",
  noInvoicesTitle: "No invoices yet",
  noInvoicesHint:
    "Nothing has been billed for your projects, and no payment plan has been agreed. When either happens, it shows up here with its dates.",
  outstandingInline: "outstanding",
  nothingInvoicedWithPlan:
    "Nothing invoiced yet — the payments above are the schedule, and each one gets an invoice when it comes due.",
  nothingInvoicedYet: "Nothing invoiced for this one yet.",
  financeDisputeNote:
    "Something here look wrong? Tell whoever you normally speak to at Kagu — this page is a copy of our records, not a place to dispute them, and we would rather fix it at the source.",
  swipeTableHint: "Swipe the table sideways for the amount and status.",
  invoiceColInvoice: "Invoice",
  invoiceColIssued: "Issued",
  invoiceColDue: "Due",
  invoiceColAmount: "Amount",
  invoiceColStatus: "Status",
  invoicePaidOn: (date: string) => `paid ${date}`,
  planRecurringHeadline: (amount: string, per: string) => `${amount} / ${per}`,
  planInstalmentsHeadline: (n: number, amount: string) => `${n} × ${amount}`,
  planPaymentCount: (n: number) => (n === 1 ? "1 payment" : `${n} payments`),
  planRange: (kind: string, from: string, to: string | null) =>
    `${kind} from ${from}${to ? ` to ${to}` : " — ongoing"}`,
  planPaymentsAria: (title: string) => `${title} — payments made`,
  /* The one place this pass changes English. The caption was a bare "3/12",
     and every other meter in the app names its unit — `${done}/${total} done`,
     `${done}/${total} steps done`. */
  paymentsMade: (done: number, total: number) => `${done}/${total} paid`,
  paidAndToCome: (paid: string, remaining: string) =>
    `${paid} paid · ${remaining} to come`,
  pastItsDateCount: (n: number) =>
    n === 1 ? "1 past its date" : `${n} past their date`,
  installmentPaidOn: (date: string) => `Paid ${date}`,
  installmentNext: "Next",

  /* ── finance: status vocabulary ────────────────────────────────────────── */
  /* The same states the `*_LABELS` records in lib/types.ts spell out for the
     team, said again here because the portal is the one surface that needs
     them in two languages. The mappers at the foot of this file join the two,
     so no page writes the switch a third time. */
  invoiceStatusDraft: "Draft",
  invoiceStatusSent: "Sent",
  invoiceStatusPaid: "Paid",
  invoiceStatusVoid: "Void",
  invoiceStatusOverdue: "Overdue",
  installmentStatusScheduled: "Scheduled",
  installmentStatusInvoiced: "Invoiced",
  installmentStatusPaid: "Paid",
  installmentStatusWaived: "Waived",
  installmentStatusLate: "Past its date",
  planKindInstalments: "Instalments",
  planKindRecurring: "Recurring",
  planKindCustom: "Custom dates",
  cadencePerWeek: "week",
  cadencePerMonth: "month",
  cadencePerQuarter: "quarter",
  cadencePerYear: "year",

  /* ── review and send ───────────────────────────────────────────────────── */
  reviewTitle: "Review and send",
  reviewBlurb:
    "Everything above is already saved and already visible to us — sending is how you say it's ready to work from. You can send an unfinished pack: the week-1 answers are what unlock the build, and the rest can follow.",
  sendButton: "Send to Kagu",
  sendAllDone: "That's everything. Send it over.",
  sendSomeOpen: (n: number) =>
    `${n} still open — send anyway if the rest needs someone who isn't around.`,
  sentLine: (rel: string) => `Sent ${rel}.`,
  sentAfter:
    "Kagu has it. Spotted something wrong? Change it above — it saves straight away, and we see the change.",
  reopenButton: "Mark as still working on it",

  /* ── toasts ────────────────────────────────────────────────────────────── */
  toastSent: "Sent to Kagu.",
  toastReopened: "Reopened — it's yours again.",
  toastAddFailed: "Couldn't add that line.",
  toastGeneric: "Something went wrong. Please try again.",

  /* ── account ───────────────────────────────────────────────────────────── */
  accountBack: "Back",
  accountName: "Your name",
  accountFullName: "Full name",
  accountSaveName: "Save name",
  accountPassword: "Password",
  accountNewPassword: "New password",
  accountRepeatPassword: "Repeat new password",
  accountChangePassword: "Change password",
  textSize: "Text size",
  textSizeSmall: "Small",
  textSizeDefault: "Default",
  textSizeLarge: "Large",
  textSizeLargest: "Largest",
  textSizeNote:
    "Applies everywhere in KaguOs, on this browser only — each device you sign in on has its own. For bigger than this, your browser's zoom scales the layout too.",

  /* ── date picker ───────────────────────────────────────────────────────── */
  /* Chrome only. The month and weekday names come from `Intl` inside the
     calendar, which is the same source the field's own value is formatted
     from — so the header cannot drift from the date it writes back. */
  datePlaceholder: "Pick a date…",
  dateClearAria: "Clear date",
  dateCalendarAria: "Calendar",
  datePrevMonth: "Previous month",
  dateNextMonth: "Next month",
  dateToday: "Today",
  dateClear: "Clear",

  /* ── shared UI ─────────────────────────────────────────────────────────── */
  toastDismiss: "Dismiss",
  yourBusinesses: "Your businesses",
  justNow: "just now",

  /* ── the error screen ──────────────────────────────────────────────────── */
  /* `(client)/error.tsx` renders BOTH halves at once and hides one with a CSS
     direction gate — an error boundary is a Client Component and cannot read
     the locale cookie. So this is the one group in the file whose English and
     Arabic reach the same browser together. */
  errorTitle: "This page didn't load",
  errorBlurb:
    "Something went wrong at our end while fetching your data — nothing you have sent has been lost. Try again; if it keeps happening, send the reference below to Kagu.",
  errorRetry: "Try again",
  errorReference: "Reference",

  /* ── action results ────────────────────────────────────────────────────── */
  /* What a server action hands back. The action resolves these itself from the
     request's own cookie, so what arrives at a toast is a finished sentence.
     A teammate never writes the locale cookie, so they read the English. */
  actionMissingProject: "Missing project.",
  actionUnknownQuestion: "That question isn't part of the pack.",
  actionUnknownTable: "That table isn't part of the pack.",
  actionTooManyLines: (max: number) =>
    `That's ${max} lines — send us the rest as a spreadsheet instead.`,
  actionNotYourAccount: "That isn't something your account can do.",
  actionProjectNotShared: "That project isn't shared with your account.",
  actionSaved: "Saved.",
  actionLineAdded: "Line added.",
  actionLineRemoved: "Line removed.",
  actionSaveFailed: "Couldn't save that — please try again.",
  actionSentDetail:
    "Sent to Kagu — we'll come back to you on anything unclear.",
  accountNameLength: "Name must be 1–80 characters.",
  accountNotSignedIn: "Not signed in.",
  accountNameSaved: "Name updated.",
  accountPasswordShort: "Password must be at least 8 characters.",
  accountPasswordMismatch: "Passwords don't match.",
  accountPasswordSaved: "Password changed.",

  /* ── sign in ───────────────────────────────────────────────────────────── */
  /* /login is the one route a client and a teammate both land on, and there is
     no signal before authentication to tell them apart. So this is today's
     staff-facing wording translated as it stands, not quietly rewritten — the
     copy itself is a product decision, flagged rather than taken here. */
  signIn: "Sign in",
  loginBlurb: "Kagu's internal system. Sign in with your team account.",
  loginNoAccount:
    "No account? Accounts are created by an admin — ask Parsa or Majed.",
  loginEmail: "Email",
  loginEmailPlaceholder: "you@kagusoftware.com",
  loginPassword: "Password",
  loginWrongCredentials: "Wrong email or password.",
  appDescription: "Kagu's internal system",
};

/**
 * The English shape IS the contract. Every key, with the same arity, must exist
 * in Arabic — the compiler enforces it, so a forgotten translation cannot ship
 * as an empty string.
 *
 * ⚠️ `en` is deliberately NOT `as const`. With it, every value narrows to its
 * own literal type ("Saved", not string) and the Arabic half cannot satisfy the
 * contract — the compiler would demand that the translation of "Saved" be the
 * word "Saved". Widening is what makes this a shape check rather than an
 * equality check.
 */
type Dict = { [K in keyof typeof en]: (typeof en)[K] };

/**
 * Arabic counts the noun four ways: one, two (dual), 3–10 (broken plural), and
 * 11+ (singular accusative). English needs two. Rather than a noun-agreement
 * helper — which cannot fix the VERB agreement the dual also forces — each
 * branch is a whole ready-made sentence and this only picks between them.
 *
 * Exported for `lib/email/templates.ts`, which writes the same two languages
 * into a mail body and has the same four branches to pick between. A second
 * copy of this rule is a second place for it to be got wrong.
 */
export function arPlural(
  n: number,
  one: string,
  two: string,
  few: string,
  many: string
) {
  return n === 1 ? one : n === 2 ? two : n <= 10 ? few : many;
}

const ar: Dict = {
  /* ── shell ─────────────────────────────────────────────────────────────── */
  skipToContent: "تخطَّ إلى المحتوى",
  yourProjects: "مشاريعكم",
  /* These two name the wordmark LINK, so they open with the mark as it is
     actually drawn. An accessible name that says "كاغو" where the eye reads
     "KaguOs" fails WCAG 2.5.3, and a voice-control user asking for the link
     by the word they can see would not reach it. */
  yourProjectsAria: "KaguOs — مشاريعكم",
  yourAccount: "حسابكم",
  signOut: "تسجيل الخروج",
  language: "اللغة",
  /* The wordmark stays Latin in both locales, exactly as the rail and the sign-in
     card render it. "كاغو" is right when the company is the SUBJECT of a sentence
     ("أرسل إلى كاغو"), and wrong here: this line is the mark itself, and a brand
     that spells itself two ways on one screen reads as two companies. */
  footerOwner: "Kagusoftware",
  footerWhat: "بوابة العملاء",

  /* ── the rail ──────────────────────────────────────────────────────────── */
  yourDashboard: "لوحة معلوماتكم",
  dashboardAria: "KaguOs — لوحة معلوماتكم",
  portalNav: "البوابة",
  menu: "القائمة",
  openMenu: "فتح القائمة",
  closeMenu: "إغلاق القائمة",
  accountAria: (who: string) => `الحساب — ${who}`,
  navDashboard: "لوحة المعلومات",
  navDashboardHint: "كل شيء في لمحة",
  navInputs: "المدخلات",
  navInputsHint: "ما نحتاجه منكم",
  navProgress: "سير العمل",
  navProgressHint: "أين وصل البناء",
  navFinance: "المالية",
  navFinanceHint: "الفواتير والمدفوعات",

  /* ── portal index ──────────────────────────────────────────────────────── */
  indexBlurb: "كل ما تبنيه كاغو لكم، وما نحتاجه منكم لبنائه.",
  yourInputs: "مدخلاتكم",
  inputsBlurb:
    "حزمة واحدة لكل شركة — كل ما تحتاجه كاغو منكم لبنائها. تُحفظ أثناء الكتابة.",
  nothingSharedTitle: "لم تتم مشاركة أي شيء معكم بعد",
  nothingSharedHint:
    "حسابكم جاهز. بمجرد أن تشارك كاغو مشروعًا معه سيظهر هنا — لا داعي للعودة والتحقق، سنخبركم.",
  filledIn: (pct: number) => `مكتمل ${pct}٪`,
  sentAgo: (rel: string) => `أُرسل ${rel}`,

  /* ── dashboard ─────────────────────────────────────────────────────────── */
  hello: (name: string) => `أهلاً بكم، ${name}`,
  dashNothingSharedHint:
    "حسابكم جاهز. بمجرد أن تشارك كاغو مشروعًا معه سيظهر هنا كل ما يخص ذلك البناء — سنخبركم، فلا داعي للعودة والتحقق.",
  packNotStarted: "لم تبدأوا حزمة مدخلاتكم بعد",
  packFilledIn: (pct: number) => `حزمة مدخلاتكم مكتملة بنسبة ${pct}٪`,
  finishIt: "أكملوها",
  invoicesOverdue: (n: number) =>
    arPlural(
      n,
      "فاتورة واحدة تجاوزت تاريخ استحقاقها",
      "فاتورتان تجاوزتا تاريخ استحقاقهما",
      `${n} فواتير تجاوزت تاريخ استحقاقها`,
      `${n} فاتورة تجاوزت تاريخ استحقاقها`
    ),
  seeFinance: "عرض المالية",
  nothingNeedsYou: "لا شيء ينتظركم الآن — كل شيء لدينا.",
  build: "البناء",
  buildProgressAria: (name: string) => `تقدّم بناء ${name}`,
  yourInputPack: "حزمة مدخلاتكم",
  outstanding: "المبلغ المستحق",
  nextUp: "التالي",
  targetOn: (date: string) => `الموعد المستهدف ${date}`,
  recently: "آخر التحديثات",

  /* ── progress page ─────────────────────────────────────────────────────── */
  progressDescription: "ما أنجزته كاغو، وما هو قيد العمل، وما ننتظره منكم.",
  noPlanTitle: "لم تتم مشاركة خطة بعد",
  noPlanHint:
    "ستنشر كاغو خطوات هذا البناء هنا. حتى ذلك الحين، حزمة المدخلات هي ما يمكنكم العمل عليه.",
  phasesDone: (done: number, total: number) => `${done}/${total} مكتملة`,
  nextIs: (title: string) => `التالي: ${title}`,
  planNotShared: "لم تتم مشاركة الخطة بعد",
  everythingDone: "كل ما في الخطة مكتمل",
  weightedNote: "المراحل لا تتساوى في الوزن — الكبيرة منها تحرّك هذا الشريط أكثر.",
  sentThankYou: "أُرسلت إلى كاغو — شكرًا لكم",
  carryOn: "أكملوا تعبئتها",
  blockedCount: (n: number) =>
    arPlural(
      n,
      "خطوة واحدة متوقفة",
      "خطوتان متوقفتان",
      `${n} خطوات متوقفة`,
      `${n} خطوة متوقفة`
    ),
  ofTheProject: (pct: string) => `${pct}٪ من المشروع`,
  countedSoFar: (pct: string) => `احتُسب منها ${pct}٪ حتى الآن`,
  phaseProgressAria: (name: string) => `${name} — مدى التقدّم في هذه المرحلة`,
  percent: (pct: number) => `${pct}٪`,
  statusPlanned: "مُخطَّط له",
  statusInProgress: "قيد التنفيذ",
  statusDone: "مكتمل",
  statusBlocked: "متوقف",
  late: "متأخر",
  doneOn: (date: string) => `اكتملت ${date}`,

  /* ── progress: the four systems ─────────────────────────────────────────── */
  systemsAria: "الأنظمة قيد البناء، عمود لكل نظام",
  systemProgressAria: (name: string) => `${name} — مدى التقدّم`,
  shareOfBuild: (pct: string) => `${pct}٪ من البناء`,
  shareOfSystem: (pct: string) => `${pct}٪ من هذا النظام`,
  stepsDone: (done: number, total: number) => `${done}/${total} خطوات مكتملة`,
  partOf: (system: string) => `ضمن ${system}`,
  systemProgress: "مدى التقدّم في هذا النظام",
  stepProgress: "مدى التقدّم في هذه الخطوة",
  stepProgressAria: (name: string) => `${name} — مدى التقدّم في هذه الخطوة`,
  whatThisIs: "شرح مختصر",
  notStartedYet: "لم تبدأ بعد",
  closeStep: "إغلاق هذه الخطوة",
  closeSystem: "إغلاق هذا النظام",
  /* No leading capital and no "and" before the last item — Arabic joins the
     list with و prefixed to the word itself. */
  headline: (packs: number, overdue: number, blocked: number) => {
    const parts: string[] = [];
    if (packs > 0) {
      parts.push(
        arPlural(
          packs,
          "حزمة مدخلات واحدة ما زالت تحتاج إكمالًا",
          "حزمتا مدخلات ما زالتا تحتاجان إكمالًا",
          `${packs} حزم مدخلات ما زالت تحتاج إكمالًا`,
          `${packs} حزمة مدخلات ما زالت تحتاج إكمالًا`
        )
      );
    }
    if (overdue > 0) {
      parts.push(
        arPlural(
          overdue,
          "فاتورة واحدة تجاوزت موعد استحقاقها",
          "فاتورتان تجاوزتا موعد استحقاقهما",
          `${overdue} فواتير تجاوزت موعد استحقاقها`,
          `${overdue} فاتورة تجاوزت موعد استحقاقها`
        )
      );
    }
    if (blocked > 0) {
      parts.push(
        arPlural(
          blocked,
          "خطوة واحدة متوقفة",
          "خطوتان متوقفتان",
          `${blocked} خطوات متوقفة`,
          `${blocked} خطوة متوقفة`
        )
      );
    }
    if (parts.length === 0) {
      return "كل شيء لدينا — لا شيء ينتظركم.";
    }
    const sentence =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join("، ")} و${parts[parts.length - 1]}`;
    return `${sentence}.`;
  },

  /* ── the pack ──────────────────────────────────────────────────────────── */
  packBlurb:
    "كل ما تحتاجه كاغو منكم لبناء هذا، في مكان واحد. يُحفظ أثناء الكتابة — يمكنكم المغادرة والعودة.",
  answered: (pct: number) => `مُجاب ${pct}٪`,
  saving: "جارٍ الحفظ…",
  saved: "تم الحفظ",
  savesAsYouGo: "يُحفظ تلقائيًا",
  sections: "الأقسام",
  sectionsNav: "أقسام الحزمة",
  back: "السابق",
  next: "التالي",
  stepOf: (i: number, n: number) => `الخطوة ${i} من ${n}`,
  goToReview: "المراجعة والإرسال",
  required: "مطلوب",
  optionalIfApplies: "إن كان ينطبق فقط",
  nothingYet: "لا شيء بعد.",
  remove: "حذف",
  removeSure: "متأكد؟",
  removeLineAria: (n: number, card: string) => `السطر ${n} من ${card}`,
  lineCount: (n: number) =>
    arPlural(n, "سطر واحد", "سطران", `${n} أسطر`, `${n} سطرًا`),
  linesIncomplete: (n: number) =>
    arPlural(
      n,
      "سطر واحد ينقصه شيء",
      "سطران ينقصهما شيء",
      `${n} أسطر ينقصها شيء`,
      `${n} سطرًا ينقصه شيء`
    ),
  stillToAnswer: (n: number) => `بقي ${n} دون إجابة`,
  weekLeft: (n: number) => `بقي ${n}`,
  weekLeftRest: "من الإجابات التي تفتح البناء",
  weekAllDone: "كل ما يحتاجه البناء للانطلاق مُجاب",
  sectionDone: "مكتمل",
  weekShort: (n: number) => `الأسبوع ${n}`,
  packProgressAria: (name: string) => `اكتمال حزمة مدخلات ${name}`,

  /* ── finance ───────────────────────────────────────────────────────────── */
  financeBlurb:
    "الفواتير الصادرة لكم، وما هو مجدول بعدها، وأين يقف كلٌّ منها. المسودات لا تُعرض — تظهر الفاتورة هنا بمجرد إرسالها.",
  financeNothingSharedHint:
    "بمجرد أن تشارك كاغو مشروعًا مع حسابكم، ستظهر فواتيره هنا.",
  pastDueCount: (n: number) =>
    arPlural(
      n,
      "فاتورة واحدة متأخرة",
      "فاتورتان متأخرتان",
      `${n} فواتير متأخرة`,
      `${n} فاتورة متأخرة`
    ),
  nothingOverdue: "لا شيء متأخر",
  nothingOwedNow: "لا مستحقات عليكم الآن",
  overdueLabel: "المبلغ المتأخر",
  settleWhenYouCan: "يرجى تسويته حين يتيسّر لكم",
  paidToDate: "المدفوع حتى الآن",
  nextScheduledPayment: "الدفعة المجدولة التالية",
  noInvoicesTitle: "لا توجد فواتير بعد",
  noInvoicesHint:
    "لم تصدر فواتير على مشاريعكم، ولم يُتفق على خطة سداد. وحين يحدث أيٌّ منهما، سيظهر هنا بتواريخه.",
  outstandingInline: "المستحق",
  nothingInvoicedWithPlan:
    "لم تصدر فواتير بعد — الدفعات أعلاه هي الجدول، وتصدر لكل دفعة فاتورة عند حلول موعدها.",
  nothingInvoicedYet: "لم تصدر فواتير لهذه الشركة بعد.",
  financeDisputeNote:
    "هل يبدو شيء هنا خاطئًا؟ أخبروا من تتواصلون معه عادةً في كاغو — هذه الصفحة نسخة من سجلاتنا وليست مكانًا للاعتراض عليها، ونحن نفضّل تصحيح الخطأ من مصدره.",
  swipeTableHint: "مرّروا الجدول جانبًا لرؤية المبلغ والحالة.",
  invoiceColInvoice: "الفاتورة",
  invoiceColIssued: "تاريخ الإصدار",
  invoiceColDue: "تاريخ الاستحقاق",
  invoiceColAmount: "المبلغ",
  invoiceColStatus: "الحالة",
  invoicePaidOn: (date: string) => `دُفعت ${date}`,
  /* No slash: Arabic quotes a rate as an adverb after the figure — "1,200$
     شهريًا" — where English writes it as a fraction. */
  planRecurringHeadline: (amount: string, per: string) => `${amount} ${per}`,
  planInstalmentsHeadline: (n: number, amount: string) =>
    arPlural(
      n,
      `دفعة واحدة بمبلغ ${amount}`,
      `دفعتان بمبلغ ${amount}`,
      `${n} دفعات بمبلغ ${amount}`,
      `${n} دفعة بمبلغ ${amount}`
    ),
  planPaymentCount: (n: number) =>
    arPlural(n, "دفعة واحدة", "دفعتان", `${n} دفعات`, `${n} دفعة`),
  planRange: (kind: string, from: string, to: string | null) =>
    `${kind} من ${from}${to ? ` إلى ${to}` : " — مستمرة"}`,
  planPaymentsAria: (title: string) => `${title} — الدفعات المسدَّدة`,
  paymentsMade: (done: number, total: number) => `سُدِّدت ${done} من ${total}`,
  paidAndToCome: (paid: string, remaining: string) =>
    `المدفوع ${paid} · المتبقي ${remaining}`,
  pastItsDateCount: (n: number) =>
    arPlural(
      n,
      "دفعة واحدة تجاوزت موعدها",
      "دفعتان تجاوزتا موعدهما",
      `${n} دفعات تجاوزت مواعيدها`,
      `${n} دفعة تجاوزت موعدها`
    ),
  installmentPaidOn: (date: string) => `دُفعت ${date}`,
  installmentNext: "التالية",

  /* ── finance: status vocabulary ────────────────────────────────────────── */
  /* Feminine throughout, because فاتورة and دفعة are feminine. The milestone
     states above stay masculine — their referent is a build, a phase, a step.
     Two internally consistent sets, deliberately not harmonised into one. */
  invoiceStatusDraft: "مسودة",
  invoiceStatusSent: "مُرسلة",
  invoiceStatusPaid: "مدفوعة",
  invoiceStatusVoid: "ملغاة",
  invoiceStatusOverdue: "متأخرة السداد",
  installmentStatusScheduled: "مجدولة",
  installmentStatusInvoiced: "صدرت فاتورتها",
  installmentStatusPaid: "مدفوعة",
  installmentStatusWaived: "مُعفاة",
  installmentStatusLate: "تجاوزت موعدها",
  planKindInstalments: "أقساط",
  planKindRecurring: "متكررة",
  planKindCustom: "مواعيد مخصّصة",
  cadencePerWeek: "أسبوعيًا",
  cadencePerMonth: "شهريًا",
  cadencePerQuarter: "كل ثلاثة أشهر",
  cadencePerYear: "سنويًا",

  /* ── review and send ───────────────────────────────────────────────────── */
  reviewTitle: "المراجعة والإرسال",
  reviewBlurb:
    "كل ما فوق محفوظ ومرئي لنا بالفعل — الإرسال يعني أنه جاهز للعمل عليه. يمكنكم إرسال حزمة غير مكتملة: إجابات الأسبوع الأول هي التي تفتح البناء، والباقي يلحق.",
  sendButton: "أرسل إلى كاغو",
  sendAllDone: "هذا كل شيء. أرسلوه.",
  sendSomeOpen: (n: number) =>
    `بقي ${n} دون إجابة — أرسلوه على أي حال إن كان الباقي يحتاج شخصًا غير متاح الآن.`,
  sentLine: (rel: string) => `أُرسل ${rel}.`,
  sentAfter:
    "وصلت إلى كاغو. لاحظتم خطأً؟ عدّلوه فوق — يُحفظ مباشرة ونراه.",
  reopenButton: "لا يزال العمل جاريًا عليه",

  /* ── toasts ────────────────────────────────────────────────────────────── */
  toastSent: "أُرسل إلى كاغو.",
  toastReopened: "أُعيد فتحه — أصبح لكم من جديد.",
  toastAddFailed: "تعذّرت إضافة هذا السطر.",
  toastGeneric: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",

  /* ── account ───────────────────────────────────────────────────────────── */
  accountBack: "رجوع",
  accountName: "اسمكم",
  accountFullName: "الاسم الكامل",
  accountSaveName: "حفظ الاسم",
  accountPassword: "كلمة المرور",
  accountNewPassword: "كلمة المرور الجديدة",
  accountRepeatPassword: "أعيدوا كتابة كلمة المرور",
  accountChangePassword: "تغيير كلمة المرور",
  textSize: "حجم النص",
  textSizeSmall: "صغير",
  textSizeDefault: "افتراضي",
  textSizeLarge: "كبير",
  textSizeLargest: "الأكبر",
  textSizeNote:
    /* "KaguOs", not "كاغو": the English names the PRODUCT here, and the product
       is the thing the wordmark spells. Elsewhere in this file "كاغو" is right,
       because there the company is the actor in a sentence ("أرسل إلى كاغو"). */
    "ينطبق على كل شيء في KaguOs، وعلى هذا المتصفح وحده — لكل جهاز تسجّلون الدخول منه إعداده الخاص. وإن أردتم أكبر من هذا، فتكبير المتصفح يوسّع التخطيط أيضًا.",

  /* ── date picker ───────────────────────────────────────────────────────── */
  datePlaceholder: "اختاروا تاريخًا…",
  dateClearAria: "مسح التاريخ",
  dateCalendarAria: "التقويم",
  datePrevMonth: "الشهر السابق",
  dateNextMonth: "الشهر التالي",
  dateToday: "اليوم",
  dateClear: "مسح",

  /* ── shared UI ─────────────────────────────────────────────────────────── */
  toastDismiss: "إغلاق الإشعار",
  yourBusinesses: "شركاتكم",
  justNow: "الآن",

  /* ── the error screen ──────────────────────────────────────────────────── */
  errorTitle: "تعذّر تحميل هذه الصفحة",
  errorBlurb:
    "حدث خلل لدينا أثناء جلب بياناتكم — ولم يضع أي شيء أرسلتموه. حاولوا مرة أخرى، وإن تكرر الأمر فأرسلوا الرمز أدناه إلى كاغو.",
  errorRetry: "حاولوا مرة أخرى",
  errorReference: "الرمز المرجعي",

  /* ── action results ────────────────────────────────────────────────────── */
  actionMissingProject: "لم يُحدَّد المشروع.",
  actionUnknownQuestion: "هذا السؤال ليس ضمن الحزمة.",
  actionUnknownTable: "هذا الجدول ليس ضمن الحزمة.",
  actionTooManyLines: (max: number) =>
    `بلغتم ${max} سطر — أرسلوا إلينا الباقي في ملف جدول بيانات.`,
  actionNotYourAccount: "هذا ليس مما يستطيع حسابكم القيام به.",
  actionProjectNotShared: "هذا المشروع غير مُشارَك مع حسابكم.",
  actionSaved: "تم الحفظ.",
  actionLineAdded: "أُضيف السطر.",
  actionLineRemoved: "حُذف السطر.",
  actionSaveFailed: "تعذّر حفظ ذلك — يرجى المحاولة مرة أخرى.",
  actionSentDetail: "أُرسل إلى كاغو — سنعود إليكم بشأن أي شيء غير واضح.",
  accountNameLength: "يجب أن يتراوح الاسم بين حرف واحد و80 حرفًا.",
  accountNotSignedIn: "لم تسجّلوا الدخول.",
  accountNameSaved: "تم تحديث الاسم.",
  accountPasswordShort: "يجب ألّا تقلّ كلمة المرور عن 8 أحرف.",
  accountPasswordMismatch: "كلمتا المرور غير متطابقتين.",
  accountPasswordSaved: "تم تغيير كلمة المرور.",

  /* ── sign in ───────────────────────────────────────────────────────────── */
  signIn: "تسجيل الدخول",
  loginBlurb: "نظام كاغو الداخلي. سجّلوا الدخول بحساب فريقكم.",
  loginNoAccount:
    "لا حساب لديكم؟ الحسابات يُنشئها المسؤول — راسلوا بارسا أو ماجد.",
  loginEmail: "البريد الإلكتروني",
  /* Deliberately untranslated: it is an example address, and an Arabic one
     would not tell the reader what shape to type. */
  loginEmailPlaceholder: "you@kagusoftware.com",
  loginPassword: "كلمة المرور",
  loginWrongCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  appDescription: "نظام كاغو الداخلي",
};

const DICTS: Record<Locale, Dict> = { en, ar };

/**
 * The portal's strings for one locale.
 *
 * Named `tt` rather than `t` because it returns the whole dictionary rather
 * than one lookup — call sites read `t.sendButton`, not `t("sendButton")`,
 * which is what makes the compiler catch a typo'd key.
 */
export function dict(locale: Locale): Dict {
  return DICTS[locale];
}

/**
 * A milestone's state, in the reader's language.
 *
 * `MILESTONE_STATUS_LABELS` in lib/types.ts is the team's English vocabulary
 * and stays that way — it is what the board, the editor and every `(app)` page
 * use. The portal is the one surface that also speaks Arabic, so it maps the
 * same four states onto its own dictionary here rather than each page writing
 * the switch again (there were two, and they disagreed).
 */
export function milestoneStatusLabel(t: Dict, status: MilestoneStatus): string {
  switch (status) {
    case "done":
      return t.statusDone;
    case "in_progress":
      return t.statusInProgress;
    case "blocked":
      return t.statusBlocked;
    default:
      return t.statusPlanned;
  }
}

/**
 * An invoice's state, in the reader's language.
 *
 * Same arrangement as the milestones above: `INVOICE_STATUS_LABELS` in
 * lib/types.ts is the team's English vocabulary and stays that way, and the
 * portal maps the same union onto its own dictionary here so no page writes
 * the switch twice.
 *
 * `overdue` is not a database status — it is a `sent` invoice whose due date
 * has passed, which only the renderer knows because it depends on today. The
 * caller works it out and passes it; every other state ignores the flag.
 */
export function invoiceStatusLabel(
  t: Dict,
  status: InvoiceStatus,
  overdue = false
): string {
  if (overdue && status === "sent") return t.invoiceStatusOverdue;
  switch (status) {
    case "draft":
      return t.invoiceStatusDraft;
    case "paid":
      return t.invoiceStatusPaid;
    case "void":
      return t.invoiceStatusVoid;
    default:
      return t.invoiceStatusSent;
  }
}

/**
 * A scheduled payment's state, in the reader's language.
 *
 * `INSTALLMENT_STATUS_LABELS` in lib/types.ts stays the team's English; this
 * maps the same four states onto the portal's dictionary so no page repeats
 * the switch. The fifth pill a client can see — "Past its date" — is not one
 * of these states but a `scheduled` row whose date has passed, so the caller
 * reaches for `t.installmentStatusLate` directly rather than through here.
 */
export function installmentStatusLabel(
  t: Dict,
  status: InstallmentStatus
): string {
  switch (status) {
    case "invoiced":
      return t.installmentStatusInvoiced;
    case "paid":
      return t.installmentStatusPaid;
    case "waived":
      return t.installmentStatusWaived;
    default:
      return t.installmentStatusScheduled;
  }
}

/**
 * The unit a recurring plan is quoted in, in the reader's language.
 *
 * `PAYMENT_CADENCE_PER` in lib/types.ts is the team's English ("month", for
 * "$1,200 / month") and stays that way; this maps the same union onto the
 * portal's dictionary. Arabic says the rate as an adverb rather than a
 * fraction, which is why `planRecurringHeadline` drops the slash on that side.
 */
export function cadencePerLabel(t: Dict, cadence: PaymentCadence): string {
  switch (cadence) {
    case "weekly":
      return t.cadencePerWeek;
    case "quarterly":
      return t.cadencePerQuarter;
    case "yearly":
      return t.cadencePerYear;
    default:
      return t.cadencePerMonth;
  }
}

/**
 * What kind of payment plan this is, in the reader's language.
 *
 * `PAYMENT_PLAN_KIND_LABELS` in lib/types.ts is the team's English and stays
 * that way, but it is the admin's fuller wording ("Fixed instalments",
 * "Recurring / retainer"). The portal already said the short form in its own
 * hand-written ternary; this keeps those exact words and adds the `custom`
 * branch that ternary never had.
 */
export function planKindLabel(t: Dict, kind: PaymentPlanKind): string {
  switch (kind) {
    case "recurring":
      return t.planKindRecurring;
    case "custom":
      return t.planKindCustom;
    default:
      return t.planKindInstalments;
  }
}

export type PortalDict = Dict;
