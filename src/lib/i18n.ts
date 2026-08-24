/**
 * The client portal's chrome, in both languages.
 *
 * ── What belongs here and what doesn't ──────────────────────────────────────
 *
 * Here: every word the PORTAL says in its own voice — the header, the nav, the
 * buttons, the progress line, the send panel, the account page. These are
 * written once and shown to every client.
 *
 * NOT here: the questions. Those live in `lib/intake.ts` as pack data, already
 * carrying their own `labelAr` / `hintAr` / `titleAr` beside each English
 * string, and they differ per pack. `pick()` from `lib/locale.ts` chooses
 * between those two halves at render time. Copying them into a dictionary would
 * mean two places to edit a reworded question and one of them silently winning.
 *
 * ── Why a plain object and not a library ────────────────────────────────────
 *
 * Two locales, one namespace, no pluralisation rules beyond a count in a
 * sentence, and no translator workflow. `next-intl` would add a provider, a
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
  nothingSharedTitle: "Nothing shared with you yet",
  nothingSharedHint:
    "Your account is set up. As soon as Kagu shares a project with it, it appears here — no need to check back, you'll be told.",
  filledIn: (pct: number) => `${pct}% filled in`,
  sentAgo: (rel: string) => `sent ${rel}`,

  /* ── dashboard ─────────────────────────────────────────────────────────── */
  hello: (first: string) => `Hello, ${first}`,
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
  weekLeft: (n: number) => `${n} left`,
  weekLeftRest: "in the answers that unlock the build",
  weekAllDone: "Everything the build needs to start is answered",
  sectionDone: "Done",
  weekShort: (n: number) => `Week ${n}`,
  packProgressAria: (name: string) => `${name} input pack completion`,

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
  accountPassword: "Password",
  textSize: "Text size",
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

const ar: Dict = {
  /* ── shell ─────────────────────────────────────────────────────────────── */
  skipToContent: "تخطَّ إلى المحتوى",
  yourProjects: "مشاريعكم",
  yourProjectsAria: "كاغو — مشاريعكم",
  yourAccount: "حسابكم",
  signOut: "تسجيل الخروج",
  language: "اللغة",
  footerOwner: "كاغو سوفتوير",
  footerWhat: "بوابة العملاء",

  /* ── the rail ──────────────────────────────────────────────────────────── */
  yourDashboard: "لوحة معلوماتكم",
  dashboardAria: "كاغو — لوحة معلوماتكم",
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
  nothingSharedTitle: "لم تتم مشاركة أي شيء معكم بعد",
  nothingSharedHint:
    "حسابكم جاهز. بمجرد أن تشارك كاغو مشروعًا معه سيظهر هنا — لا داعي للعودة والتحقق، سنخبركم.",
  filledIn: (pct: number) => `مكتمل ${pct}٪`,
  sentAgo: (rel: string) => `أُرسل ${rel}`,

  /* ── dashboard ─────────────────────────────────────────────────────────── */
  hello: (first: string) => `أهلاً ${first}`,
  dashNothingSharedHint:
    "حسابكم جاهز. بمجرد أن تشارك كاغو مشروعًا معه سيظهر هنا كل ما يخص ذلك البناء — سنخبركم، فلا داعي للعودة والتحقق.",
  packNotStarted: "لم تبدأوا حزمة مدخلاتكم بعد",
  packFilledIn: (pct: number) => `حزمة مدخلاتكم مكتملة بنسبة ${pct}٪`,
  finishIt: "أكملوها",
  invoicesOverdue: (n: number) =>
    n === 1
      ? "فاتورة واحدة تجاوزت تاريخ استحقاقها"
      : `${n} فواتير تجاوزت تاريخ استحقاقها`,
  seeFinance: "عرض المالية",
  nothingNeedsYou: "لا شيء ينتظركم الآن — كل شيء لدينا.",
  build: "البناء",
  buildProgressAria: (name: string) => `تقدّم بناء ${name}`,
  yourInputPack: "حزمة مدخلاتكم",
  outstanding: "المستحق",
  nextUp: "التالي",
  targetOn: (date: string) => `الموعد ${date}`,
  recently: "آخر التحديثات",
  /* No leading capital and no "and" before the last item — Arabic joins the
     list with و prefixed to the word itself. */
  headline: (packs: number, overdue: number, blocked: number) => {
    const parts: string[] = [];
    if (packs > 0) {
      parts.push(
        packs === 1
          ? "حزمة مدخلات واحدة ما زالت تحتاج إكمالًا"
          : `${packs} حزم مدخلات ما زالت تحتاج إكمالًا`
      );
    }
    if (overdue > 0) {
      parts.push(
        overdue === 1
          ? "فاتورة واحدة تجاوزت موعد استحقاقها"
          : `${overdue} فواتير تجاوزت موعد استحقاقها`
      );
    }
    if (blocked > 0) {
      parts.push(
        blocked === 1 ? "خطوة واحدة متوقفة" : `${blocked} خطوات متوقفة`
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
  weekLeft: (n: number) => `بقي ${n}`,
  weekLeftRest: "من الإجابات التي تفتح البناء",
  weekAllDone: "كل ما يحتاجه البناء للانطلاق مُجاب",
  sectionDone: "مكتمل",
  weekShort: (n: number) => `الأسبوع ${n}`,
  packProgressAria: (name: string) => `اكتمال حزمة مدخلات ${name}`,

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
  accountPassword: "كلمة المرور",
  textSize: "حجم النص",
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

export type PortalDict = Dict;
