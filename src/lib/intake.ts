/**
 * Client input packs — the questions Kagu has to ask a business before it can
 * build anything for them, and the rules that decide when the answers are
 * enough to start.
 *
 * ── Why the catalogue lives in TypeScript ───────────────────────────────────
 *
 * The database (0072) owns the ANSWERS. It does not own the questions, and it
 * shouldn't: the catalogue changes every time Kagu learns a better way to ask
 * something, both sides of the app (the client's form and the team's read-only
 * review) have to agree on the same completion arithmetic, and a schema
 * migration per reworded hint would be absurd. So the packs are data here, and
 * the storage is two generic shapes — scalar answers keyed by
 * `pack.card.field`, and repeating rows keyed by `pack.card`.
 *
 * ── Why there is more than one pack ─────────────────────────────────────────
 *
 * `general` is the neutral pack: it asks the questions every build needs, in
 * the general form ("anything booked by time" rather than courts). It is the
 * default and the right answer for most projects.
 *
 * A REAL client, though, gets asked in their own vocabulary. Touch Padel are
 * not buying "bookable resources", they have courts; they don't sell "products
 * and services", they have a menu and a kitchen with recipes in it. `touch-padel`
 * is that pack, and it is a faithful port of the input form written for them —
 * same questions, same order, same bilingual labels, same conditional reveals.
 * The generic one would have got vaguer answers, and vague answers are what
 * this whole exercise exists to stop.
 *
 * `projects.intake_pack` (0073) says which one a project uses. Adding a third
 * is adding an entry to INTAKE_PACKS.
 *
 * ── English and Arabic ──────────────────────────────────────────────────────
 *
 * Every label, hint and option carries an optional `*Ar`. This is not
 * localisation — the app's chrome stays English — it is the pack speaking the
 * client's language while the team still reads it. The person filling this in
 * runs a business in Baghdad; the person reading the answers sits in Istanbul.
 * Both have to understand the same page at the same time, which is why the
 * Arabic sits WITH the English rather than behind a language switch.
 *
 * `rtl` on a field marks a field whose CONTENT is Arabic (the Arabic half of a
 * bilingual menu item), so the input renders right-to-left.
 *
 * ── Adding a question ───────────────────────────────────────────────────────
 *
 * Add the field to its card. The form renders it, the meter counts it (if
 * `required`), the review shows it. NEVER change an existing `key`: it is the
 * storage key, and renaming one orphans every answer already given under it.
 */

/**
 * Which week of the build an answer unblocks. This is the pack's whole priority
 * system, and it's honest rather than decorative: week-1 answers are the ones
 * with nothing to build without, so a client who fills only those has already
 * done the part that matters.
 */
export type IntakeDue = "week1" | "week2" | "week3";

export const DUE_LABELS: Record<IntakeDue, string> = {
  week1: "Week 1 — unlocks the build",
  week2: "Week 2",
  week3: "Week 3",
};

export const DUE_LABELS_AR: Record<IntakeDue, string> = {
  week1: "الأسبوع ١ — يفتح البناء",
  week2: "الأسبوع ٢",
  week3: "الأسبوع ٣",
};

export const DUE_SHORT: Record<IntakeDue, string> = {
  week1: "Week 1",
  week2: "Week 2",
  week3: "Week 3",
};

export const DUE_ORDER: IntakeDue[] = ["week1", "week2", "week3"];

export type IntakeChoice = { value: string; label: string; labelAr?: string };

export type IntakeFieldKind =
  | "text"
  | "long"
  | "date"
  | "number"
  | "choice"
  /** Many-of-N as chips. Stored as the picked values joined with a comma. */
  | "multi";

export type IntakeField = {
  key: string;
  label: string;
  labelAr?: string;
  kind: IntakeFieldKind;
  placeholder?: string;
  hint?: string;
  hintAr?: string;
  /** Counts toward the completion meter. Everything else is genuinely optional. */
  required?: boolean;
  /** Columns out of 12 on desktop; the whole row on mobile. */
  span?: number;
  /** The value typed here is Arabic — render the input right-to-left. */
  rtl?: boolean;
  /** `choice` and `multi` only. */
  options?: IntakeChoice[];
  /**
   * Show this field only while another field IN THE SAME CARD holds one of
   * these values. A hidden field is never required — see `visibleFields`.
   */
  showWhen?: { key: string; values: string[] };
};

export type IntakeColumn = {
  key: string;
  label: string;
  labelAr?: string;
  kind: "text" | "long" | "number" | "choice" | "multi";
  placeholder?: string;
  /** A row counts as complete only once every required column is filled. */
  required?: boolean;
  span?: number;
  rtl?: boolean;
  options?: IntakeChoice[];
};

type CardBase = {
  key: string;
  title: string;
  titleAr?: string;
  hint?: string;
  hintAr?: string;
  due: IntakeDue;
  /**
   * A pick that isn't wrong but that the team has to know about — "waiting on
   * the accountant", "needs help choosing". Shown next to the check as a note
   * rather than failing it: the question IS answered, the answer just carries
   * a follow-up.
   */
  flag?: { key: string; values: string[]; note: string };
};

export type IntakeCard = CardBase &
  (
    | { kind: "fields"; fields: IntakeField[] }
    | {
        kind: "table";
        addLabel: string;
        addLabelAr?: string;
        columns: IntakeColumn[];
        /** 0 = the table is optional and never moves the meter. */
        minRows?: number;
        /** Shown in place of the rows when there are none yet. */
        emptyHint?: string;
        emptyHintAr?: string;
      }
    /**
     * Prose with nothing to fill in — the "read this before you start" panel
     * the recipes section opens with. Never appears in the checklist, because a
     * warning you cannot answer is not an outstanding item.
     */
    | { kind: "note"; tone?: "warning" }
  );

export type IntakeSection = {
  key: string;
  num: string;
  title: string;
  titleAr?: string;
  blurb?: string;
  blurbAr?: string;
  due: IntakeDue;
  cards: IntakeCard[];
};

export type IntakePackDef = {
  key: string;
  /** Shown in the admin picker and at the top of the pack. */
  name: string;
  /** One line describing who this pack is for. */
  summary: string;
  sections: IntakeSection[];
};

/* ── Shared vocabulary, so two packs can't drift on the same idea ─────────── */

const UNIT_OPTIONS: IntakeChoice[] = [
  { value: "g", label: "g", labelAr: "غرام" },
  { value: "ml", label: "ml", labelAr: "مل" },
  { value: "pc", label: "pc", labelAr: "قطعة" },
];

const DAYS: { key: string; en: string; ar: string }[] = [
  { key: "sat", en: "Saturday", ar: "السبت" },
  { key: "sun", en: "Sunday", ar: "الأحد" },
  { key: "mon", en: "Monday", ar: "الاثنين" },
  { key: "tue", en: "Tuesday", ar: "الثلاثاء" },
  { key: "wed", en: "Wednesday", ar: "الأربعاء" },
  { key: "thu", en: "Thursday", ar: "الخميس" },
  { key: "fri", en: "Friday", ar: "الجمعة" },
];

const ALLERGENS: IntakeChoice[] = [
  { value: "gluten", label: "gluten", labelAr: "غلوتين" },
  { value: "dairy", label: "dairy", labelAr: "ألبان" },
  { value: "eggs", label: "eggs", labelAr: "بيض" },
  { value: "nuts", label: "nuts", labelAr: "مكسرات" },
  { value: "peanuts", label: "peanuts", labelAr: "فول سوداني" },
  { value: "sesame", label: "sesame", labelAr: "سمسم" },
  { value: "soy", label: "soy", labelAr: "صويا" },
  { value: "fish", label: "fish", labelAr: "سمك" },
  { value: "shellfish", label: "shellfish", labelAr: "محار" },
];

/**
 * The seven-day opening-hours grid, as fields rather than a table.
 *
 * The form it comes from is a fixed grid: seven named days, each with a Closed
 * tick and two times that grey out when it's ticked. A free-form table would
 * let someone answer for six days and never notice — which is the exact failure
 * the fixed grid exists to prevent. `showWhen` reproduces the greying-out, and
 * because a hidden field is never counted, a closed day costs nothing on the
 * meter.
 */
function hoursFields(): IntakeField[] {
  return DAYS.flatMap((day) => [
    {
      key: day.key,
      label: day.en,
      labelAr: day.ar,
      kind: "choice" as const,
      required: true,
      span: 4,
      options: [
        { value: "open", label: "Open", labelAr: "مفتوح" },
        { value: "closed", label: "Closed", labelAr: "مغلق" },
      ],
    },
    {
      key: `${day.key}Open`,
      label: "Opens",
      labelAr: "يفتح",
      kind: "text" as const,
      required: true,
      span: 4,
      placeholder: "09:00",
      showWhen: { key: day.key, values: ["open"] },
    },
    {
      key: `${day.key}Close`,
      label: "Closes",
      labelAr: "يغلق",
      kind: "text" as const,
      required: true,
      span: 4,
      placeholder: "24:00",
      showWhen: { key: day.key, values: ["open"] },
    },
  ]);
}

/* ── Pack: general ────────────────────────────────────────────────────────── */

const GENERAL_SECTIONS: IntakeSection[] = [
  {
    key: "decisions",
    num: "01",
    title: "Decisions",
    due: "week1",
    blurb:
      "The handful of answers the build cannot start without. Most are one tap; none of them are permanent — tell us if something changes.",
    cards: [
      {
        key: "filler",
        title: "Who is filling this in?",
        hint: "So we know who to come back to when an answer needs a second look.",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "name", label: "Full name", kind: "text", required: true, span: 4, placeholder: "Your name" },
          { key: "role", label: "Role at the business", kind: "text", span: 4, placeholder: "Owner / Manager" },
          { key: "contact", label: "Phone or email", kind: "text", required: true, span: 4, placeholder: "The number you actually answer" },
        ],
      },
      {
        key: "currency",
        title: "Currency",
        hint: "The system trades in one currency, in whole units. Handling two currencies side by side is a separate piece of work — tell us now if you need it.",
        due: "week1",
        kind: "fields",
        flag: { key: "mode", values: ["discuss"], note: "flagged to discuss on the next call" },
        fields: [
          {
            key: "mode",
            label: "How many currencies",
            kind: "choice",
            required: true,
            options: [
              { value: "single", label: "One currency — confirmed" },
              { value: "discuss", label: "We need to talk about this" },
            ],
          },
          {
            key: "code",
            label: "Which currency",
            kind: "text",
            required: true,
            span: 4,
            placeholder: "IQD · TRY · USD",
            showWhen: { key: "mode", values: ["single"] },
          },
        ],
      },
      {
        key: "tax",
        title: "Tax",
        hint: "The default is 0% on everything until your accountant says otherwise. If any group of items carries tax we need the rate per group, in writing, from them.",
        due: "week1",
        kind: "fields",
        flag: { key: "mode", values: ["pending"], note: "waiting on the accountant" },
        fields: [
          {
            key: "mode",
            label: "Tax position",
            kind: "choice",
            required: true,
            options: [
              { value: "zero", label: "0% across the board" },
              { value: "rates", label: "Some groups carry tax" },
              { value: "pending", label: "Waiting on our accountant" },
            ],
          },
          {
            key: "rates",
            label: "Rate per group of items",
            kind: "long",
            required: true,
            span: 12,
            placeholder: "e.g. Food 0% · Drinks 5%",
            showWhen: { key: "mode", values: ["rates"] },
          },
        ],
      },
      {
        key: "languages",
        title: "Languages",
        hint: "Every piece of text gets written once per language. Adding one later is cheap; adding one after the content is written is not.",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "primary", label: "Languages the build must ship in", kind: "text", required: true, span: 6, placeholder: "English + Arabic" },
          { key: "default", label: "Which one opens by default", kind: "text", span: 6, placeholder: "Arabic" },
        ],
      },
      {
        key: "domain",
        title: "Domain name",
        hint: "Registered in your business's name, with DNS access shared with Kagu. Without it the site cannot go live on your own address.",
        due: "week1",
        kind: "fields",
        flag: { key: "status", values: ["help"], note: "asked Kagu to handle the registration" },
        fields: [
          { key: "name", label: "The exact domain", kind: "text", required: true, span: 6, placeholder: "yourbusiness.com" },
          {
            key: "status",
            label: "Where it stands",
            kind: "choice",
            required: true,
            options: [
              { value: "registered", label: "Already registered" },
              { value: "registering", label: "Registering this week" },
              { value: "help", label: "We need Kagu's help" },
            ],
          },
        ],
      },
      {
        key: "recovery",
        title: "Backups and recovery",
        hint: "Point-in-time recovery restores your data to any minute in the last seven days and is a paid add-on on your own hosting bill. Daily backups are included and restore to the previous day at worst.",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "mode",
            label: "Which one",
            kind: "choice",
            required: true,
            options: [
              { value: "pitr", label: "Point-in-time recovery (paid add-on)" },
              { value: "daily", label: "Daily backups only (included)" },
            ],
          },
        ],
      },
      {
        key: "approver",
        title: "Who signs things off",
        hint: "One named person, available once a week, who can say yes. Without them nothing gets accepted and the schedule slips while everyone waits to be told it's fine.",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "name", label: "Name", kind: "text", required: true, span: 4 },
          { key: "contact", label: "Phone or email", kind: "text", required: true, span: 4 },
          { key: "slot", label: "A weekly slot that suits them", kind: "text", span: 4, placeholder: "Fridays, early evening" },
        ],
      },
    ],
  },
  {
    key: "operations",
    num: "02",
    title: "Hours and policies",
    due: "week1",
    blurb: "When you're open, and what happens when a customer changes their mind.",
    cards: [
      {
        key: "hours",
        title: "Opening hours",
        hint: "Group the days that share hours — one line for Mon–Thu is better than four identical ones. 24-hour clock; 24:00 for a midnight close.",
        due: "week1",
        kind: "table",
        addLabel: "Add a line",
        minRows: 1,
        emptyHint: "Nothing yet — add your first line below.",
        columns: [
          { key: "days", label: "Days", kind: "text", required: true, span: 4, placeholder: "Mon–Thu" },
          { key: "opens", label: "Opens", kind: "text", required: true, span: 2, placeholder: "09:00" },
          { key: "closes", label: "Closes", kind: "text", required: true, span: 2, placeholder: "24:00" },
          { key: "note", label: "Note", kind: "text", span: 4 },
        ],
      },
      {
        key: "policies",
        title: "Closures and cancellations",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "holidays", label: "Days you know you'll be closed", kind: "text", span: 6, placeholder: "Public holidays…" },
          { key: "cancelHours", label: "Free cancellation up to (hours before)", kind: "number", required: true, span: 3, placeholder: "6" },
          { key: "cancelNote", label: "And after that", kind: "text", span: 3, placeholder: "No cancellation" },
        ],
      },
    ],
  },
  {
    key: "offerings",
    num: "03",
    title: "What you sell",
    due: "week1",
    blurb:
      "The price list, in full. This is the longest job in the pack and the one nothing else can start without — every screen in the system is a view of this list.",
    cards: [
      {
        key: "items",
        title: "Products and services",
        hint: "One line per thing at one price. Three sizes means three lines.",
        due: "week1",
        kind: "table",
        addLabel: "Add a product",
        minRows: 1,
        emptyHint: "Nothing yet. Start with the ten things you sell most.",
        columns: [
          { key: "category", label: "Category", kind: "text", span: 3, placeholder: "Hot drinks" },
          { key: "name", label: "Name", kind: "text", required: true, span: 3, placeholder: "Cappuccino" },
          { key: "variant", label: "Size or variant", kind: "text", span: 2, placeholder: "Regular" },
          { key: "price", label: "Price", kind: "number", required: true, span: 2, placeholder: "7000" },
          { key: "description", label: "Description", kind: "text", span: 6 },
          { key: "notes", label: "Notes", kind: "text", span: 6 },
        ],
      },
      {
        key: "bookables",
        title: "Anything booked by time",
        hint: "Rooms, courts, tables, appointment slots. Skip it if nothing you sell works that way.",
        due: "week1",
        kind: "table",
        addLabel: "Add a bookable",
        emptyHint: "Nothing booked by time — skip this one.",
        columns: [
          { key: "name", label: "Name", kind: "text", required: true, span: 4 },
          { key: "type", label: "Type", kind: "text", span: 3 },
          { key: "durations", label: "Slot lengths (minutes)", kind: "text", required: true, span: 3, placeholder: "60; 90; 120" },
          { key: "price", label: "Price per slot", kind: "number", span: 2 },
        ],
      },
    ],
  },
  {
    key: "people",
    num: "04",
    title: "Your team",
    due: "week3",
    blurb: "Accounts and training logins are created from this list.",
    cards: [
      {
        key: "staff",
        title: "Everyone who will use the system",
        due: "week3",
        kind: "table",
        addLabel: "Add a person",
        minRows: 1,
        emptyHint: "Nothing yet — start with whoever works the till.",
        columns: [
          { key: "name", label: "Name", kind: "text", required: true, span: 5 },
          { key: "role", label: "What they do", kind: "text", required: true, span: 4, placeholder: "Till · Kitchen · Manager" },
          { key: "note", label: "Note", kind: "text", span: 3 },
        ],
      },
    ],
  },
  {
    key: "brand",
    num: "05",
    title: "Branding and content",
    due: "week2",
    blurb:
      "Files can't be attached here — send them however you normally send us things, and tell us where they are.",
    cards: [
      {
        key: "assets",
        title: "What we need, and where it is",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "logo", label: "Logo files", kind: "text", required: true, span: 6, placeholder: "A link, or “sending it on WhatsApp”" },
          { key: "colors", label: "Brand colours", kind: "text", span: 6 },
          { key: "photos", label: "Photography", kind: "text", span: 6, placeholder: "A link, or “none yet”" },
          { key: "fonts", label: "Font files", kind: "text", span: 6 },
          { key: "copyOwner", label: "Who writes the words", kind: "text", required: true, span: 6, placeholder: "A name — or “Kagu drafts, we review”" },
          { key: "copyBy", label: "Words ready by", kind: "date", span: 6 },
        ],
      },
    ],
  },
  {
    key: "review",
    num: "06",
    title: "Anything else",
    due: "week1",
    blurb: "The question no form thinks to ask.",
    cards: [
      {
        key: "notes",
        title: "Anything we should know?",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "body", label: "In your own words", kind: "long", span: 12, placeholder: "Questions, concerns, special cases…" },
        ],
      },
    ],
  },
];

/* ── Pack: touch-padel ────────────────────────────────────────────────────── */
/**
 * A faithful port of the Touch Padel input form. Question for question, in the
 * same order, with the same conditional reveals and the same Arabic — the one
 * thing deliberately NOT carried over is its styling, which was its own dark
 * teal theme; this renders in the KaguOs system like everything else.
 *
 * Two structural departures, both forced and both harmless:
 *
 *  - The rate-rule court picker was a <select> populated from the courts the
 *    client had just typed in. Nothing here can build a dropdown out of another
 *    card's rows, so it is a text field that says "as written above". The
 *    original's own CSV export resolved it to the court NAME anyway.
 *  - Sub-recipes nested a list of ingredients inside each sub-recipe row. Rows
 *    here don't nest, so it is split in two — one table naming each batch and
 *    its yield, one listing what goes into it. That is exactly the shape the
 *    original's export flattened them into.
 */
const PADEL_SECTIONS: IntakeSection[] = [
  {
    key: "decisions",
    num: "01",
    title: "Decisions",
    titleAr: "القرارات والتأكيدات",
    due: "week1",
    blurb:
      "Everything Kagu needs from Touch to build on time. The four-week clock runs on these inputs — a week's delay here is a week off the end.",
    blurbAr:
      "كل ما تحتاجه كاغو من Touch للبناء في الوقت المحدد. مدة البناء أربعة أسابيع، وأي تأخير هنا يعني أسبوعاً أقل في النهاية.",
    cards: [
      {
        key: "filler",
        title: "Who is filling this form?",
        titleAr: "من يملأ هذا النموذج؟",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "name", label: "Full name", labelAr: "الاسم الكامل", kind: "text", required: true, span: 4, placeholder: "Mustafa …" },
          { key: "role", label: "Role at Touch", labelAr: "الصفة", kind: "text", span: 4, placeholder: "Owner / Manager" },
          { key: "contact", label: "WhatsApp / email", labelAr: "واتساب أو إيميل", kind: "text", required: true, span: 4, placeholder: "+964 …" },
        ],
      },
      {
        key: "currency",
        title: "1 · Currency — Iraqi dinar only",
        titleAr: "العملة — الدينار العراقي فقط",
        hint: "The system trades in a single currency: whole IQD, no decimals. Dual currency (USD alongside IQD) is outside this scope and would be quoted separately.",
        hintAr:
          "النظام يعمل بعملة واحدة: الدينار العراقي بأرقام صحيحة. العملة المزدوجة خارج النطاق وتُسعّر كإضافة.",
        due: "week1",
        kind: "fields",
        flag: { key: "mode", values: ["discuss"], note: "flagged for the call" },
        fields: [
          {
            key: "mode",
            label: "Currency",
            labelAr: "العملة",
            kind: "choice",
            required: true,
            options: [
              { value: "confirmed", label: "IQD single currency — confirmed", labelAr: "مؤكد" },
              { value: "discuss", label: "Need to discuss on the call", labelAr: "نناقشه في المكالمة" },
            ],
          },
        ],
      },
      {
        key: "tax",
        title: "2 · Tax",
        titleAr: "الضريبة",
        hint: "Default is 0% on everything until your accountant decides otherwise. If any item group carries tax, we need the rate per group, in writing, from the accountant.",
        hintAr:
          "الافتراضي ٠٪ على كل شيء. إن وجدت ضريبة نحتاج النسبة لكل مجموعة أصناف كتابياً من المحاسب.",
        due: "week1",
        kind: "fields",
        flag: { key: "mode", values: ["pending"], note: "waiting on accountant" },
        fields: [
          {
            key: "mode",
            label: "Tax",
            labelAr: "الضريبة",
            kind: "choice",
            required: true,
            options: [
              { value: "zero", label: "0% across the board", labelAr: "صفر على الكل" },
              { value: "rates", label: "Some groups carry tax — rates below", labelAr: "توجد ضريبة" },
              { value: "pending", label: "Waiting on accountant", labelAr: "بانتظار المحاسب" },
            ],
          },
          {
            key: "rates",
            label: "Rates per item group",
            labelAr: "النسبة لكل مجموعة",
            kind: "long",
            required: true,
            span: 12,
            placeholder: "e.g. Food 0% · Drinks 5% — as stated by the accountant",
            showWhen: { key: "mode", values: ["rates"] },
          },
        ],
      },
      {
        key: "kurdish",
        title: "3 · Kurdish as a third language?",
        titleAr: "الكردية لغة ثالثة؟",
        hint: "This phase delivers English and Arabic. Kurdish is a change request — inexpensive once the framework exists, but it must be raised now, before content is written.",
        hintAr:
          "المرحلة تشمل الإنجليزية والعربية فقط. الكردية طلب تغيير يجب طرحه الآن قبل كتابة المحتوى.",
        due: "week1",
        kind: "fields",
        flag: { key: "needed", values: ["yes"], note: "change request to quote" },
        fields: [
          {
            key: "needed",
            label: "Kurdish",
            labelAr: "الكردية",
            kind: "choice",
            required: true,
            options: [
              { value: "no", label: "Not needed", labelAr: "غير مطلوبة" },
              { value: "yes", label: "Needed — quote it as a change request", labelAr: "مطلوبة — سعّروها" },
            ],
          },
        ],
      },
      {
        key: "domain",
        title: "4 · Domain name",
        titleAr: "اسم النطاق",
        hint: "Registered in Touch's name, with DNS access for Kagu — without it the website cannot go live on your domain.",
        hintAr:
          "مسجل باسم Touch مع صلاحية DNS لكاغو — بدونه لا يمكن إطلاق الموقع على نطاقكم.",
        due: "week1",
        kind: "fields",
        flag: { key: "status", values: ["help"], note: "needs Kagu's help" },
        fields: [
          { key: "name", label: "Exact domain", labelAr: "النطاق بالضبط", kind: "text", required: true, span: 6, placeholder: "touchpadel.com" },
          {
            key: "status",
            label: "Status",
            labelAr: "الحالة",
            kind: "choice",
            required: true,
            span: 6,
            options: [
              { value: "registered", label: "Already registered", labelAr: "مسجل" },
              { value: "willreg", label: "Registering this week", labelAr: "هذا الأسبوع" },
              { value: "help", label: "Need Kagu's help", labelAr: "نحتاج مساعدة" },
            ],
          },
        ],
      },
      {
        key: "pitr",
        title: "5 · Database recovery (PITR) — a hosting cost, billed to Touch",
        titleAr: "استرجاع قاعدة البيانات — تكلفة على حساب Touch",
        hint: "Option A — point-in-time recovery: restore to any minute in the last 7 days; a paid add-on (~$100/mo) on top of the ~$25/mo Pro plan. Recommended once real trading data exists. Option B — daily backups only (included in Pro): restore to the previous day at worst.",
        hintAr:
          "الخيار أ: استرجاع لأي دقيقة خلال ٧ أيام (~١٠٠$ شهرياً إضافة على خطة برو ~٢٥$). الخيار ب: نسخ يومي فقط (ضمن برو) — الاسترجاع ليوم السابق في أسوأ حال.",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "mode",
            label: "Recovery",
            labelAr: "الاسترجاع",
            kind: "choice",
            required: true,
            options: [
              { value: "pitr", label: "Option A — PITR on (~$100/mo)", labelAr: "الاسترجاع الكامل" },
              { value: "daily", label: "Option B — daily backups only", labelAr: "النسخ اليومي فقط" },
            ],
          },
        ],
      },
      {
        key: "downpay",
        title: "6 · Down payment",
        titleAr: "الدفعة الأولى",
        hint: "The four-week build begins on receipt, not before.",
        hintAr: "مدة البناء تبدأ عند الاستلام، لا قبله.",
        due: "week1",
        kind: "fields",
        flag: { key: "status", values: ["question"], note: "the client has a question" },
        fields: [
          {
            key: "status",
            label: "Down payment",
            labelAr: "الدفعة",
            kind: "choice",
            required: true,
            options: [
              { value: "sent", label: "Sent", labelAr: "أُرسلت" },
              { value: "scheduled", label: "Scheduled — date below", labelAr: "مجدولة" },
              { value: "question", label: "Have a question", labelAr: "لدينا سؤال" },
            ],
          },
          {
            key: "date",
            label: "Date",
            labelAr: "التاريخ",
            kind: "date",
            required: true,
            span: 4,
            showWhen: { key: "status", values: ["scheduled"] },
          },
          {
            key: "note",
            label: "Note",
            labelAr: "ملاحظة",
            kind: "text",
            span: 8,
            showWhen: { key: "status", values: ["scheduled", "question"] },
          },
        ],
      },
      {
        key: "approver",
        title: "7 · Named approver, available weekly",
        titleAr: "المخوّل المعتمد — متاح أسبوعياً",
        hint: "One person who signs phase acceptance every week. Without them, acceptance cannot be signed and the schedule slips.",
        hintAr:
          "شخص واحد يوقّع قبول المراحل أسبوعياً — بدونه يتأخر الجدول.",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "name", label: "Name", labelAr: "الاسم", kind: "text", required: true, span: 4, placeholder: "Mustafa …" },
          { key: "contact", label: "WhatsApp / email", labelAr: "واتساب / إيميل", kind: "text", required: true, span: 4, placeholder: "+964 …" },
          { key: "slot", label: "Weekly slot that suits them", labelAr: "الموعد الأسبوعي المناسب", kind: "text", span: 4, placeholder: "e.g. Fridays 6pm" },
        ],
      },
    ],
  },

  {
    key: "setup",
    num: "02",
    title: "Setup checklist",
    titleAr: "تجهيزات الأسابيع ١–٣",
    due: "week2",
    blurb: "The things that have to exist in the real world before software can use them.",
    blurbAr: "الأشياء التي يجب أن تكون جاهزة على أرض الواقع قبل أن يستخدمها البرنامج.",
    cards: [
      {
        key: "hosting",
        title: "Hosting account — funded, in Touch's name",
        titleAr: "حساب الاستضافة ممول باسم Touch",
        hint: "Week 1. Create the project in the Frankfurt region — the closest well-supported region to Iraq; changing region later means a migration. Only hosting and the domain are billed to Touch.",
        hintAr:
          "الأسبوع الأول. أنشئوا المشروع في منطقة فرانكفورت — تغييرها لاحقاً يعني ترحيل قاعدة البيانات.",
        due: "week1",
        kind: "fields",
        flag: { key: "status", values: ["help"], note: "needs a walkthrough" },
        fields: [
          {
            key: "status",
            label: "Account",
            labelAr: "الحساب",
            kind: "choice",
            required: true,
            options: [
              { value: "done", label: "Account created & funded", labelAr: "جاهز" },
              { value: "week", label: "Doing it this week", labelAr: "هذا الأسبوع" },
              { value: "help", label: "Need Kagu to walk us through it", labelAr: "نحتاج مساعدة" },
            ],
          },
          { key: "email", label: "Billing email on the account", labelAr: "إيميل الفوترة", kind: "text", span: 6, placeholder: "billing@touchpadel.com" },
          {
            key: "region",
            label: "Frankfurt region",
            labelAr: "منطقة فرانكفورت",
            kind: "choice",
            required: true,
            span: 6,
            options: [
              { value: "ok", label: "Understood & agreed", labelAr: "موافقون" },
              { value: "ask", label: "We have a question", labelAr: "لدينا سؤال" },
            ],
          },
        ],
      },
      {
        key: "fonts",
        title: "Brand font licences — Next Art (Latin) + Frutiger LT Arabic",
        titleAr: "ملفات ترخيص الخطوط",
        hint: "Week 1. We need the actual licensed font files, not screenshots. Until then we build with free stand-ins and swap later.",
        hintAr:
          "نحتاج ملفات الخطوط المرخصة نفسها، لا صوراً. حتى تصلنا نستخدم بدائل مجانية ثم نستبدلها.",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "status",
            label: "Fonts",
            labelAr: "الخطوط",
            kind: "choice",
            required: true,
            options: [
              { value: "have", label: "We have the files — sending them", labelAr: "لدينا الملفات" },
              { value: "buy", label: "Buying the licences this week", labelAr: "سنشتريها هذا الأسبوع" },
              { value: "standins", label: "Use free stand-ins for now", labelAr: "بدائل مجانية حالياً" },
            ],
          },
        ],
      },
      {
        key: "printer",
        title: "Receipt printer",
        titleAr: "طابعة الفواتير",
        hint: "Order Week 1, installed by Week 3. Spec: 80mm thermal · 203 dpi · ESC/POS with GS v 0 raster (Arabic prints as rendered images — raster is not optional) · USB + Ethernet on the same unit · auto-cutter. Examples: Epson TM-T20III (Ethernet) or Xprinter XP-80C. Not: 58mm, Bluetooth-only, or label printers.",
        hintAr:
          "حراري ٨٠ ملم · ٢٠٣ dpi · ESC/POS مع دعم الصور النقطية (ضروري للعربية) · USB + إيثرنت معاً · قاطع تلقائي. لا تشتروا: ٥٨ ملم أو بلوتوث فقط أو طابعات ملصقات.",
        due: "week2",
        kind: "fields",
        flag: { key: "status", values: ["help"], note: "needs help choosing" },
        fields: [
          { key: "model", label: "Model you are buying", labelAr: "الموديل", kind: "text", span: 5, placeholder: "Epson TM-T20III (Ethernet)" },
          {
            key: "status",
            label: "Status",
            labelAr: "الحالة",
            kind: "choice",
            required: true,
            span: 7,
            options: [
              { value: "arrived", label: "Arrived", labelAr: "وصلت" },
              { value: "ordered", label: "Ordered", labelAr: "مطلوبة" },
              { value: "soon", label: "Ordering this week", labelAr: "سنطلبها هذا الأسبوع" },
              { value: "help", label: "Need help choosing", labelAr: "نحتاج مساعدة" },
            ],
          },
        ],
      },
      {
        key: "venue",
        title: "Power & network at the venue",
        titleAr: "الكهرباء والشبكة في المحل",
        hint: "Per the contract, Touch provides: a UPS covering the till, printer, router and switch (most interruptions in Iraq are power — the till keeps trading through an outage only if it stays powered); a fixed local address for the till so the kitchen screen and printer never lose it; till and printer wired by Ethernet; and a business internet line wired to the till.",
        hintAr:
          "حسب العقد على Touch توفير: UPS يغطي الكاشير والطابعة والراوتر والسويتش · عنوان ثابت لجهاز الكاشير على الشبكة المحلية · توصيل الكاشير والطابعة بكيبل إيثرنت · خط إنترنت تجاري موصول بالكاشير.",
        due: "week2",
        kind: "fields",
        flag: { key: "staticIp", values: ["who"], note: "router manager unknown — tell Kagu" },
        fields: [
          {
            key: "ups",
            label: "UPS",
            labelAr: "مزود الطاقة",
            kind: "choice",
            required: true,
            span: 6,
            options: [
              { value: "have", label: "Have one", labelAr: "موجود" },
              { value: "buying", label: "Buying one", labelAr: "سنشتريه" },
              { value: "help", label: "Need advice", labelAr: "نحتاج نصيحة" },
            ],
          },
          {
            key: "staticIp",
            label: "Fixed IP for the till",
            labelAr: "عنوان ثابت للكاشير",
            kind: "choice",
            required: true,
            span: 6,
            options: [
              { value: "done", label: "Arranged", labelAr: "تم" },
              { value: "will", label: "Will arrange by Week 3", labelAr: "قبل الأسبوع ٣" },
              { value: "who", label: "Don't know who manages the router", labelAr: "لا نعرف من يدير الراوتر" },
            ],
          },
          { key: "routerOwner", label: "Who manages the venue router?", labelAr: "من يدير الراوتر؟", kind: "text", span: 6, placeholder: "Name / company + phone" },
          { key: "hardwareDate", label: "Hardware all in place by", labelAr: "الأجهزة جاهزة بتاريخ", kind: "date", span: 6 },
        ],
      },
      {
        key: "training",
        title: "Staff availability for training — Week 5",
        titleAr: "تفرّغ الموظفين للتدريب — الأسبوع ٥",
        due: "week3",
        kind: "fields",
        fields: [
          {
            key: "status",
            label: "Training",
            labelAr: "التدريب",
            kind: "choice",
            required: true,
            options: [
              { value: "yes", label: "Staff will be available", labelAr: "سيكونون متاحين" },
              { value: "tight", label: "Tight — let's plan dates early", labelAr: "نحدد المواعيد مبكراً" },
            ],
          },
        ],
      },
    ],
  },

  {
    key: "courts",
    num: "03",
    title: "Courts, hours & rates",
    titleAr: "الملاعب والأوقات والأسعار",
    due: "week1",
    cards: [
      {
        key: "list",
        title: "Courts",
        titleAr: "الملاعب",
        hint: "One row per court. Durations in minutes, separated by ; — e.g. 60;90;120.",
        hintAr: "صف لكل ملعب. مدد الحجز بالدقائق مفصولة بـ ;",
        due: "week1",
        kind: "table",
        addLabel: "Add court",
        addLabelAr: "أضف ملعباً",
        minRows: 1,
        emptyHint: "No courts yet",
        emptyHintAr: "لا ملاعب بعد",
        columns: [
          { key: "en", label: "Court name (EN)", labelAr: "اسم الملعب EN", kind: "text", required: true, span: 4, placeholder: "Court 1" },
          { key: "ar", label: "Court name (AR)", labelAr: "اسم الملعب AR", kind: "text", required: true, span: 4, rtl: true, placeholder: "ملعب ١" },
          {
            key: "io",
            label: "Type",
            labelAr: "النوع",
            kind: "choice",
            required: true,
            span: 2,
            options: [
              { value: "indoor", label: "indoor", labelAr: "داخلي" },
              { value: "outdoor", label: "outdoor", labelAr: "خارجي" },
            ],
          },
          { key: "dur", label: "Durations (min)", labelAr: "المدد", kind: "text", required: true, span: 2, placeholder: "60;90;120" },
        ],
      },
      {
        key: "hours",
        title: "Opening hours",
        titleAr: "ساعات العمل",
        hint: "24h clock. 24:00 means a midnight close. Mark a day Closed for full closing days.",
        hintAr: "بنظام ٢٤ ساعة. 24:00 تعني الإغلاق منتصف الليل.",
        due: "week1",
        kind: "fields",
        fields: hoursFields(),
      },
      {
        key: "policy",
        title: "Closures & cancellation",
        titleAr: "الإغلاقات والإلغاء",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "closedDays", label: "Known holiday closures", labelAr: "إغلاقات الأعياد المعروفة", kind: "text", span: 6, placeholder: "e.g. Eid al-Fitr day 1, Eid al-Adha day 1" },
          { key: "cancelHours", label: "Cancellation — hours before start", labelAr: "مهلة الإلغاء (ساعات)", kind: "number", required: true, span: 3, placeholder: "6" },
          { key: "cancelNote", label: "Cancellation note", labelAr: "ملاحظة", kind: "text", span: 3, placeholder: "After that, no cancellation" },
        ],
      },
      {
        key: "rates",
        title: "Rate rules — one row per price rule",
        titleAr: "قواعد الأسعار — صف لكل قاعدة",
        hint: "Prices can differ by court, day, time window and duration. Every open hour of every court must be covered by some rule — start with your default off-peak price on All days / All courts, then add the exceptions (e.g. Fri–Sat evenings). Whole dinars: 45000 = 45,000 IQD.",
        hintAr:
          "تختلف الأسعار حسب الملعب واليوم والفترة والمدة. يجب أن تغطي القواعد كل ساعات العمل — ابدأوا بالسعر الافتراضي لكل الأيام والملاعب ثم أضيفوا الاستثناءات. أرقام صحيحة بالدينار فقط.",
        due: "week1",
        kind: "table",
        addLabel: "Add rate rule",
        addLabelAr: "أضف قاعدة سعر",
        minRows: 1,
        emptyHint: "No rules yet",
        emptyHintAr: "لا قواعد بعد",
        columns: [
          { key: "court", label: "Court — name as above, or “All courts”", labelAr: "الملعب", kind: "text", required: true, span: 3, placeholder: "All courts" },
          {
            key: "days",
            label: "Days",
            labelAr: "الأيام",
            kind: "multi",
            required: true,
            span: 9,
            options: [
              { value: "all", label: "All days", labelAr: "كل الأيام" },
              ...DAYS.map((d) => ({ value: d.key, label: d.en.slice(0, 3), labelAr: d.ar })),
            ],
          },
          { key: "ws", label: "From (24h)", labelAr: "من", kind: "text", required: true, span: 2, placeholder: "17:00" },
          { key: "we", label: "To (24h)", labelAr: "إلى", kind: "text", required: true, span: 2, placeholder: "23:00" },
          { key: "dur", label: "Duration (min)", labelAr: "المدة", kind: "number", required: true, span: 2, placeholder: "90" },
          { key: "price", label: "Price (whole IQD)", labelAr: "السعر بالدينار", kind: "number", required: true, span: 3, placeholder: "45000" },
        ],
      },
    ],
  },

  {
    key: "menu",
    num: "04",
    title: "Menu",
    titleAr: "القائمة الكاملة",
    due: "week1",
    blurb:
      "One row per item + size. Modifiers get their own rows. Every text field needs BOTH English and Arabic — an empty Arabic means the app shows English in the Arabic interface, which fails acceptance.",
    blurbAr:
      "صف لكل منتج + حجم، وصف مستقل لكل خيار إضافي. كل حقل نصي يحتاج الإنجليزية والعربية معاً.",
    cards: [
      {
        key: "items",
        title: "Menu rows",
        titleAr: "صفوف القائمة",
        hint: "Prices are whole IQD: 7000 = 7,000 IQD. One size only? Use Regular / عادي. For a modifier (e.g. Oat milk +1000), duplicate the item's row and fill the modifier fields — delta 0 if free.",
        hintAr:
          "الأسعار أرقام صحيحة بالدينار. لمنتج بحجم واحد اكتبوا «عادي». للإضافات: كرروا صف المنتج واملأوا حقول الإضافة (السعر الإضافي ٠ إن كانت مجانية).",
        due: "week1",
        kind: "table",
        addLabel: "Add menu row",
        addLabelAr: "أضف صفاً",
        minRows: 1,
        emptyHint: "No menu rows yet",
        emptyHintAr: "لا صفوف بعد",
        columns: [
          { key: "cat_en", label: "Category (EN)", labelAr: "القسم EN", kind: "text", required: true, span: 3, placeholder: "Hot Drinks" },
          { key: "cat_ar", label: "Category (AR)", labelAr: "القسم AR", kind: "text", required: true, span: 3, rtl: true, placeholder: "مشروبات ساخنة" },
          { key: "item_en", label: "Item (EN)", labelAr: "المنتج EN", kind: "text", required: true, span: 3, placeholder: "Cappuccino" },
          { key: "item_ar", label: "Item (AR)", labelAr: "المنتج AR", kind: "text", required: true, span: 3, rtl: true, placeholder: "كابتشينو" },
          { key: "desc_en", label: "Description (EN, optional)", labelAr: "الوصف EN", kind: "text", span: 6, placeholder: "Double shot with steamed milk" },
          { key: "desc_ar", label: "Description (AR)", labelAr: "الوصف AR", kind: "text", span: 6, rtl: true, placeholder: "جرعتان مع حليب مبخر" },
          { key: "size_en", label: "Size (EN)", labelAr: "الحجم EN", kind: "text", required: true, span: 2, placeholder: "Regular" },
          { key: "size_ar", label: "Size (AR)", labelAr: "الحجم AR", kind: "text", required: true, span: 2, rtl: true, placeholder: "عادي" },
          { key: "price", label: "Price (IQD)", labelAr: "السعر", kind: "number", required: true, span: 2, placeholder: "7000" },
          { key: "mg_en", label: "Modifier group (EN)", labelAr: "مجموعة الخيارات EN", kind: "text", span: 3, placeholder: "Milk" },
          { key: "mg_ar", label: "Modifier group (AR)", labelAr: "مجموعة الخيارات AR", kind: "text", span: 3, rtl: true, placeholder: "الحليب" },
          { key: "mo_en", label: "Modifier option (EN)", labelAr: "الخيار EN", kind: "text", span: 3, placeholder: "Oat milk" },
          { key: "mo_ar", label: "Modifier option (AR)", labelAr: "الخيار AR", kind: "text", span: 3, rtl: true, placeholder: "حليب الشوفان" },
          { key: "mdelta", label: "+ price (IQD, 0 = free)", labelAr: "السعر الإضافي", kind: "number", span: 2, placeholder: "1000" },
          { key: "alg", label: "Allergens", labelAr: "مسببات الحساسية", kind: "multi", span: 10, options: ALLERGENS },
        ],
      },
    ],
  },

  {
    key: "recipes",
    num: "05",
    title: "Recipes & ingredients",
    titleAr: "الوصفات والمكونات",
    due: "week2",
    cards: [
      {
        key: "warning",
        title: "The contract names this the single largest risk of the phase.",
        titleAr: "العقد يسمي هذا البند أكبر خطر في المرحلة كلها",
        hint: "Stock tracking, margin reporting and batch expiry all depend on it. The one rule: measured quantities — a number and a unit (g, ml, pc), weighed in the kitchen, not estimated at a desk. “A scoop” and “some milk” are useless. No kitchen scale? A $10 scale this week is the cheapest fix in the entire project.",
        hintAr:
          "القاعدة الوحيدة: كميات مقاسة — رقم ووحدة (غرام، مليلتر، قطعة) موزونة في المطبخ. «ملعقة» و«قليل من الحليب» غير مقبولة. إن لم يوجد ميزان مطبخ، شراؤه هذا الأسبوع أرخص حل في المشروع كله.",
        due: "week2",
        kind: "note",
        tone: "warning",
      },
      {
        key: "lines",
        title: "Recipes — per product + size",
        titleAr: "الوصفات لكل منتج وحجم",
        hint: "One row per ingredient in each product+size. Item and size must match the Menu section exactly. An ingredient can also be a sub-recipe name from the next block.",
        hintAr:
          "صف لكل مكون في كل منتج وحجم. الاسم والحجم مطابقان لقسم القائمة. يمكن أن يكون المكون اسم وصفة فرعية.",
        due: "week2",
        kind: "table",
        addLabel: "Add recipe line",
        addLabelAr: "أضف سطراً",
        emptyHint: "No recipe lines yet",
        emptyHintAr: "لا أسطر بعد",
        columns: [
          { key: "item", label: "Item (EN) — as in Menu", labelAr: "المنتج كما في القائمة", kind: "text", required: true, span: 3, placeholder: "Cappuccino" },
          { key: "item_ar", label: "Item (AR)", labelAr: "المنتج AR", kind: "text", span: 2, rtl: true, placeholder: "كابتشينو" },
          { key: "size", label: "Size — as in Menu", labelAr: "الحجم", kind: "text", required: true, span: 2, placeholder: "Large" },
          { key: "ing", label: "Ingredient or sub-recipe", labelAr: "المكون أو الوصفة الفرعية", kind: "text", required: true, span: 3, placeholder: "Espresso beans" },
          { key: "qty", label: "Qty", labelAr: "الكمية", kind: "number", required: true, span: 1, placeholder: "18" },
          { key: "unit", label: "Unit", labelAr: "الوحدة", kind: "choice", required: true, span: 1, options: UNIT_OPTIONS },
        ],
      },
      {
        key: "subs",
        title: "Sub-recipes — batch preparations",
        titleAr: "الوصفات الفرعية — تحضيرات الدفعات",
        hint: "Things you prepare in batches and use inside other recipes: garlic sauce, syrup, dough. Name each batch and how much one batch yields; what goes into it goes in the table below.",
        hintAr:
          "ما تحضرونه دفعات ويُستخدم داخل وصفات أخرى: صلصة الثوم، القطر، العجين. سمّوا كل دفعة وكمية إنتاجها، ومكوناتها في الجدول التالي.",
        due: "week2",
        kind: "table",
        addLabel: "Add sub-recipe",
        addLabelAr: "أضف وصفة فرعية",
        emptyHint: "No sub-recipes",
        emptyHintAr: "لا وصفات فرعية",
        columns: [
          { key: "en", label: "Sub-recipe name (EN)", labelAr: "الاسم EN", kind: "text", required: true, span: 4, placeholder: "Garlic sauce" },
          { key: "ar", label: "Sub-recipe name (AR)", labelAr: "الاسم AR", kind: "text", required: true, span: 4, rtl: true, placeholder: "صلصة الثوم" },
          { key: "yq", label: "Batch yield — qty", labelAr: "إنتاج الدفعة", kind: "number", required: true, span: 2, placeholder: "800" },
          { key: "yu", label: "Yield unit", labelAr: "وحدة الإنتاج", kind: "choice", required: true, span: 2, options: UNIT_OPTIONS },
        ],
      },
      {
        key: "subLines",
        title: "What goes into one batch",
        titleAr: "مكونات الدفعة الواحدة",
        hint: "One row per ingredient of a sub-recipe. Sub-recipes may contain only raw ingredients — no sub-recipe inside a sub-recipe in this phase.",
        hintAr:
          "صف لكل مكون في الوصفة الفرعية. لا وصفة فرعية داخل وصفة فرعية في هذه المرحلة.",
        due: "week2",
        kind: "table",
        addLabel: "Add ingredient line",
        addLabelAr: "أضف مكوناً",
        emptyHint: "Nothing yet",
        emptyHintAr: "لا شيء بعد",
        columns: [
          { key: "sub", label: "Sub-recipe (EN) — as above", labelAr: "الوصفة الفرعية", kind: "text", required: true, span: 4, placeholder: "Garlic sauce" },
          { key: "ing", label: "Ingredient", labelAr: "المكون", kind: "text", required: true, span: 4, placeholder: "Garlic" },
          { key: "qty", label: "Qty", labelAr: "الكمية", kind: "number", required: true, span: 2, placeholder: "100" },
          { key: "unit", label: "Unit", labelAr: "الوحدة", kind: "choice", required: true, span: 2, options: UNIT_OPTIONS },
        ],
      },
      {
        key: "ings",
        title: "Ingredients — everything you buy",
        titleAr: "المكونات — كل ما تشترونه",
        hint: "Pack size + pack cost is how the system computes the real cost of every drink and dish sold. Shelf life (days it keeps after opening/delivery) drives expiry warnings on stock batches.",
        hintAr:
          "حجم العبوة وتكلفتها هما أساس حساب التكلفة الحقيقية لكل صنف. مدة الصلاحية تشغّل تنبيهات انتهاء الدفعات.",
        due: "week2",
        kind: "table",
        addLabel: "Add ingredient",
        addLabelAr: "أضف مكوناً",
        emptyHint: "No ingredients yet",
        emptyHintAr: "لا مكونات بعد",
        columns: [
          { key: "en", label: "Ingredient (EN)", labelAr: "المكون EN", kind: "text", required: true, span: 4, placeholder: "Espresso beans" },
          { key: "ar", label: "Ingredient (AR)", labelAr: "المكون AR", kind: "text", required: true, span: 4, rtl: true, placeholder: "حبوب إسبريسو" },
          { key: "pack", label: "Pack size (with unit)", labelAr: "حجم العبوة", kind: "text", required: true, span: 4, placeholder: "1000 g" },
          { key: "cost", label: "Pack cost (whole IQD)", labelAr: "تكلفة العبوة", kind: "number", required: true, span: 3, placeholder: "25000" },
          { key: "supplier", label: "Supplier", labelAr: "المورد", kind: "text", required: true, span: 6, placeholder: "Al-Rasheed Foods" },
          { key: "shelf", label: "Shelf life (days)", labelAr: "الصلاحية بالأيام", kind: "number", required: true, span: 3, placeholder: "90" },
        ],
      },
    ],
  },

  {
    key: "staff",
    num: "06",
    title: "Staff",
    titleAr: "الموظفون",
    due: "week3",
    cards: [
      {
        key: "list",
        title: "Each staff member and their intended role",
        titleAr: "كل موظف ودوره",
        hint: "Accounts and training PINs are created from this list.",
        hintAr: "تُنشأ الحسابات ورموز التدريب من هذه القائمة.",
        due: "week3",
        kind: "table",
        addLabel: "Add staff member",
        addLabelAr: "أضف موظفاً",
        minRows: 1,
        emptyHint: "No staff yet",
        emptyHintAr: "لا موظفين بعد",
        columns: [
          { key: "name", label: "Name", labelAr: "الاسم", kind: "text", required: true, span: 5 },
          {
            key: "role",
            label: "Role",
            labelAr: "الدور",
            kind: "choice",
            required: true,
            span: 4,
            options: [
              { value: "till", label: "Till", labelAr: "كاشير" },
              { value: "kitchen", label: "Kitchen", labelAr: "مطبخ" },
              { value: "manager", label: "Manager", labelAr: "مدير" },
              { value: "admin", label: "Admin", labelAr: "إدارة" },
            ],
          },
          { key: "note", label: "Note (optional)", labelAr: "ملاحظة", kind: "text", span: 3 },
        ],
      },
    ],
  },

  {
    key: "tables",
    num: "07",
    title: "Tables & floor layout",
    titleAr: "الطاولات ومخطط الأرضية",
    due: "week2",
    blurb:
      "The QR code artwork for every table is generated from this list — late layout means late QR printing means late table ordering.",
    blurbAr:
      "رموز QR للطاولات تُنتج من هذه القائمة — تأخر المخطط يعني تأخر الطباعة والطلب من الطاولة.",
    cards: [
      {
        key: "floor",
        title: "The floor",
        titleAr: "الأرضية",
        due: "week2",
        kind: "fields",
        fields: [
          { key: "count", label: "Number of tables", labelAr: "عدد الطاولات", kind: "number", required: true, span: 3, placeholder: "12" },
          { key: "scheme", label: "Numbering scheme", labelAr: "طريقة الترقيم", kind: "text", required: true, span: 5, placeholder: "1–12, or A1–A6 inside + B1–B6 terrace" },
          { key: "layout", label: "Floor layout — link, or “via WhatsApp”", labelAr: "رابط المخطط أو «واتساب»", kind: "text", span: 4, placeholder: "Drive link / via WhatsApp" },
          { key: "owner", label: "Who delivers the layout", labelAr: "من يسلّم المخطط", kind: "text", required: true, span: 6 },
          { key: "date", label: "By date", labelAr: "بتاريخ", kind: "date", required: true, span: 6 },
        ],
      },
    ],
  },

  {
    key: "brand",
    num: "08",
    title: "Branding & content",
    titleAr: "العلامة والمحتوى",
    due: "week2",
    blurb:
      "Files can't be attached inside this form — send them on WhatsApp or paste a Drive/Dropbox link here so nothing gets lost. Without branding by Week 1, interfaces ship in placeholder styling.",
    blurbAr:
      "الملفات (الشعار، الصور، الخطوط) لا تُرفق داخل هذا النموذج — أرسلوها عبر واتساب أو ضعوا رابط درايف هنا.",
    cards: [
      {
        key: "assets",
        title: "Where everything is",
        titleAr: "أين توجد الملفات",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "logo", label: "Logo files — link, or “via WhatsApp”", labelAr: "ملفات الشعار", kind: "text", required: true, span: 6, placeholder: "Drive link / via WhatsApp" },
          { key: "colors", label: "Brand colours", labelAr: "ألوان العلامة", kind: "text", span: 6, placeholder: "#0A84FF, black … or “in the logo file”" },
          { key: "photos", label: "Photography — link, “via WhatsApp”, or “none yet”", labelAr: "الصور", kind: "text", span: 6, placeholder: "Drive link / none yet" },
          { key: "fontsLink", label: "Font licence files — link, or “via WhatsApp”", labelAr: "ملفات الخطوط", kind: "text", span: 6, placeholder: "Drive link / via WhatsApp" },
          { key: "copyOwner", label: "English + Arabic website copy — who provides it", labelAr: "من يقدم النصوص بالإنجليزية والعربية", kind: "text", required: true, span: 6, placeholder: "Name — or “Kagu drafts, we review”" },
          { key: "copyDate", label: "Copy by date (Week 2)", labelAr: "بتاريخ", kind: "date", span: 6 },
        ],
      },
    ],
  },

  {
    key: "review",
    num: "09",
    title: "Anything else",
    titleAr: "أي شيء آخر",
    due: "week1",
    cards: [
      {
        key: "notes",
        title: "Anything else we should know?",
        titleAr: "هل من شيء آخر يجب أن نعرفه؟",
        due: "week1",
        kind: "fields",
        fields: [
          { key: "body", label: "In your own words", labelAr: "بكلماتكم", kind: "long", span: 12, placeholder: "Questions, concerns, special cases …" },
        ],
      },
    ],
  },
];

/* ── The registry ─────────────────────────────────────────────────────────── */

export const DEFAULT_PACK = "general";

export const INTAKE_PACKS: Record<string, IntakePackDef> = {
  general: {
    key: "general",
    name: "General",
    summary: "The neutral pack — works for any business Kagu builds for.",
    sections: GENERAL_SECTIONS,
  },
  "touch-padel": {
    key: "touch-padel",
    name: "Touch Padel (padel club + café)",
    summary:
      "Courts, rates, a bilingual menu and kitchen recipes. English + Arabic throughout.",
    sections: PADEL_SECTIONS,
  },
};

export const INTAKE_PACK_OPTIONS = Object.values(INTAKE_PACKS).map((pack) => ({
  value: pack.key,
  label: pack.name,
  hint: pack.summary,
}));

/**
 * The pack a project uses. An unknown key falls back to `general` rather than
 * throwing: the column is free text, and a project pointing at a pack that was
 * renamed should show the neutral questions, not an error page.
 */
export function packFor(key: string | null | undefined): IntakePackDef {
  return (key && INTAKE_PACKS[key]) || INTAKE_PACKS[DEFAULT_PACK];
}

/* ── Reading a pack ───────────────────────────────────────────────────────── */

/**
 * The storage key for one answer, namespaced by pack.
 *
 * The pack is in the key so that switching a project's pack doesn't merge two
 * different questionnaires into one set of answers — `decisions.tax.mode` means
 * different things in the two packs, and the general one has no Kurdish
 * question at all. Switching now hides the old answers rather than corrupting
 * them, and switching back brings them intact.
 */
export function answerKey(packKey: string, cardKey: string, fieldKey: string) {
  return `${packKey}.${cardKey}.${fieldKey}`;
}

/** Same reasoning for repeating rows. */
export function tableKey(packKey: string, cardKey: string) {
  return `${packKey}.${cardKey}`;
}

export type AnswerMap = Record<string, string>;

/** One repeating row as the form and the review both read it. */
export type IntakeRow = {
  id: string;
  table_key: string;
  data: Record<string, string>;
  sort: number;
};

const blank = (value: string | undefined) => !value || value.trim() === "";

/** Multi-select values travel as one comma-joined string. */
export function splitMulti(value: string | undefined): string[] {
  return (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

export function joinMulti(values: string[]): string {
  return [...new Set(values.filter(Boolean))].join(",");
}

/**
 * The fields of a card that are actually on screen right now — a `showWhen`
 * field whose condition isn't met is not merely hidden, it is absent from the
 * completion arithmetic. Otherwise answering "0% tax" would leave a permanently
 * unanswerable "rate per group" dragging the meter down, and a club that closes
 * on Fridays could never reach 100%.
 */
export function visibleFields(
  packKey: string,
  card: IntakeCard,
  answers: AnswerMap
): IntakeField[] {
  if (card.kind !== "fields") return [];
  return card.fields.filter((field) => {
    if (!field.showWhen) return true;
    const current = answers[answerKey(packKey, card.key, field.showWhen.key)] ?? "";
    return field.showWhen.values.includes(current);
  });
}

/** Is one repeating row filled in enough to count? */
export function rowComplete(card: IntakeCard, row: IntakeRow): boolean {
  if (card.kind !== "table") return false;
  return card.columns.every((column) =>
    column.required ? !blank(row.data?.[column.key]) : true
  );
}

/** Has the person typed anything at all into this row? */
export function rowTouched(row: IntakeRow): boolean {
  return Object.values(row.data ?? {}).some((value) => !blank(value));
}

/**
 * One line of the completion checklist. `ok` is binary and unforgiving; `note`
 * is where nuance goes — "3 rows still incomplete", "waiting on the accountant"
 * — so the meter stays honest and the client still knows what to do next.
 */
export type IntakeCheck = {
  cardKey: string;
  sectionKey: string;
  label: string;
  labelAr?: string;
  due: IntakeDue;
  ok: boolean;
  note?: string;
  /** Optional cards never move the meter, and are listed as "if it applies". */
  optional: boolean;
};

/**
 * Walk a whole pack once and say, per card, whether it's answered.
 *
 * Deliberately one pass producing one array, rather than a predicate per card:
 * the client's meter, the client's checklist and the team's review screen all
 * consume this, and three call sites re-deriving "is the pack done" is how they
 * end up disagreeing by one.
 */
export function buildChecks(
  pack: IntakePackDef,
  answers: AnswerMap,
  rows: IntakeRow[]
): IntakeCheck[] {
  const checks: IntakeCheck[] = [];

  for (const section of pack.sections) {
    for (const card of section.cards) {
      // Prose panels have nothing to answer, so they are not outstanding items.
      if (card.kind === "note") continue;

      const base = {
        cardKey: card.key,
        sectionKey: section.key,
        label: card.title,
        labelAr: card.titleAr,
        due: card.due,
      };

      if (card.kind === "table") {
        const key = tableKey(pack.key, card.key);
        const mine = rows.filter((row) => row.table_key === key);
        const complete = mine.filter((row) => rowComplete(card, row));
        const partial = mine.filter((row) => rowTouched(row) && !rowComplete(card, row));
        const minRows = card.minRows ?? 0;
        const notes: string[] = [];
        if (complete.length > 0) {
          notes.push(`${complete.length} ${complete.length === 1 ? "line" : "lines"}`);
        }
        if (partial.length > 0) {
          notes.push(
            `${partial.length} ${partial.length === 1 ? "line is" : "lines are"} missing something`
          );
        }
        checks.push({
          ...base,
          optional: minRows === 0,
          ok:
            complete.length >= Math.max(minRows, 1) ||
            (minRows === 0 && mine.length === 0),
          note: notes.join(" · ") || undefined,
        });
        continue;
      }

      const fields = visibleFields(pack.key, card, answers);
      const required = fields.filter((field) => field.required);
      const missing = required.filter((field) =>
        blank(answers[answerKey(pack.key, card.key, field.key)])
      );

      // A card with no required fields is a nice-to-have; it shows in the list
      // so nobody wonders where it went, but it can't hold the pack back.
      const optional = required.length === 0;
      const flagged =
        card.flag &&
        card.flag.values.includes(
          answers[answerKey(pack.key, card.key, card.flag.key)] ?? ""
        );

      checks.push({
        ...base,
        optional,
        ok: optional
          ? fields.some((field) => !blank(answers[answerKey(pack.key, card.key, field.key)]))
          : missing.length === 0,
        note: flagged
          ? card.flag!.note
          : missing.length > 0
            ? `${missing.length} still to answer`
            : undefined,
      });
    }
  }

  return checks;
}

export type IntakeProgress = {
  done: number;
  total: number;
  pct: number;
  /** Week-1 checks only — the ones that decide whether the build can start. */
  week1Done: number;
  week1Total: number;
};

/**
 * The meter. Optional cards are excluded from BOTH sides of the fraction: a
 * business with no sub-recipes should be able to reach 100%, and a pack that
 * tops out at 84% for everyone teaches people to ignore the number.
 */
export function progressOf(checks: IntakeCheck[]): IntakeProgress {
  const counted = checks.filter((check) => !check.optional);
  const done = counted.filter((check) => check.ok).length;
  const total = counted.length;
  const week1 = counted.filter((check) => check.due === "week1");
  return {
    done,
    total,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
    week1Done: week1.filter((check) => check.ok).length,
    week1Total: week1.length,
  };
}

/** Human text for a stored choice value — the review screen shows words, not tokens. */
export function choiceLabel(
  options: IntakeChoice[] | undefined,
  value: string
): { label: string; labelAr?: string } {
  const hit = options?.find((option) => option.value === value);
  return hit ? { label: hit.label, labelAr: hit.labelAr } : { label: value };
}

/* ── Validation, for the write path ───────────────────────────────────────── */

/**
 * Every legal answer key across every pack, built once.
 *
 * Server actions are reachable by direct POST — not only through the form — so
 * "the catalogue says this key exists" is a real check. It spans all packs
 * rather than the project's own, deliberately: knowing which pack a project
 * uses would cost a round-trip on every keystroke's save, and the worst a
 * cross-pack key can do is sit in a row nothing ever reads (keys are namespaced
 * by pack, so it cannot collide with a live answer).
 */
const ANSWER_KEYS: ReadonlySet<string> = new Set(
  Object.values(INTAKE_PACKS).flatMap((pack) =>
    pack.sections.flatMap((section) =>
      section.cards.flatMap((card) =>
        card.kind === "fields"
          ? card.fields.map((field) => answerKey(pack.key, card.key, field.key))
          : []
      )
    )
  )
);

export function isKnownAnswerKey(key: string): boolean {
  return ANSWER_KEYS.has(key);
}

/** The table card behind a namespaced table key, across all packs. */
export function findTable(key: string): (IntakeCard & { kind: "table" }) | undefined {
  for (const pack of Object.values(INTAKE_PACKS)) {
    for (const section of pack.sections) {
      for (const card of section.cards) {
        if (card.kind === "table" && tableKey(pack.key, card.key) === key) return card;
      }
    }
  }
  return undefined;
}

/**
 * Strip a submitted row down to the columns the catalogue actually defines,
 * trimmed and length-capped. Unknown keys are dropped rather than rejected: a
 * browser running yesterday's bundle after a column was renamed should save the
 * columns it still knows about, not fail the whole row.
 */
export function sanitizeRow(
  card: IntakeCard & { kind: "table" },
  data: Record<string, unknown>
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const column of card.columns) {
    const raw = data?.[column.key];
    if (raw == null) continue;
    const value = String(raw).trim().slice(0, 2000);
    if (value) clean[column.key] = value;
  }
  return clean;
}
