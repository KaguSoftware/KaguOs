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

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  color: string | null;
  showcase_mode: boolean;
  created_at: string;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IdeaStatus = "open" | "promoted" | "archived";

export type Idea = {
  id: string;
  title: string;
  body: string | null;
  status: IdeaStatus;
  sector: string | null;
  type: string | null;
  promoted_project_id: string | null;
  created_by: string | null;
  created_at: string;
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

export type DebugTask = {
  id: string;
  title: string;
  description: string | null;
  state: DebugState;
  priority: DebugPriority;
  project_id: string | null;
  assignee_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

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
  created_by: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind:
    | "debug_task_new"
    | "idea_new"
    | "idea_promoted"
    | "idea_comment"
    | "reminder_shared";
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
