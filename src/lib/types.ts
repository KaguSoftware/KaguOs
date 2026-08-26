export const SECTIONS = [
  "work",
  "learn",
  "management",
  "debug",
  "marketing",
  "comms",
  "chat",
  "status",
] as const;

export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  work: "Kagu Work",
  learn: "Kagu Learn",
  management: "Kagu Management",
  debug: "Kagu Debug",
  marketing: "Kagu Marketing",
  comms: "Kagu Comms",
  chat: "Kagu Chat",
  // Not a destination — a feature gate. Owns the presence dots, the status
  // emoji/note, available-to-call, and the editor for your own status.
  status: "Team Status",
};

/**
 * Self-set presence status. The model is three honest signals that never speak
 * for each other: a live online dot (automatic, from presence channels — not
 * here), this manual status (emoji + label/note), and `available_to_call` (the
 * one availability signal). Presets are just SHORTCUTS: picking "In a meeting"
 * pre-fills an emoji + label + a sensible call default, all overridable. There
 * is no separate "custom" kind anymore — every status is emoji + optional text.
 */
export type StatusKind =
  | "none"
  | "working"
  | "focus"
  | "meeting"
  | "break"
  | "eating"
  | "away"
  | "chilling"
  | "sleeping"
  | "off"
  | "custom";

export const STATUS_KINDS: StatusKind[] = [
  "none",
  "working",
  "focus",
  "meeting",
  "break",
  "eating",
  "away",
  "chilling",
  "sleeping",
  "off",
  "custom",
];

export type StatusPreset = {
  /** Emoji shown on the avatar badge. Empty for `none`; user-picked for `custom`. */
  emoji: string;
  label: string;
  /** Sensible default for available_to_call when this preset is picked (overridable). */
  callDefault: boolean;
};

/**
 * The preset shortcuts. `custom` carries no fixed emoji/label — the user
 * supplies both — so its entry here is just the picker's default seed.
 */
export const STATUS_PRESETS: Record<StatusKind, StatusPreset> = {
  none: { emoji: "", label: "No status", callDefault: false },
  working: { emoji: "🛠️", label: "Working", callDefault: true },
  focus: { emoji: "🧠", label: "Deep focus", callDefault: false },
  meeting: { emoji: "📅", label: "In a meeting", callDefault: false },
  break: { emoji: "☕", label: "On a break", callDefault: false },
  eating: { emoji: "🍜", label: "Eating", callDefault: false },
  away: { emoji: "🚶", label: "Not home", callDefault: true },
  chilling: { emoji: "🛋️", label: "Chilling", callDefault: true },
  sleeping: { emoji: "😴", label: "Sleeping", callDefault: false },
  off: { emoji: "🌙", label: "Off today", callDefault: false },
  custom: { emoji: "💬", label: "Custom…", callDefault: false },
};

/**
 * What kind of person this account is — the app's second role axis, alongside
 * `is_admin` and section membership. Until 0062 there was only one answer and
 * it was implicit: every user was one of the 8.
 *
 * A `client` is an outsider with a login: someone at a business Kagu is
 * building for, who fills in their own project's input pack (0072). They are
 * barred from every section gate in the database (0062 §4), not merely hidden
 * from them in the UI, and they see only the projects assigned to them.
 *
 * The two kinds are exclusive by construction: a client cannot be an admin and
 * cannot hold a section, enforced as a check constraint AND inside the four
 * gate functions, so neither one alone can be undone by accident.
 */
export type ProfileKind = "member" | "client";

export const PROFILE_KINDS: ProfileKind[] = ["member", "client"];

export const PROFILE_KIND_LABELS: Record<ProfileKind, string> = {
  member: "Team member",
  client: "Client",
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  /** Member or client. Defaults to 'member' so an older row reads as a colleague. */
  kind: ProfileKind;
  is_admin: boolean;
  color: string | null;
  showcase_mode: boolean;
  /** When this user was last active (throttled to ~5 min). Null = never seen. */
  last_seen_at: string | null;
  /** Self-set presence status (team widget). */
  status_kind: StatusKind;
  /** Emoji shown on the avatar badge — preset-seeded or user-picked. Null = none. */
  status_emoji: string | null;
  /** Optional free-text note, allowed alongside any status kind. */
  status_text: string | null;
  /** "I'm reachable for a quick call right now." */
  available_to_call: boolean;
  /** Optional expiry on the status — "on a break till 15:00". Null = open-ended. */
  status_until: string | null;
  created_at: string;
};

/** One teammate as the presence panel needs them (sidebar + team list). */
export type PresencePerson = {
  id: string;
  name: string;
  color: string;
  last_seen_at: string | null;
  status_kind: StatusKind;
  status_emoji: string | null;
  status_text: string | null;
  available_to_call: boolean;
  /** Optional expiry — "on a break till 15:00". Null = open-ended. */
  status_until: string | null;
};

/** id → display name + identity color (css), used wherever names render. */
export type MembersMap = Record<string, { name: string; color: string }>;

/**
 * One chat message. `recipient_id` null = the Work-team group chat; non-null =
 * a direct 1:1 message. `read_at` is direct-only (group reads live in
 * `message_reads`, one last-read timestamp per person).
 */
export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
  /** The message this one replies to — same thread, enforced by 0049. */
  reply_to_id: string | null;
  /** The debug task this message shares as a card. */
  task_id: string | null;
  /** Not a DB column — hydrated by the data fetcher from `message_images`. */
  images?: MessageImage[];
  /** Not a DB column — the replied-to line, hydrated for the preview card.
   *  Absent when `reply_to_id` is null OR when the original was deleted. */
  reply_to?: MessageReplyRef | null;
  /** Not a DB column — the shared task, hydrated for the preview card.
   *  Absent when `task_id` is null or the reader can't see the debug board. */
  task?: MessageTaskRef | null;
};

/** What a reply's quote card needs from the original message. */
export type MessageReplyRef = {
  id: string;
  sender_id: string;
  body: string;
  /** The original carried at least one image — shown as "Photo" when the
   *  body is empty, and worth a camera glyph either way. */
  has_image: boolean;
};

/** What a shared task's preview card needs from the task. */
export type MessageTaskRef = {
  id: string;
  title: string;
  state: DebugState;
  priority: DebugPriority;
  kind: DebugKind;
};

/** One attached image on a chat message. */
export type MessageImage = {
  id: string;
  message_id: string;
  file_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
};

/** A `MessageImage` plus its signed rendering URLs. */
export type MessageImageView = MessageImage & { url: string; thumbUrl: string };

export type SectionMembership = {
  user_id: string;
  section: Section;
  /** 'read' = see the section, change nothing in it. Defaults to 'write' (0053). */
  access: "read" | "write";
  created_at: string;
};

export type ProjectStatus = "planning" | "active" | "paused" | "done";

export type Project = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  sector: string | null;
  type: string | null;
  repo_url: string | null;
  prod_url: string | null;
  notes: string | null;
  /** Optional deadline (date only) — surfaced on active projects. */
  due_on: string | null;
  /**
   * Which set of questions this project's client is asked (0073) — a key into
   * INTAKE_PACKS in lib/intake.ts. Null means the general pack; so does an
   * unrecognised value, since `packFor()` falls back rather than throwing.
   */
  intake_pack: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One client account's access to one project (0072). Created and destroyed by
 * an admin through the service role — the table has no write policy at all, so
 * there is no other path to it.
 */
export type ClientProject = {
  user_id: string;
  project_id: string;
  created_by: string | null;
  created_at: string;
};

/**
 * The input pack's header — one row per project, holding the "sent" state.
 *
 * The row is created lazily, on the first answer or the first Send, so a
 * project nobody has been asked about yet has no row rather than an empty one.
 * `submitted_at` is a milestone, not a lock: the client can reopen the pack and
 * keep editing (see the note in 0072 §3a).
 */
export type ProjectIntake = {
  project_id: string;
  submitted_at: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
};

/** One scalar answer, keyed `"<card>.<field>"` against the catalogue in lib/intake.ts. */
export type ProjectIntakeAnswer = {
  project_id: string;
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
};

/**
 * One line of a repeating table in the pack — a product, a staff member, a
 * line of opening hours. `data` is column key → cell text; the COLUMNS are the
 * catalogue's business, which is why this is jsonb and not thirty tables.
 */
export type ProjectIntakeRow = {
  id: string;
  project_id: string;
  table_key: string;
  data: Record<string, string>;
  sort: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IdeaStatus = "open" | "promoted" | "archived" | "rejected";

/** Funnel position, independent of status. Set at create ('open'), advanced by
 *  the team, and flipped to 'promoted' automatically on a unanimous upvote. */
export type IdeaStage =
  | "open"
  | "discussing"
  | "accepted"
  | "promoted"
  | "rejected";

export type Idea = {
  id: string;
  title: string;
  body: string | null;
  status: IdeaStatus;
  stage: IdeaStage;
  sector: string | null;
  type: string | null;
  /** People who must unanimously upvote to auto-promote — snapshot at create. */
  required_count: number | null;
  promoted_project_id: string | null;
  /**
   * The project this idea is a suggestion FOR, or null for a company idea
   * (a proposal that could itself become a project). A project-scoped idea
   * never promotes — see the guard in `actions/work.ts`.
   */
  project_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** One row in a project's ideas list — the idea plus its vote/comment tallies. */
export type ProjectIdeaRow = {
  id: string;
  title: string;
  created_by: string | null;
  created_at: string;
  idea_votes: { user_id: string; value: number }[];
  idea_comments: { count: number }[];
};

export type IdeaComment = {
  id: string;
  idea_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type SprintJoinMode = "assigned" | "open";

export type Sprint = {
  id: string;
  title: string;
  description: string | null;
  /** Sits under the title on a full program; null on an ordinary sprint. */
  tagline: string | null;
  /** The sign-off at the foot of the run. */
  outro: string | null;
  starts_on: string;
  ends_on: string;
  join_mode: SprintJoinMode;
  created_by: string | null;
  created_at: string;
};

export type SprintStageKind = "stage" | "capstone";

/** An ordered leg of a sprint: its own goals, ending in a proof. */
export type SprintStage = {
  id: string;
  sprint_id: string;
  title: string;
  summary: string | null;
  /** The paragraphs behind `summary`, shown once the stage is open. */
  detail: string | null;
  /** The gate in one line — what the milestone list and the closed card show. */
  proof: string | null;
  /** The same gate at length: what to actually do, read before you do it. */
  proof_brief: string | null;
  /** What to hand in, in the imperative. Sits above the hand-in box. */
  proof_submit: string | null;
  kind: SprintStageKind;
  day_from: number | null;
  day_to: number | null;
  hours_low: number | null;
  hours_high: number | null;
  sort_order: number;
  created_at: string;
};

/** What the resource IS, which decides its mark and its verb. */
export type SprintResourceKind = "link" | "video" | "read";

export type SprintResource = {
  id: string;
  sprint_id: string;
  stage_id: string | null;
  /** Non-null = this teaches exactly that goal, and renders numbered under it. */
  goal_id: string | null;
  title: string;
  url: string | null;
  file_path: string | null;
  kind: SprintResourceKind;
  /** Who made it — "IBM Technology", "freeCodeCamp · § goal". */
  source: string | null;
  sort_order: number;
  created_at: string;
};

/**
 * A program's prose blocks — everything it carries that isn't a goal.
 *
 *   rule    — a study rule: label "70 / 30", title "Use it live", body why.
 *   session — one block of the daily session: label "Review", minutes 15.
 *   build   — a line of the capstone timeline: label "D12", body what to do.
 */
export type SprintPracticeKind = "rule" | "session" | "build";

export type SprintPractice = {
  id: string;
  sprint_id: string;
  kind: SprintPracticeKind;
  label: string;
  title: string | null;
  body: string | null;
  /** Only read for 'session' — it drives the proportional day meter. */
  minutes: number | null;
  sort_order: number;
  created_at: string;
};

export type SprintGoal = {
  id: string;
  sprint_id: string;
  stage_id: string | null;
  title: string;
  /** The sentence under the line that says what the line means. */
  detail: string | null;
  is_proof: boolean;
  sort_order: number;
  created_at: string;
};

/** One condition a hand-in has to meet. Read down before you send it. */
export type SprintProofCriterion = {
  id: string;
  stage_id: string;
  body: string;
  sort_order: number;
  created_at: string;
};

/**
 * Where a hand-in stands:
 *
 *   submitted         — handed in, nobody has looked yet (or you just edited it)
 *   accepted          — an admin read it and it holds
 *   changes_requested — an admin read it and said what's missing
 *
 * None of these gate the stage: handing in clears it, review annotates it.
 */
export type ProofStatus = "submitted" | "accepted" | "changes_requested";

/** One person's proof for one stage: some text, a file, or both. */
export type SprintProofSubmission = {
  id: string;
  stage_id: string;
  sprint_id: string;
  user_id: string;
  body: string | null;
  /** Path inside the private `learn` bucket. */
  file_path: string | null;
  /** What the person called the file, for the link's label. */
  file_name: string | null;
  status: ProofStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionAudience = "everyone" | "admins";

export type SprintQuestion = {
  id: string;
  sprint_id: string;
  created_by: string | null;
  body: string;
  audience: QuestionAudience;
  created_at: string;
};

export type SprintQuestionReply = {
  id: string;
  question_id: string;
  created_by: string | null;
  body: string;
  created_at: string;
};

export type TransactionType = "income" | "expense";
export type Currency = "TRY" | "USD" | "EUR";
export const CURRENCIES: Currency[] = ["TRY", "USD", "EUR"];

/** 'pending' = recorded but not settled (invoice sent, bill due); 'paid' = done. */
export type TransactionStatus = "pending" | "paid";
export const TRANSACTION_STATUSES: TransactionStatus[] = ["pending", "paid"];

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  status: TransactionStatus;
  occurred_on: string;
  client: string | null;
  project_id: string | null;
  /**
   * The section lens (0069). 'marketing' rows also render in the marketing
   * Budget views; null is the ordinary company ledger row. Same table either
   * way — one source of truth, two lenses.
   */
  category: "marketing" | null;
  /** Which client the money was spent for. Null = general marketing spend. */
  marketing_client_id: string | null;
  /** The campaign this money served, when it served one. */
  campaign_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type RecurringCadence = "monthly" | "yearly";

export type RecurringItem = {
  id: string;
  type: TransactionType;
  name: string;
  counterparty: string | null;
  amount: number;
  currency: Currency;
  cadence: RecurringCadence;
  started_on: string;
  canceled_on: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type FxRate = {
  currency: "USD" | "EUR";
  rate_to_try: number;
  updated_by: string | null;
  updated_at: string;
};

export type ContractStatus = "draft" | "active" | "expired" | "terminated";

export type Contract = {
  id: string;
  title: string;
  client: string;
  starts_on: string | null;
  ends_on: string | null;
  status: ContractStatus;
  notes: string | null;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DebugState = "open" | "in_progress" | "done";
export type DebugPriority = "low" | "medium" | "high" | "urgent";
/**
 * What sort of work a task is. `audit` is the odd one: its output isn't a
 * working thing, it's a LIST of things that need doing — "sweep the checkout
 * for bugs" finishes by producing tasks, not by fixing anything.
 */
export type DebugKind = "fix" | "feature" | "audit";

export type DebugTask = {
  id: string;
  title: string;
  description: string | null;
  state: DebugState;
  priority: DebugPriority;
  kind: DebugKind;
  project_id: string | null;
  assignee_id: string | null;
  /** Admin's soft suggestion of who should take this — does NOT claim it. */
  suggested_for: string | null;
  /** Optional deadline (date only). */
  due_on: string | null;
  /** When it entered 'done' (null otherwise). Drives the 7-day auto-archive. */
  done_at: string | null;
  /** When it was auto-archived off the board (null = live). */
  archived_at: string | null;
  /** The audit task that turned this up, if it came from one. */
  found_by: string | null;
  /**
   * Showcase-mode row. The board query scopes by this, and so must the realtime
   * handlers — a channel that ignores it streams real tasks onto the demo board.
   */
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A screenshot attached to a debug task. Bytes live in the private `debug`
 * bucket; this row is the index. `width`/`height` are the natural size captured
 * at upload so a thumbnail can reserve its box before the signed URL resolves.
 */
export type DebugTaskImage = {
  id: string;
  task_id: string;
  /** Path within the `debug` bucket: "<task_id>/<uuid>.<ext>". */
  file_path: string;
  width: number | null;
  height: number | null;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
};

/**
 * One note on a debug task — the running thread beneath `description`.
 *
 * `description` is the reporter's statement of the problem and is overwritten
 * on every edit. A note is appended and never rewritten by anyone but its
 * author, which is what makes attribution mean something here.
 */
export type DebugTaskNote = {
  id: string;
  task_id: string;
  body: string;
  is_demo: boolean;
  /** Null once the author's account is deleted — rendered as "Someone". */
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** An image plus the short-lived signed URL that actually renders it. */
/**
 * A task screenshot with its short-lived signed URLs.
 *
 * TWO urls, deliberately: `url` is the stored original and is what the lightbox
 * and any download must use, `thumbUrl` is the resized copy for the grid box.
 * They are separate because a downscaled screenshot is fine to glance at and
 * useless as evidence — see THUMB_TRANSFORM in lib/debug-images.ts.
 */
export type DebugTaskImageView = DebugTaskImage & {
  url: string;
  thumbUrl: string;
};

/* ── Marketing: the agency arm ──────────────────────────────────────────────
 *
 * Kagu's marketing team working for other companies. Client is the root
 * object — every row below belongs to exactly one. The unit of work is a POST
 * (0068, second pass): four states, a date, a link. The old ten-rung creative
 * ladder, review threads and client login accounts were dropped in the same
 * migration — approvals happen off-app, and the section tracks schedule,
 * budget and what went out.
 */

export type ClientStatus = "active" | "paused" | "ended";

/**
 * How Kagu is paid. All three are live options and the answer is deliberately
 * undecided (see MARKETING.md D4) — the storage does not wait for the business
 * model, so deciding it later costs nothing.
 */
export type EngagementKind = "retainer" | "project" | "ad_fee";

/** Whose ad account is charged. 'client' today, always; see 0062. */
export type AdAccountOwner = "client" | "kagu";

export type Client = {
  id: string;
  name: string;
  status: ClientStatus;
  currency: Currency;
  engagement_kind: EngagementKind;
  /** Videos owed per month on a retainer. Null for project work. */
  monthly_deliverables: number | null;
  ad_account_owner: AdAccountOwner;
  brand_notes: string | null;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A post's life, in order: an idea, being made, dated and queued, out. The
 * transitions live in lib/posts.ts so the ladder is defined once.
 */
export type PostStatus = "idea" | "making" | "scheduled" | "posted";

/** One thing that goes out for a client (0068, second pass). */
export type MarketingPost = {
  id: string;
  client_id: string;
  campaign_id: string | null;
  title: string;
  channel: string;
  status: PostStatus;
  publish_on: string | null;
  /** The live link once it's out. */
  url: string | null;
  owner_id: string | null;
  notes: string | null;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignStatus = "idea" | "planned" | "running" | "done";

export type AdPlatform = "meta" | "tiktok" | "google" | "other";
export type GoalMetric = "reach" | "leads" | "sales" | "followers";

export type MarketingCampaign = {
  id: string;
  /** Null only on rows predating 0063; those can hold no creatives. */
  client_id: string | null;
  name: string;
  channel: string;
  /** Where the money goes, as opposed to `channel` (where the content goes). */
  platform: AdPlatform | null;
  status: CampaignStatus;
  starts_on: string | null;
  ends_on: string | null;
  budget: number | null;
  goal_metric: GoalMetric | null;
  goal_target: number | null;
  /** What actually went out, from the ad import. Never typed by hand. */
  spend_actual: number;
  currency: Currency;
  url: string | null;
  notes: string | null;
  /** The two fields that make a finished campaign teach something. */
  retro_worked: string | null;
  retro_avoid: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A shelf link — the Drive folder, the brand kit (0070). `client_id` carries
 * the scope: null = the team's own shelf, set = that client's shelf.
 */
export type MarketingLink = {
  id: string;
  client_id: string | null;
  title: string;
  url: string;
  note: string | null;
  sort: number;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
};

export type Reminder = {
  id: string;
  scope: "personal" | "team";
  owner_id: string | null;
  text: string;
  done: boolean;
  /** Optional deadline. null = a note to self, which is most of them. */
  due_on: string | null;
  created_by: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind:
    | "debug_task_new"
    | "debug_suggested"
    | "idea_new"
    | "idea_promoted"
    | "idea_comment"
    | "reminder_shared"
    | "learn_question"
    | "learn_answer"
    | "learn_proof"
    | "learn_review"
    | "status_change"
    | "message"
    | "debug_note"
    /** A client pressed Send on their project's input pack (0072). */
    | "client_intake";
  title: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  body: string;
  tone: "info" | "primary" | "warning";
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One note on the dashboard pinboard — a standing "keep this in mind", pinned
 * by an admin and addressed to one or more audiences (0065).
 *
 * `audience` is typed as a plain string rather than AudienceToken: it arrives
 * from the database, which is free to hold a token this build doesn't know yet
 * (a migration ahead of a deploy). The rendering helpers in lib/pinboard.ts
 * narrow it, so an unknown token degrades to "not shown" instead of a crash.
 */
export type PinboardNote = {
  id: string;
  body: string;
  color: string;
  audience: string;
  /**
   * The hand-picked readers, and ONLY when `audience` is 'people' — the check
   * constraint in 0067 forces this empty for every group audience, so it never
   * has to be read alongside a token that would ignore it.
   */
  audience_ids: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The structured picks behind a focus item's sentence, so it can be re-edited. */
export type DebugFocusParts = {
  /** "work" = get through the board · "find" = go look for what's NOT on it yet. */
  mode?: "work" | "find";
  /** What to go looking for, in "find" mode. */
  hunt?: string[];
  kinds?: string[];
  states?: string[];
  priorities?: string[];
  order?: string[];
};

/**
 * ONE focus item on the debug board — a set of boards plus their shared
 * qualifiers. SEVERAL items are active at once, so the two axes are both open:
 *   - one item, many boards  → "Pet app and Site — fixes" (one instruction)
 *   - many items             → "Pet app: clear bugs" + "Site: ship features"
 *                              (two different instructions, not smeared into one)
 * `project_ids` empty = the whole board.
 */
export type DebugFocus = {
  id: string;
  body: string;
  tone: "info" | "primary" | "warning";
  active: boolean;
  project_ids: string[];
  parts: DebugFocusParts;
  rank: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectSecret = {
  id: string;
  project_id: string;
  label: string;
  username: string | null;
  secret: string | null;
  url: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactKind = "lead" | "client";
export type ContactStatus =
  | "new"
  | "contacted"
  | "negotiating"
  | "won"
  | "lost"
  | "active"
  | "dormant";

export type Contact = {
  id: string;
  name: string;
  company: string | null;
  kind: ContactKind;
  status: ContactStatus;
  email: string | null;
  phone: string | null;
  owner_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactLink = {
  id: string;
  contact_id: string;
  label: string;
  url: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

/**
 * An internal meeting record — what happened, who was there, what we decided.
 * The counterpart to `ContactInteraction`, which logs OUTWARD contact.
 */
export type CommsMeeting = {
  id: string;
  title: string;
  /** Date only — the day it happened. Compare with `todayInIstanbul()`. */
  held_on: string;
  /** Profile ids of who attended. */
  attendees: string[];
  /** The one-line "what came of it", shown without expanding. */
  summary: string | null;
  notes: string | null;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A shared scratchpad line — "things to write down in case they come up later".
 * Deliberately thin: a body and a pin, nothing else. Structure is what stops
 * people jotting things down.
 */
export type CommsNote = {
  id: string;
  body: string;
  pinned: boolean;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InteractionKind = "call" | "email" | "meeting" | "message" | "note";

export type ContactInteraction = {
  id: string;
  contact_id: string;
  happened_on: string;
  kind: InteractionKind;
  summary: string;
  created_by: string | null;
  created_at: string;
};

/* ── The client portal's two published surfaces (0074) ─────────────────────
 *
 * Both are things Kagu SAYS to a client, which is why they are their own rows
 * rather than a lens over `debug_tasks` and `transactions`. See the header of
 * 0074_client_portal.sql for why that distinction is load-bearing.
 */

export type MilestoneStatus = "planned" | "in_progress" | "done" | "blocked";
export const MILESTONE_STATUSES: MilestoneStatus[] = [
  "planned",
  "in_progress",
  "done",
  "blocked",
];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};

/**
 * One phase of the build, written for the client rather than for the board.
 *
 * `weight` and `completion` (0075 §1) are what make it a PHASE rather than a
 * checkbox: a phase worth 20% of the project, sitting at 80% of itself, moves
 * the headline by 16 points. The arithmetic is in `milestoneProgress`.
 */
export type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  detail: string | null;
  status: MilestoneStatus;
  target_on: string | null;
  done_on: string | null;
  sort: number;
  /** The phase this one sits inside; null for a top-level phase. 0078 §1. */
  parent_id: string | null;
  /** 0 top-level, 1 sub-phase. Generated from `parent_id` — never written. */
  depth: number;
  /**
   * Top-level: share of the whole build, 0–100. 0 means "not weighted" (0075
   * §1c). Sub-phase: share of ITS PARENT. Two denominators, one column — the
   * level is what tells them apart.
   */
  weight: number;
  /** How far through this phase alone, 0–100. Forced to 100 when done. */
  completion: number;
  /** False keeps a half-planned step on the member side — see 0074 §1. */
  visible_to_client: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A plan grouped for display: each top-level phase with its sub-phases under
 * it, both already in `sort` order from the query.
 *
 * Children are looked up by parent id rather than by position, so a plan that
 * mixes nested and flat phases renders correctly — which every project on the
 * system does today, since nothing had children before 0078.
 */
export function milestoneTree(
  milestones: ProjectMilestone[]
): { phase: ProjectMilestone; steps: ProjectMilestone[] }[] {
  const byParent = new Map<string, ProjectMilestone[]>();
  for (const m of milestones) {
    if (!m.parent_id) continue;
    const bucket = byParent.get(m.parent_id);
    if (bucket) bucket.push(m);
    else byParent.set(m.parent_id, [m]);
  }
  return milestones
    .filter((m) => !m.parent_id)
    .map((phase) => ({ phase, steps: byParent.get(phase.id) ?? [] }));
}

/**
 * Invoice currencies. A superset of `Currency` by ONE, and deliberately its own
 * type: `transactions` converts to TRY through `fx_rates`, and a dinar row over
 * there would drop silently out of every total (0074 §2).
 */
export type InvoiceCurrency = Currency | "IQD";
export const INVOICE_CURRENCIES: InvoiceCurrency[] = ["TRY", "USD", "EUR", "IQD"];

/** 'draft' is the one status a client never sees — the RLS policy hides it. */
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

export type ProjectInvoice = {
  id: string;
  project_id: string;
  number: string;
  title: string | null;
  amount: number;
  currency: InvoiceCurrency;
  issued_on: string;
  due_on: string | null;
  status: InvoiceStatus;
  paid_on: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/* ── The payment plan (0075 §2) ────────────────────────────────────────────
 *
 * An invoice is a bill that has already gone out. A plan is the agreement it
 * comes from — "a third up front, a third on delivery, a third on launch", or
 * "$1,200 a month until we say stop" — and it is the thing a client actually
 * wants to see when they ask what this is going to cost them.
 *
 * The two stay separate objects, linked by `invoice_id` on the payment. See
 * 0075's header for why merging them would make both worse.
 */

/**
 * What shape the agreement is.
 *
 * The first two are purely how it is described to the client — the rows
 * underneath them are identical, and only the wording changes ("3 × $3,000"
 * versus "$1,200 / month").
 *
 * 'custom' is the one that means something structurally: there is no rhythm to
 * describe, so the plan's cadence is decoration and the schedule is whatever
 * dates were actually agreed. The create form drops its generator for a list
 * you type; the panel treats it the same as any other plan afterwards, because
 * by then every plan is just rows.
 */
export type PaymentPlanKind = "installments" | "recurring" | "custom";
export const PAYMENT_PLAN_KINDS: PaymentPlanKind[] = [
  "installments",
  "recurring",
  "custom",
];

export const PAYMENT_PLAN_KIND_LABELS: Record<PaymentPlanKind, string> = {
  installments: "Fixed instalments",
  recurring: "Recurring / retainer",
  custom: "Custom dates",
};

export type PaymentCadence = "weekly" | "monthly" | "quarterly" | "yearly";
export const PAYMENT_CADENCES: PaymentCadence[] = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

export const PAYMENT_CADENCE_LABELS: Record<PaymentCadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

/** "$1,200 / month" — the unit a recurring plan is quoted in. */
export const PAYMENT_CADENCE_PER: Record<PaymentCadence, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

/** Days between two payments. Months are handled by `addMonths`, not by these. */
export const PAYMENT_CADENCE_MONTHS: Record<PaymentCadence, number> = {
  weekly: 0,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** 'draft' is the one a client never sees — the RLS policy hides it (0075 §2c). */
export type PaymentPlanStatus = "draft" | "active" | "completed" | "cancelled";
export const PAYMENT_PLAN_STATUSES: PaymentPlanStatus[] = [
  "draft",
  "active",
  "completed",
  "cancelled",
];

export const PAYMENT_PLAN_STATUS_LABELS: Record<PaymentPlanStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type ProjectPaymentPlan = {
  id: string;
  project_id: string;
  title: string;
  kind: PaymentPlanKind;
  currency: InvoiceCurrency;
  /** The headline figure when every payment is the same. Null on a bespoke one. */
  amount_each: number | null;
  cadence: PaymentCadence;
  starts_on: string;
  /** Null on an open-ended retainer. */
  ends_on: string | null;
  status: PaymentPlanStatus;
  note: string | null;
  visible_to_client: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One payment of a plan.
 *
 * 'invoiced' is the state between promise and bill — the schedule said this was
 * due, and somebody has raised the document for it. A client sees the same row
 * on both sides of that line, which is the point: the schedule does not
 * rearrange itself the moment we get round to billing it.
 */
export type InstallmentStatus = "scheduled" | "invoiced" | "paid" | "waived";
export const INSTALLMENT_STATUSES: InstallmentStatus[] = [
  "scheduled",
  "invoiced",
  "paid",
  "waived",
];

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  scheduled: "Scheduled",
  invoiced: "Invoiced",
  paid: "Paid",
  waived: "Waived",
};

export type ProjectPaymentInstallment = {
  id: string;
  plan_id: string;
  project_id: string;
  seq: number;
  label: string | null;
  amount: number;
  due_on: string;
  status: InstallmentStatus;
  paid_on: string | null;
  invoice_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};
