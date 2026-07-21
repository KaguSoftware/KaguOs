export const SECTIONS = [
  "work",
  "learn",
  "management",
  "debug",
  "marketing",
  "comms",
] as const;

export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  work: "Kagu Work",
  learn: "Kagu Learn",
  management: "Kagu Management",
  debug: "Kagu Debug",
  marketing: "Kagu Marketing",
  comms: "Kagu Comms",
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

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
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

export type SectionMembership = {
  user_id: string;
  section: Section;
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

export type Sprint = {
  id: string;
  title: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  created_by: string | null;
  created_at: string;
};

export type SprintResource = {
  id: string;
  sprint_id: string;
  title: string;
  url: string | null;
  file_path: string | null;
  created_at: string;
};

export type SprintGoal = {
  id: string;
  sprint_id: string;
  title: string;
  sort_order: number;
  created_at: string;
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

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  occurred_on: string;
  client: string | null;
  project_id: string | null;
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

/** An image plus the short-lived signed URL that actually renders it. */
export type DebugTaskImageView = DebugTaskImage & { url: string };

export type CampaignStatus = "idea" | "planned" | "running" | "done";
export type PostStatus = "draft" | "scheduled" | "published";

export type MarketingCampaign = {
  id: string;
  name: string;
  channel: string;
  status: CampaignStatus;
  starts_on: string | null;
  ends_on: string | null;
  budget: number | null;
  currency: Currency;
  url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingPost = {
  id: string;
  title: string;
  channel: string;
  status: PostStatus;
  publish_on: string | null;
  url: string | null;
  campaign_id: string | null;
  owner_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingItem = {
  id: string;
  title: string;
  url: string | null;
  note: string | null;
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
    | "status_change";
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
