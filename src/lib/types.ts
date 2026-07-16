export const SECTIONS = [
  "work",
  "learn",
  "management",
  "debug",
  "marketing",
] as const;

export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  work: "Kagu Work",
  learn: "Kagu Learn",
  management: "Kagu Management",
  debug: "Kagu Debug",
  marketing: "Kagu Marketing",
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
};

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
  assignee_id: string | null;
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
