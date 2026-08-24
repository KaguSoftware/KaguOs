/**
 * The client input pack — the questions Kagu has to ask a business before it
 * can build anything for them, and the rules that decide when the answers are
 * enough to start.
 *
 * ── Why the catalogue lives in TypeScript ───────────────────────────────────
 *
 * The database (0072) owns the ANSWERS. It does not own the questions, and it
 * shouldn't: the catalogue changes every time Kagu learns a better way to ask
 * something, both sides of the app (the client's form and the team's read-only
 * review) have to agree on the same completion arithmetic, and a schema
 * migration per reworded hint would be absurd. So the pack is data here, and
 * the storage is two generic shapes — scalar answers keyed by `card.field`, and
 * repeating rows keyed by a table's card key.
 *
 * ── Why it is business-neutral ──────────────────────────────────────────────
 *
 * The pack this is modelled on was written for one padel club, and it showed:
 * it asked about courts, a café menu and recipe yields. Kagu builds for
 * restaurants, clinics, shops and studios too, so every question here is the
 * GENERAL form of the one it replaces — "resources you book out" rather than
 * courts, "what you sell" rather than a menu, "things you buy in" rather than
 * ingredients. A business the section doesn't apply to leaves it empty: only
 * `required` questions move the meter, and the specialised ones aren't.
 *
 * ── Adding a question ───────────────────────────────────────────────────────
 *
 * Add the field to its card. That's it — the form renders it, the meter counts
 * it (if `required`), and the review screen shows it. NEVER change an existing
 * `key`: it is the storage key, and renaming one orphans every answer already
 * given under the old name.
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

export const DUE_SHORT: Record<IntakeDue, string> = {
  week1: "Week 1",
  week2: "Week 2",
  week3: "Week 3",
};

export const DUE_ORDER: IntakeDue[] = ["week1", "week2", "week3"];

export type IntakeChoice = { value: string; label: string };

export type IntakeField = {
  key: string;
  label: string;
  kind: "text" | "long" | "date" | "number" | "choice";
  placeholder?: string;
  hint?: string;
  /** Counts toward the completion meter. Everything else is genuinely optional. */
  required?: boolean;
  /** Columns out of 12 on desktop; the whole row on mobile. */
  span?: number;
  /** `choice` only — rendered as chips, one pick. */
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
  kind: "text" | "long" | "number";
  placeholder?: string;
  /** A row counts as complete only once every required column is filled. */
  required?: boolean;
  span?: number;
};

type CardBase = {
  key: string;
  title: string;
  hint?: string;
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
        columns: IntakeColumn[];
        /** 0 = the table is optional and never moves the meter. */
        minRows?: number;
        /** Shown in place of the rows when there are none yet. */
        emptyHint?: string;
      }
  );

export type IntakeSection = {
  key: string;
  num: string;
  title: string;
  blurb?: string;
  due: IntakeDue;
  cards: IntakeCard[];
};

/* ── The pack ─────────────────────────────────────────────────────────────── */

export const INTAKE_SECTIONS: IntakeSection[] = [
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
          {
            key: "name",
            label: "Full name",
            kind: "text",
            required: true,
            span: 4,
            placeholder: "Your name",
          },
          {
            key: "role",
            label: "Role at the business",
            kind: "text",
            span: 4,
            placeholder: "Owner / Manager",
          },
          {
            key: "contact",
            label: "Phone or email",
            kind: "text",
            required: true,
            span: 4,
            placeholder: "The number you actually answer",
          },
        ],
      },
      {
        key: "currency",
        title: "Currency",
        hint: "The system trades in one currency, in whole units, with no decimals unless you say otherwise. Handling two currencies side by side is a separate piece of work — tell us now if you need it.",
        due: "week1",
        kind: "fields",
        flag: {
          key: "mode",
          values: ["discuss"],
          note: "flagged to discuss on the next call",
        },
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
          {
            key: "decimals",
            label: "Prices use decimals?",
            kind: "choice",
            span: 8,
            showWhen: { key: "mode", values: ["single"] },
            options: [
              { value: "whole", label: "Whole numbers only" },
              { value: "decimals", label: "Two decimal places" },
            ],
          },
        ],
      },
      {
        key: "tax",
        title: "Tax",
        hint: "The default is 0% on everything until your accountant says otherwise. If any group of items carries tax we need the rate per group, in writing, from them — not from memory.",
        due: "week1",
        kind: "fields",
        flag: {
          key: "mode",
          values: ["pending"],
          note: "waiting on the accountant",
        },
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
            placeholder: "e.g. Food 0% · Drinks 5% — as stated by the accountant",
            showWhen: { key: "mode", values: ["rates"] },
          },
        ],
      },
      {
        key: "languages",
        title: "Languages",
        hint: "Every piece of text gets written twice per language — menus, buttons, receipts, error messages. Adding one later is cheap; adding one after the content is written is not.",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "primary",
            label: "Languages the build must ship in",
            kind: "text",
            required: true,
            span: 6,
            placeholder: "English + Arabic",
          },
          {
            key: "default",
            label: "Which one opens by default",
            kind: "text",
            span: 6,
            placeholder: "Arabic",
          },
          {
            key: "extra",
            label: "Anything else planned later?",
            kind: "choice",
            options: [
              { value: "no", label: "No — these are the ones" },
              { value: "yes", label: "Yes, one more is likely" },
            ],
          },
          {
            key: "extraName",
            label: "Which language",
            kind: "text",
            span: 6,
            placeholder: "Kurdish",
            showWhen: { key: "extra", values: ["yes"] },
          },
        ],
      },
      {
        key: "domain",
        title: "Domain name",
        hint: "Registered in your business's name, with DNS access shared with Kagu. Without it the site cannot go live on your own address.",
        due: "week1",
        kind: "fields",
        flag: {
          key: "status",
          values: ["help"],
          note: "asked Kagu to handle the registration",
        },
        fields: [
          {
            key: "name",
            label: "The exact domain",
            kind: "text",
            required: true,
            span: 6,
            placeholder: "yourbusiness.com",
          },
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
        hint: "Point-in-time recovery restores your data to any minute in the last seven days and is a paid add-on on your own hosting bill. Daily backups are included and restore to the previous day at worst. Once real money is going through the system, the first one is worth it.",
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
        key: "deposit",
        title: "Down payment",
        hint: "The build clock starts when it lands, not before.",
        due: "week1",
        kind: "fields",
        flag: {
          key: "status",
          values: ["question"],
          note: "you have a question about it",
        },
        fields: [
          {
            key: "status",
            label: "Status",
            kind: "choice",
            required: true,
            options: [
              { value: "sent", label: "Sent" },
              { value: "scheduled", label: "Scheduled" },
              { value: "question", label: "We have a question" },
            ],
          },
          {
            key: "on",
            label: "Date",
            kind: "date",
            required: true,
            span: 4,
            showWhen: { key: "status", values: ["scheduled"] },
          },
          {
            key: "note",
            label: "Note",
            kind: "text",
            span: 8,
            placeholder: "Anything we should know",
            showWhen: { key: "status", values: ["scheduled", "question"] },
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
          {
            key: "contact",
            label: "Phone or email",
            kind: "text",
            required: true,
            span: 4,
          },
          {
            key: "slot",
            label: "A weekly slot that suits them",
            kind: "text",
            span: 4,
            placeholder: "Fridays, early evening",
          },
        ],
      },
    ],
  },

  {
    key: "setup",
    num: "02",
    title: "Setup checklist",
    due: "week2",
    blurb:
      "The things that have to exist in the real world before software can use them. Nothing here is urgent on day one, and all of it is late by week three.",
    cards: [
      {
        key: "hosting",
        title: "Hosting account, in your name",
        hint: "The database and the site are billed to you, not to Kagu — so you own them, and you keep them if you ever walk away. We set it up with you and never hold the only key.",
        due: "week1",
        kind: "fields",
        flag: {
          key: "status",
          values: ["help"],
          note: "wants Kagu to walk them through it",
        },
        fields: [
          {
            key: "status",
            label: "Where it stands",
            kind: "choice",
            required: true,
            options: [
              { value: "done", label: "Created and funded" },
              { value: "week", label: "Doing it this week" },
              { value: "help", label: "Walk us through it" },
            ],
          },
          {
            key: "billingEmail",
            label: "Billing email on the account",
            kind: "text",
            span: 6,
            placeholder: "billing@yourbusiness.com",
          },
          {
            key: "region",
            label: "Server region",
            kind: "choice",
            span: 6,
            hint: "Kagu picks the closest well-supported region. Moving it later means migrating the database.",
            options: [
              { value: "agreed", label: "Kagu's pick is fine" },
              { value: "discuss", label: "We have a preference" },
            ],
          },
        ],
      },
      {
        key: "fonts",
        title: "Font licences",
        hint: "We need the licensed font files themselves, not screenshots of them. Until they arrive we build with free stand-ins and swap them in later.",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "status",
            label: "Where they stand",
            kind: "choice",
            required: true,
            options: [
              { value: "have", label: "We have the files" },
              { value: "buying", label: "Buying the licences this week" },
              { value: "standins", label: "Use free stand-ins" },
              { value: "na", label: "We have no brand fonts" },
            ],
          },
        ],
      },
      {
        key: "hardware",
        title: "Hardware on site",
        hint: "Printers, tills, screens, scanners — anything the system has to drive. Order in week 1, installed by week 3. Tell us the exact model before you buy: half the devices on the market can't print your language.",
        due: "week2",
        kind: "fields",
        flag: {
          key: "status",
          values: ["help"],
          note: "needs help choosing the hardware",
        },
        fields: [
          {
            key: "list",
            label: "What you're buying",
            kind: "long",
            span: 12,
            placeholder: "1 × receipt printer (model), 2 × tablets, 1 × kitchen screen…",
          },
          {
            key: "status",
            label: "Where it stands",
            kind: "choice",
            required: true,
            options: [
              { value: "arrived", label: "Arrived" },
              { value: "ordered", label: "Ordered" },
              { value: "soon", label: "Ordering this week" },
              { value: "help", label: "Need help choosing" },
              { value: "na", label: "No hardware needed" },
            ],
          },
        ],
      },
      {
        key: "power",
        title: "Power and network at the premises",
        hint: "Most interruptions are power, not software. A backup supply covering the till, the printer and the router is what lets you keep trading through a cut; a fixed local address for the till is what stops the printer losing it every time the router restarts.",
        due: "week2",
        kind: "fields",
        flag: {
          key: "network",
          values: ["unknown"],
          note: "nobody knows who manages the router",
        },
        fields: [
          {
            key: "ups",
            label: "Backup power supply",
            kind: "choice",
            required: true,
            span: 6,
            options: [
              { value: "have", label: "Have one" },
              { value: "buying", label: "Buying one" },
              { value: "advice", label: "Need advice" },
              { value: "na", label: "Not applicable" },
            ],
          },
          {
            key: "network",
            label: "Fixed local address for the till",
            kind: "choice",
            required: true,
            span: 6,
            options: [
              { value: "done", label: "Arranged" },
              { value: "will", label: "Will arrange in time" },
              { value: "unknown", label: "We don't know who manages the router" },
            ],
          },
          {
            key: "owner",
            label: "Who manages the router",
            kind: "text",
            span: 6,
            placeholder: "Name or company, plus a number",
          },
          {
            key: "ready",
            label: "Everything in place by",
            kind: "date",
            span: 6,
          },
        ],
      },
      {
        key: "training",
        title: "Staff availability for training",
        hint: "One session, near the end, with the people who will actually use it every day.",
        due: "week3",
        kind: "fields",
        fields: [
          {
            key: "status",
            label: "How that looks",
            kind: "choice",
            required: true,
            options: [
              { value: "yes", label: "They'll be available" },
              { value: "tight", label: "Tight — let's fix dates early" },
            ],
          },
        ],
      },
    ],
  },

  {
    key: "operations",
    num: "03",
    title: "Hours and policies",
    due: "week1",
    blurb:
      "When you're open and what happens when a customer changes their mind. These two decide every booking rule in the system.",
    cards: [
      {
        key: "hours",
        title: "Opening hours",
        hint: "Group the days that share hours — one line for Mon–Thu is better than four identical ones. Use a 24-hour clock, and write 24:00 for a midnight close.",
        due: "week1",
        kind: "table",
        addLabel: "Add a line",
        minRows: 1,
        emptyHint: "Nothing yet — add your first line below.",
        columns: [
          {
            key: "days",
            label: "Days",
            kind: "text",
            required: true,
            span: 4,
            placeholder: "Mon–Thu",
          },
          {
            key: "opens",
            label: "Opens",
            kind: "text",
            required: true,
            span: 2,
            placeholder: "09:00",
          },
          {
            key: "closes",
            label: "Closes",
            kind: "text",
            required: true,
            span: 2,
            placeholder: "24:00",
          },
          {
            key: "note",
            label: "Note",
            kind: "text",
            span: 4,
            placeholder: "Kitchen closes an hour earlier",
          },
        ],
      },
      {
        key: "policies",
        title: "Closures and cancellations",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "holidays",
            label: "Days you know you'll be closed",
            kind: "text",
            span: 6,
            placeholder: "Public holidays, the first day of each Eid…",
          },
          {
            key: "cancelHours",
            label: "Free cancellation up to (hours before)",
            kind: "number",
            required: true,
            span: 3,
            placeholder: "6",
          },
          {
            key: "cancelNote",
            label: "And after that",
            kind: "text",
            span: 3,
            placeholder: "No cancellation",
          },
        ],
      },
    ],
  },

  {
    key: "offerings",
    num: "04",
    title: "What you sell",
    due: "week1",
    blurb:
      "The price list, in full. This is the single longest job in the pack and the one nothing else can start without — every screen in the system is a view of this list.",
    cards: [
      {
        key: "items",
        title: "Products and services",
        hint: "One line per thing at one price. If something comes in three sizes, that's three lines. Prices in whole units of your currency.",
        due: "week1",
        kind: "table",
        addLabel: "Add a product",
        minRows: 1,
        emptyHint: "Nothing yet. Start with the ten things you sell most.",
        columns: [
          {
            key: "category",
            label: "Category",
            kind: "text",
            span: 3,
            placeholder: "Hot drinks",
          },
          {
            key: "name",
            label: "Name",
            kind: "text",
            required: true,
            span: 3,
            placeholder: "Cappuccino",
          },
          {
            key: "variant",
            label: "Size or variant",
            kind: "text",
            span: 2,
            placeholder: "Regular",
          },
          {
            key: "price",
            label: "Price",
            kind: "number",
            required: true,
            span: 2,
            placeholder: "7000",
          },
          {
            key: "description",
            label: "Description",
            kind: "text",
            span: 6,
            placeholder: "Shown to the customer",
          },
          {
            key: "notes",
            label: "Notes",
            kind: "text",
            span: 6,
            placeholder: "Options, allergens, anything unusual",
          },
        ],
      },
      {
        key: "bookables",
        title: "Anything booked by time",
        hint: "Rooms, courts, tables, chairs, appointment slots — anything a customer reserves rather than buys off a shelf. Skip it if nothing you sell works that way.",
        due: "week1",
        kind: "table",
        addLabel: "Add a bookable",
        emptyHint: "Nothing booked by time — skip this one.",
        columns: [
          {
            key: "name",
            label: "Name",
            kind: "text",
            required: true,
            span: 4,
            placeholder: "Court 1 · Treatment room A",
          },
          {
            key: "type",
            label: "Type",
            kind: "text",
            span: 3,
            placeholder: "Indoor / outdoor",
          },
          {
            key: "durations",
            label: "Slot lengths (minutes)",
            kind: "text",
            required: true,
            span: 3,
            placeholder: "60; 90; 120",
          },
          {
            key: "price",
            label: "Price per slot",
            kind: "number",
            span: 2,
            placeholder: "45000",
          },
          {
            key: "rules",
            label: "When the price differs",
            kind: "text",
            span: 12,
            placeholder: "Fri–Sat after 17:00 → 60000",
          },
        ],
      },
    ],
  },

  {
    key: "supplies",
    num: "05",
    title: "Costs and inputs",
    due: "week2",
    blurb:
      "Only fill this in if you want the system to tell you what each sale actually earns. It is optional, it is the most tedious part of the pack, and it is the only way stock levels and real margins can ever be right.",
    cards: [
      {
        key: "stock",
        title: "What you buy in",
        hint: "Pack size and pack cost together are what let the system work out the true cost of one sale. Shelf life drives the expiry warnings.",
        due: "week2",
        kind: "table",
        addLabel: "Add a supply",
        emptyHint: "Optional — skip unless you want cost and stock tracking.",
        columns: [
          {
            key: "name",
            label: "Item",
            kind: "text",
            required: true,
            span: 4,
            placeholder: "Espresso beans",
          },
          {
            key: "pack",
            label: "Pack size",
            kind: "text",
            required: true,
            span: 2,
            placeholder: "1000 g",
          },
          {
            key: "cost",
            label: "Pack cost",
            kind: "number",
            required: true,
            span: 2,
            placeholder: "25000",
          },
          {
            key: "supplier",
            label: "Supplier",
            kind: "text",
            span: 3,
          },
          {
            key: "shelf",
            label: "Shelf life (days)",
            kind: "number",
            span: 1,
            placeholder: "90",
          },
        ],
      },
      {
        key: "buildups",
        title: "What goes into what",
        hint: "One line per input per product. Measured quantities only — a number and a unit, weighed once in the real world. “A scoop” and “some milk” cannot be costed, and guessing here makes every margin figure downstream a fiction.",
        due: "week2",
        kind: "table",
        addLabel: "Add a line",
        emptyHint: "Optional — needed only if you filled in the table above.",
        columns: [
          {
            key: "product",
            label: "Product",
            kind: "text",
            required: true,
            span: 3,
            placeholder: "As written above",
          },
          {
            key: "variant",
            label: "Size or variant",
            kind: "text",
            span: 2,
            placeholder: "Large",
          },
          {
            key: "input",
            label: "Goes in",
            kind: "text",
            required: true,
            span: 3,
            placeholder: "Espresso beans",
          },
          {
            key: "qty",
            label: "Quantity",
            kind: "number",
            required: true,
            span: 2,
            placeholder: "18",
          },
          {
            key: "unit",
            label: "Unit",
            kind: "text",
            required: true,
            span: 2,
            placeholder: "g · ml · pc",
          },
        ],
      },
    ],
  },

  {
    key: "people",
    num: "06",
    title: "Your team",
    due: "week3",
    blurb:
      "Accounts and training logins are created from this list, so a name missing here is a person locked out on opening day.",
    cards: [
      {
        key: "staff",
        title: "Everyone who will use the system",
        hint: "Roles can change later; getting the names down now is the point.",
        due: "week3",
        kind: "table",
        addLabel: "Add a person",
        minRows: 1,
        emptyHint: "Nothing yet — start with whoever works the till.",
        columns: [
          { key: "name", label: "Name", kind: "text", required: true, span: 5 },
          {
            key: "role",
            label: "What they do",
            kind: "text",
            required: true,
            span: 4,
            placeholder: "Till · Kitchen · Manager",
          },
          { key: "note", label: "Note", kind: "text", span: 3 },
        ],
      },
    ],
  },

  {
    key: "spaces",
    num: "07",
    title: "Layout and labels",
    due: "week2",
    blurb:
      "If customers order from a table, scan a code, or pick a spot, we print something physical for each one — and we can only print it once this is settled.",
    cards: [
      {
        key: "layout",
        title: "The floor",
        due: "week2",
        kind: "fields",
        fields: [
          {
            key: "count",
            label: "How many tables or spots",
            kind: "number",
            span: 3,
            placeholder: "12",
          },
          {
            key: "scheme",
            label: "How they're numbered",
            kind: "text",
            span: 5,
            placeholder: "1–12, or A1–A6 inside + B1–B6 terrace",
          },
          {
            key: "plan",
            label: "A photo or sketch of the layout",
            kind: "text",
            span: 4,
            placeholder: "A link, or “sending it on WhatsApp”",
          },
          {
            key: "owner",
            label: "Who's providing it",
            kind: "text",
            span: 6,
          },
          { key: "by", label: "By", kind: "date", span: 6 },
        ],
      },
    ],
  },

  {
    key: "brand",
    num: "08",
    title: "Branding and content",
    due: "week2",
    blurb:
      "Files can't be attached here — send them however you normally send us things, and just tell us where they are. Without a logo by week 1, the first screens you see will be in placeholder styling.",
    cards: [
      {
        key: "assets",
        title: "What we need, and where it is",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "logo",
            label: "Logo files",
            kind: "text",
            required: true,
            span: 6,
            placeholder: "A link, or “sending it on WhatsApp”",
          },
          {
            key: "colors",
            label: "Brand colours",
            kind: "text",
            span: 6,
            placeholder: "#0A84FF, black… or “they're in the logo file”",
          },
          {
            key: "photos",
            label: "Photography",
            kind: "text",
            span: 6,
            placeholder: "A link, or “none yet”",
          },
          {
            key: "fonts",
            label: "Font files",
            kind: "text",
            span: 6,
            placeholder: "A link, or “none”",
          },
          {
            key: "copyOwner",
            label: "Who writes the words",
            kind: "text",
            required: true,
            span: 6,
            placeholder: "A name — or “Kagu drafts, we review”",
          },
          { key: "copyBy", label: "Words ready by", kind: "date", span: 6 },
        ],
      },
    ],
  },

  {
    key: "review",
    num: "09",
    title: "Anything else",
    due: "week1",
    blurb:
      "The question no form thinks to ask. Special cases, worries, the thing the last developer got wrong — it all helps.",
    cards: [
      {
        key: "notes",
        title: "Anything we should know?",
        due: "week1",
        kind: "fields",
        fields: [
          {
            key: "body",
            label: "In your own words",
            kind: "long",
            span: 12,
            placeholder: "Questions, concerns, special cases…",
          },
        ],
      },
    ],
  },
];

/* ── Reading the pack ─────────────────────────────────────────────────────── */

/** The storage key for one answer. Never change the shape — see the header. */
export function answerKey(cardKey: string, fieldKey: string) {
  return `${cardKey}.${fieldKey}`;
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

/**
 * The fields of a card that are actually on screen right now — a `showWhen`
 * field whose condition isn't met is not merely hidden, it is absent from the
 * completion arithmetic. Otherwise answering "0% tax" would leave a permanently
 * unanswerable "rate per group" dragging the meter down.
 */
export function visibleFields(card: IntakeCard, answers: AnswerMap): IntakeField[] {
  if (card.kind !== "fields") return [];
  return card.fields.filter((field) => {
    if (!field.showWhen) return true;
    const current = answers[answerKey(card.key, field.showWhen.key)] ?? "";
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
  due: IntakeDue;
  ok: boolean;
  note?: string;
  /** Optional cards never move the meter, and are listed as "if it applies". */
  optional: boolean;
};

/**
 * Walk the whole pack once and say, per card, whether it's answered.
 *
 * Deliberately one pass producing one array, rather than a predicate per card:
 * the client's meter, the client's checklist and the team's review screen all
 * consume this, and three call sites re-deriving "is the pack done" is how they
 * end up disagreeing by one.
 */
export function buildChecks(
  answers: AnswerMap,
  rows: IntakeRow[]
): IntakeCheck[] {
  const checks: IntakeCheck[] = [];

  for (const section of INTAKE_SECTIONS) {
    for (const card of section.cards) {
      const base = {
        cardKey: card.key,
        sectionKey: section.key,
        label: card.title,
        due: card.due,
      };

      if (card.kind === "table") {
        const mine = rows.filter((row) => row.table_key === card.key);
        const complete = mine.filter((row) => rowComplete(card, row));
        const partial = mine.filter(
          (row) => rowTouched(row) && !rowComplete(card, row)
        );
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
          ok: complete.length >= Math.max(minRows, 1) || (minRows === 0 && mine.length === 0),
          note: notes.join(" · ") || undefined,
        });
        continue;
      }

      const fields = visibleFields(card, answers);
      const required = fields.filter((field) => field.required);
      const missing = required.filter((field) =>
        blank(answers[answerKey(card.key, field.key)])
      );

      // A card with no required fields is a nice-to-have; it shows in the list
      // so nobody wonders where it went, but it can't hold the pack back.
      const optional = required.length === 0;
      const flagged =
        card.flag &&
        card.flag.values.includes(answers[answerKey(card.key, card.flag.key)] ?? "");

      checks.push({
        ...base,
        optional,
        ok: optional
          ? fields.some((field) => !blank(answers[answerKey(card.key, field.key)]))
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
 * business with no bookable rooms should be able to reach 100%, and a pack that
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

/** Find a card by key — the review screen renders answers in catalogue order. */
export function findCard(cardKey: string): IntakeCard | undefined {
  for (const section of INTAKE_SECTIONS) {
    const card = section.cards.find((c) => c.key === cardKey);
    if (card) return card;
  }
  return undefined;
}

/** Human text for a stored choice value — the review screen shows words, not tokens. */
export function choiceLabel(field: IntakeField, value: string): string {
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

/* ── Validation, for the write path ───────────────────────────────────────── */

/**
 * Every legal answer key, built once. Server actions are reachable by direct
 * POST — not only through the form — so "the catalogue says this key exists" is
 * a real check, not a formality. Without it the answers table is an open
 * key-value store that any signed-in client can fill with anything.
 */
const ANSWER_KEYS: ReadonlySet<string> = new Set(
  INTAKE_SECTIONS.flatMap((section) =>
    section.cards.flatMap((card) =>
      card.kind === "fields"
        ? card.fields.map((field) => answerKey(card.key, field.key))
        : []
    )
  )
);

export function isKnownAnswerKey(key: string): boolean {
  return ANSWER_KEYS.has(key);
}

/** The card behind a table key, or undefined if the catalogue has no such table. */
export function findTable(
  tableKey: string
): (IntakeCard & { kind: "table" }) | undefined {
  const card = findCard(tableKey);
  return card?.kind === "table" ? card : undefined;
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
